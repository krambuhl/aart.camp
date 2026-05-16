---
name: griot-compact
description: >-
  Run the learnings validation pipeline using griot-* subagents. Bills
  against pooled Claude Code subscription tokens (no ANTHROPIC_API_KEY
  required). Use ONLY when explicitly invoked via /griot-compact.
  Processes every unprocessed session-note in learnings/session-notes/,
  runs the four-judge tier-based panel via parallel Agent calls,
  mediates consensus through `bin/griot mediate-panel`,
  attempts up to config.rewrite.max_attempts rewrites on
  UNCHANGED/REGRESSED outcomes, and escalates stuck notes to
  griot-operator for diagnosis. After per-note processing, re-runs
  every existing rollup entry through a single-judge pass-check to
  detect regressions, then composes a markdown PR body summarizing
  the run (delivered via the skill response — copy-paste into a
  GitHub PR). All JSONL writes go through
  `bin/griot operator-checks log-intervention`.
user-invocable: true
disable-model-invocation: true
allowed-tools: Read, Write, Bash, Agent
---

# Learnings Compact

Drive the learnings validation pipeline using griot-* subagents and
the deterministic verbs under `bin/griot`. The skill itself is the
orchestrator — there is no Node script delegating orchestration.
Each LLM call is a subagent spawn; each parsing/tally/threshold step
is a Bash invocation of a `bin/griot` verb; each JSONL append is a
Bash invocation of `bin/griot operator-checks log-intervention`.

This skill is **idempotent**: if there are no unprocessed
session-notes AND `learnings/rollup.json` is empty or missing, it
does nothing.

## Prerequisites

- All inputs are repo-local. No environment variables required.
- The pipeline runs on pooled Claude Code subscription tokens via
  subagent dispatch. There is no `@anthropic-ai/sdk` dependency.
- `learnings/config.yaml` carries the panel composition, consensus
  thresholds, tiebreak rule, and per-role tier assignments. Read it
  at startup; do not re-read mid-run.

## Substrate this skill composes

- Five subagent role files under `.claude/agents/`: `griot-base`
  (shared stance), `griot-judge`, `griot-rubric-author`,
  `griot-rewriter`, `griot-debate-summarizer`, `griot-operator`.
- Tier-based config in `learnings/config.yaml`.
- `bin/griot mediate-panel` — pipes judge outputs through to get
  parsed verdicts, tally, threshold check, tier-split detection,
  tiebreak application.
- `bin/griot operator-checks` — two modes: `verify-rubric` (rubric
  tampering detection, called between rewrite attempts) and
  `log-intervention` (sole writer for all JSONL appends in this
  pipeline: `operator-log.jsonl`, `bench-history.jsonl`, and
  `regressions.jsonl`).

The pipeline also spawns `general-purpose` subagents for the test
subject (control and treatment outputs in §2 and §3) and for the
regression suite's pass-check call (§3). These are not griot-*
roles — they are plain Claude calls with role-specific system
prompts and tier overrides at spawn time.

## Procedure

### 1. Pre-flight

1. Read `learnings/config.yaml`. Extract:
   - `judges`: array of `{id, tier}` (4 entries: 2 `opus`, 1
     `sonnet`, 1 `haiku`)
   - `consensus`: `{round_1_blind, round_2_debate}`
   - `tiebreak`: `{rule, top_tier}`
   - `agents`: `{rubric_author.tier, rewriter.tier,
     debate_summarizer.tier, operator.tier}`
   - `test_subject.tier`
   - `rewrite.max_attempts`
2. List `learnings/session-notes/`, excluding the `archived/` subdir.
3. If there are no unprocessed notes AND `learnings/rollup.json` is
   empty or missing, tell the user "nothing to compact" and stop.
4. Otherwise echo the list of unprocessed notes to the user, then
   proceed.

**Format-detection error path** (substrate-cli Phase 4 rollup
whiteboard skeptic Finding 1): if `learnings/rollup.md` is present
AND `learnings/rollup.json` is missing, this session predates the
Phase 4 rollup cutover. Stop, log an intervention via
`operator-checks.ts log-intervention` with category
`format_predates_phase_4_rollup_cutover`, and emit the error
"session predates Phase 4 rollup cutover; restart session to pick
up new skill body and run `node .claude/scripts/migrate-rollup-md-to-json.ts`"
to the user. Do NOT fall back to writing into `rollup.md` — silent
fallback risks splitting writes across two formats.

### 2. Per-note pipeline

For each unprocessed session-note (folder under
`learnings/session-notes/`), run the steps below in order. Process
notes serially; the parallelism is within each note's panel rounds,
not across notes.

#### Step pre-A — Classification routing

Read the note's `state.json` sidecar via the Read tool and parse it.
The `classification` field drives routing. The `state.json` sidecar
was introduced in substrate-cli Phase 4; before that, classification
lived as YAML frontmatter on `learning.md`. The migration script
shipped with Phase 4 converts old-format folders to the new shape.

**Format-detection error path** (substrate-cli Phase 4 whiteboard
skeptic Finding 1): if `state.json` is missing in the note folder
AND `learning.md` starts with a `---` YAML frontmatter block, this
session predates the Phase 4 cutover and is running the old skill
body against new on-disk state (or vice versa). Stop processing
this note, log an intervention via `operator-checks.ts
log-intervention` with category `format_predates_phase_4_cutover`
(record: `{note_slug, status: "format mismatch"}`), and emit the
error "session predates Phase 4 cutover; restart session to pick
up new skill body and run `.claude/scripts/migrate-session-notes.ts`"
to the user. Do NOT silently fall back to frontmatter parsing —
silent fallback risks splitting writes across two formats.

If `state.json` is missing AND `learning.md` has no frontmatter,
this is a pre-migration folder that needs the migration script
run; emit the same error.

Branch on the classification value:

- **`recurring`** — frequency-evidenced. The four-judge panel adds
  nothing the frequency counter hasn't already validated. Skip
  Steps A–B entirely. Go directly to Step C with synthetic verdict
  `IMPROVED` and proceed with the `IMPROVED` outcome (assign next
  `L-NNN`, push entry to `learnings/rollup.json`, archive).

- **`generator-antipattern`** — run the full Step A + Step B panel
  exactly as today. The only divergence is in Step C's `IMPROVED`
  outcome: promote to `learnings/rollup.json` as an entry with
  `classification: "AP"`, using an **`AP-NNN`** identifier scheme
  (compute the next ID as `max(existing AP-NNN) + 1`, starting at
  `AP-001`). See Step C's IMPROVED branch for the details. Post-
  Phase-4-rollup, antipattern entries live alongside learning entries
  in the same JSON array, distinguished by their `classification`
  field; the rendering layer (`bin/griot use --as=llm`) groups them
  under a `## Project antipatterns` section in the prose output.

- **`catalog-gap`** | **`evaluator-conflict`** | **`sanctioned-exception`**
  → **not-yet-supported in v1**. Skip Steps A–C entirely. Do NOT
  archive the note. Add it to a separate run-summary list under
  `## Not-yet-supported classifications` so the PR-body output is
  honest about what was skipped and why.

- **`unclassified`** → continue with the historical flow (Step A +
  Step B + Step C as today). All correction-text captures
  (`--from-checkin` path) record this classification in
  `state.json`.

This routing block reads `state.json` ONLY. It does not modify the
note. The classification field is data the CLI authored when
capturing; the SKILL trusts it.

#### Step A — Rubric (one-time per note)

If the note's `rubric.md` is missing, spawn `griot-rubric-author`
via the Agent tool with `model` matching `agents.rubric_author.tier`
from config.

The brief contains the contents of the note's `correction.md` and
`wrong.md` only — deliberately NOT `learning.md`. The rubric must
be derived from what the correction demands, not from any prose
proposing a fix.

The subagent's response ends with a fenced ` ```rubric ` block
containing a JSON array of 2–3 binary assertions. Extract the block
and parse it. If extraction fails (no block, malformed JSON, wrong
array shape), log a JSONL intervention via `operator-checks.ts
log-intervention` with category `rubric_author_failed` and stop
processing this note (proceed to the next session-note in the
outer loop).

Otherwise write the rubric as
`learnings/session-notes/<note>/rubric.md` in this canonical format:

```
# Rubric

_Immutable. Written by griot-rubric-author with fresh context. Any
attempt to modify this file is a hard violation._

- assertion 1
- assertion 2
- assertion 3 (optional)
```

Capture the full text of the rubric.md file you just wrote (or the
existing one if it was already present) into the variable
`expected_rubric` for the rest of this note's pipeline. This is the
ground-truth rubric the rewriter is forbidden from modifying;
attempt > 1 verifies on-disk against this captured value.

Initialize an empty `attempts_history` list. It accumulates one
entry per attempt: `{attempt, learning_text, verdicts}`. The
`griot-operator` consumes this list if the note ends up stuck.

#### Step B — Attempt loop

Iterate `attempt` from `1` to `config.rewrite.max_attempts`. Each
iteration runs the full panel sequence (B.3 through B.6) and ends
with a decision (B.7) to either exit the loop with a final verdict
or continue to the next attempt.

##### B.1 — Verify rubric integrity (attempt > 1 only)

Skip on the first attempt — Step A just wrote the rubric.

On attempt > 1, invoke `operator-checks.ts verify-rubric` via Bash
with stdin JSON:

```bash
bin/griot operator-checks verify-rubric <<'INPUT'
{"rubric_path": "learnings/session-notes/<note>/rubric.md",
 "expected": "<full text of expected_rubric, JSON-escaped>"}
INPUT
```

Branch on the result:
- Stdout `{"ok": true}` → continue to B.2.
- Stdout `{"ok": false, "actual": <text>}` → the rubric on disk
  has been modified since Step A. Log a JSONL intervention via
  `operator-checks.ts log-intervention` with category
  `rubric_tampered` (record includes `note_slug`, `attempt`,
  short excerpts of `expected` and `actual`). Exit the attempt
  loop with synthetic verdict `RUBRIC_TAMPERED`.
- Script-level error (non-zero exit) → the rubric file is
  missing or unreadable. Log an intervention with category
  `rubric_tampered` and a note in the record explaining
  "rubric file missing or unreadable". Exit the attempt loop
  with synthetic verdict `RUBRIC_TAMPERED`.

##### B.2 — Spawn rewriter (attempt > 1 only)

Skip on the first attempt — the candidate learning under
evaluation is the one already in the note's `learning.md`.

On attempt > 1, spawn `griot-rewriter` via the Agent tool with
`model` matching `agents.rewriter.tier`. The brief contains, in
order:

- Attempt number and `config.rewrite.max_attempts`.
- Origin prompt (note's `prompt.md`).
- Correction (note's `correction.md`).
- Current learning text (note's `learning.md` as-is from the
  prior attempt).
- Immutable rubric (`expected_rubric` from Step A).
- Last panel reasoning: each non-errored judge's `judge_id`,
  `tier`, `verdict`, and `reasoning` from the prior attempt's
  final round.

The subagent's response ends with a fenced ` ```learning ` block
containing the revised learning body. Extract the block. If
extraction fails (no block, wrong shape), log a JSONL
intervention with category `rewriter_failed` and exit the
attempt loop with synthetic verdict `REWRITER_FAILED`.

Otherwise overwrite the note's `learning.md` with the revised
text. Steps B.3 onward will use this updated learning.

##### B.3 — Generate control + treatment

In a single tool-use message, spawn two `general-purpose`
subagents in parallel, both with `model` matching
`test_subject.tier`:

- **Control**: prompt is the contents of the note's `prompt.md`.
  System-style framing: "You are Claude, helping with a software
  task in the aart.camp repo." (no learning injected).
- **Treatment**: prompt is the same `prompt.md`. System-style
  framing: "You are Claude, helping with a software task in the
  aart.camp repo. Before answering, consider this validated
  learning and apply it if relevant: `<learning>` plus
  `<contents of learning.md>` plus `</learning>`."

Capture both subagents' full text outputs as `control_output` and
`treatment_output`.

If either subagent errors or returns no usable text, log a
JSONL intervention via `operator-checks.ts log-intervention`
with category `test_subject_failed`, the note slug, attempt
number, and error text. Exit the attempt loop with synthetic
verdict `TEST_SUBJECT_FAILED`.

##### B.4 — Round 1 panel

In a single tool-use message, spawn 4 `griot-judge` subagents in
parallel — one per entry in the `judges` array. Each spawn's
`model` parameter matches that judge's `tier`.

The brief for each judge contains, in this order:

- Origin prompt (note's `prompt.md`)
- Correction (note's `correction.md`)
- Candidate learning (note's `learning.md`, as updated by B.2 on
  attempt > 1)
- Rubric (`expected_rubric`)
- Control output (from B.3)
- Treatment output (from B.3)

The judge's response ends with a fenced ` ```verdict ` block.
Capture each judge's full text as `raw_output[i]`, paired with
`judges[i].id` and `judges[i].tier`, preserving order.

##### B.5 — Mediate round 1

Pipe the four raw outputs through
`bin/griot mediate-panel` via Bash with stdin
JSON:

```bash
bin/griot mediate-panel <<'INPUT'
{
  "round_num": 1,
  "verdicts": [
    {"judge_id": "opus-A", "tier": "opus", "raw_output": "..."},
    {"judge_id": "opus-B", "tier": "opus", "raw_output": "..."},
    {"judge_id": "sonnet", "tier": "sonnet", "raw_output": "..."},
    {"judge_id": "haiku", "tier": "haiku", "raw_output": "..."}
  ],
  "config": {
    "consensus": {"round_1_blind": 4, "round_2_debate": 3},
    "tiebreak": {"rule": "top_tier_consensus", "top_tier": "opus"}
  }
}
INPUT
```

Parse the JSON output. Save the parsed `verdicts` array into
`attempts_history` for this attempt. If `threshold_met` is
`true`, this attempt's verdict is `consensus_verdict` — proceed
to B.7. If `threshold_met` is `false`, continue to B.6.

##### B.6 — Round 2 panel (only when round 1 didn't reach unanimity)

1. Spawn `griot-debate-summarizer` with `model` matching
   `agents.debate_summarizer.tier`. The brief contains:
   - The round number that just completed (1).
   - For each non-errored judge from round 1: their `judge_id`,
     `tier`, `verdict`, and `reasoning` text.
   The summarizer's response ends with a fenced ` ```summary `
   block. Extract the summary text.

2. Spawn 4 `griot-judge` subagents again (same as B.4), but
   append the summary to each judge's brief under a clearly-
   delimited "## Other judges' reasoning from the previous
   round" section. Each judge re-evaluates with full knowledge
   of the prior round's positions.

3. Pipe the round 2 outputs through `mediate-panel.ts` with
   `round_num: 2`. Save the parsed `verdicts` array into
   `attempts_history` for this attempt (overwriting the round 1
   entry — the latest round is what the rewriter and operator
   consume).

4. Branch on the result:
   - `threshold_met == true` → this attempt's verdict is
     `consensus_verdict`. Proceed to B.7.
   - `threshold_met == false` AND `tiebreak_applied == true` →
     this attempt's verdict is `tiebreak_verdict`. Proceed to
     B.7.
   - `threshold_met == false` AND `tiebreak_applied == false` →
     no consensus and no tiebreak fired. Log a JSONL
     intervention via `operator-checks.ts log-intervention`
     with category `no_consensus`, the note slug, attempt
     number, and both rounds' tallies. Exit the attempt loop
     with synthetic verdict `NO_CONSENSUS`.

##### B.7 — Decide attempt outcome

Branch on the verdict for this attempt (set in B.5 or B.6):

- `IMPROVED` → exit the attempt loop with verdict `IMPROVED`.
  Record `attempt_count` (= current `attempt`) for the run
  summary.
- `DID_NOT_REPRODUCE` → exit the attempt loop with verdict
  `DID_NOT_REPRODUCE`.
- `NO_CONSENSUS` → already handled in B.6 (loop exited).
- `UNCHANGED` or `REGRESSED`:
  - If `attempt < config.rewrite.max_attempts`, increment
    `attempt` and continue to the next iteration (back to B.1).
  - If `attempt == config.rewrite.max_attempts`, exit the
    attempt loop with synthetic verdict `STUCK_LEARNING`. The
    `attempts_history` list now contains every attempt; pass
    it through to Step C.

#### Step C — Outcome handling

Branch on the final verdict reached when the attempt loop exited.

**`IMPROVED`**:

**Branch on classification** (read in Step pre-A):

**Promotion now writes to `learnings/rollup.json`** (post-Phase-4-rollup
cutover): the rollup is a JSON array of entries. Promotion reads the
array, computes the next ID, pushes a new entry object, and writes the
array back. The legacy markdown-append path is removed.

- **`generator-antipattern`** → promote to the rollup as an `AP-NNN`
  entry:

  1. Read `learnings/rollup.json` via the Read tool (default to `[]`
     if missing). Find the maximum existing `AP-NNN` ID across all
     entries with `classification: "AP"`. The new ID is one more,
     zero-padded to three digits. If no `AP-NNN` entries exist yet,
     the first ID is `AP-001`. The `AP-NNN` and `L-NNN` namespaces
     are independent — do not conflate.
  2. Push a new entry to the array with the shape:

     ```json
     {
       "id": "AP-<NNN>",
       "title": "<short title derived from learning.md>",
       "classification": "AP",
       "promoted": "<today's date in YYYY-MM-DD>",
       "origin": "<note's slug>",
       "body": "<full contents of note's learning.md, verbatim>",
       "rubric": null,
       "evaluator": "<state.json `evaluator` field>",
       "code": "<state.json `code` field>"
     }
     ```

  3. Write the updated array back to `learnings/rollup.json` via the
     Write tool (`JSON.stringify(entries, null, 2)` with a trailing
     newline — matches the migration script's output shape).
  4. Move the session-note folder to `archived/` (same as the
     learnings path).
  5. Mark this note's outcome as
     `"promoted as AP-NNN on attempt N (generator-antipattern)"`
     for the run summary.

- **`recurring`** | **unclassified** → promote to the rollup as an
  `L-NNN` entry:

  1. Read `learnings/rollup.json` via the Read tool (default to `[]`
     if missing). Find the maximum existing `L-NNN` ID across all
     entries with `classification: "L"`; the new ID is one more,
     zero-padded to three digits. If no `L-NNN` entries exist yet,
     the first ID is `L-001`.
  2. Push a new entry to the array with the shape:

     ```json
     {
       "id": "L-<NNN>",
       "title": "<short title derived from learning.md>",
       "classification": "L",
       "promoted": "<today's date in YYYY-MM-DD>",
       "origin": "<note's slug>",
       "body": "<full contents of note's learning.md, verbatim — post-Phase 4, learning.md is pure prose>",
       "rubric": [<expected_rubric criteria as an array of strings>, or null for `recurring` notes (panel skipped)]
     }
     ```

     The "short title" is the first line of `learning.md` if it
     reads as a title, or a 3–5 word distillation of the
     learning's first sentence otherwise.
  3. Write the updated array back to `learnings/rollup.json` via the
     Write tool.
  4. Move the session-note folder from
     `learnings/session-notes/<note>/` to
     `learnings/session-notes/archived/<note>/` via Bash.
  5. Mark this note's outcome as
     `"promoted as L-NNN on attempt N"` (or
     `"promoted as L-NNN (recurring, no panel)"` for the recurring
     branch) for the run summary.

**`DID_NOT_REPRODUCE`**:

1. Log a JSONL intervention via `operator-checks.ts
   log-intervention` with category `did_not_reproduce`, the
   note slug, attempt count, and the round tallies.
2. Move the session-note folder to `archived/`.
3. Mark this note's outcome as "skipped (did not reproduce)".

**`NO_CONSENSUS`**:

1. Already logged in B.6 — no additional log here.
2. Do **not** archive — the note is left in place for human
   review.
3. Mark this note's outcome as "escalated (no consensus)" for
   the run summary.

**`RUBRIC_TAMPERED`** or **`REWRITER_FAILED`** or **`TEST_SUBJECT_FAILED`**:

1. Already logged in B.1 / B.2 / B.3 — no additional log here.
2. Do **not** archive — the note is left in place for human
   review.
3. Mark this note's outcome as `escalated (<reason>)` (e.g.
   `escalated (rubric tampered)`).

**`STUCK_LEARNING`**:

1. Spawn `griot-operator` via the Agent tool with `model`
   matching `agents.operator.tier`. The brief contains:
   - Immutable rubric (`expected_rubric`).
   - Origin prompt (note's `prompt.md`).
   - Correction (note's `correction.md`).
   - Full `attempts_history`: for each attempt, the learning
     text that was tried and the per-judge verdicts (with
     pass/fail counts on control and treatment if available).
2. The operator's response ends with a fenced ` ```diagnosis `
   block containing JSON `{category, notes}` where category is
   one of:
   - `same_assertion_fails_every_attempt`
   - `different_assertions_fail_each_attempt`
   - `control_and_treatment_always_identical`
   - `other`
   Extract and parse the block.
3. Log a JSONL intervention via `operator-checks.ts
   log-intervention` with category `stuck_learning`, record
   shape `{note_slug, attempts_count: max_attempts, diagnosis:
   <parsed object>}`.
4. Do **not** archive — the note is left in place for human
   review.
5. Mark this note's outcome as
   `escalated (stuck: <diagnosis.category>)`.

### 3. Regression suite

After all session-notes are processed, re-run every existing
rollup entry through a single-judge pass-check to detect
regressions: entries that were passing in the prior run and now
fail. The check is intentionally lighter than the per-note
panel — one treatment generation plus one binary pass-check
per entry — to keep cost reasonable as the rollup grows.

If `learnings/rollup.json` is empty or missing, skip §3 entirely
(set the regression counters to 0 and `current_passing_ids` to
the empty set).

#### Step R.1 — Read prior passing set

Read the most recent line from `learnings/bench-history.jsonl`
(if the file exists). Parse it as JSON and extract the
`passing_ids` field (default empty array if missing or unparseable).
This `prior_passing_ids` set drives "new failure" detection.

If `learnings/bench-history.jsonl` does not exist, treat
`prior_passing_ids` as the empty set — every entry is "new" on
the first run, so no regression flags fire.

#### Step R.2 — Parse rollup

Read `learnings/rollup.json` via the Read tool and parse the array.
Each entry is already structured as
`{id, title, classification, promoted, origin, body, rubric, ...}`.
For each entry, capture `{id, origin_slug: entry.origin, rubric: entry.rubric}`.
The pre-Phase-4-rollup markdown-parse step is gone — the rollup is now
machine-format JSON.

Initialize counters: `regressions_passing = 0`,
`regressions_failing = 0`, `regressions_new = 0`. Initialize
`current_passing_ids` as an empty list. Initialize
`new_regression_records` as an empty list (used in §4).

#### Step R.3 — Per-entry pass check

Process entries serially (rate-limit hygiene; the rollup can
grow large). For each entry:

1. **Read the archived prompt.** Look for
   `learnings/session-notes/archived/<origin_slug>/prompt.md`.
   If it does not exist, skip this entry — it cannot be
   regression-tested without an origin prompt. Do not
   increment any counter; the entry simply doesn't appear in
   this run's regression record.

2. **Generate treatment with full rollup.** Spawn ONE
   `general-purpose` subagent with `model` matching
   `test_subject.tier`. System-style framing: `"You are
   Claude. Apply the validated learnings below where
   relevant: <stdout of `bin/griot use --as=llm`>"` (the CLI
   renders `rollup.json` to LLM prose; pipe its output into the
   framing). User prompt: the archived `prompt.md`. Capture the
   output as
   `treatment_output`. If the spawn errors or returns no
   text, log a JSONL intervention via
   `operator-checks.ts log-intervention` with category
   `regression_check_failed` and skip this entry.

3. **Run the pass check.** Spawn ONE `general-purpose`
   subagent with `model: opus` (the SDK pinned this to
   top-tier; we keep it). System-style framing:

   `"You evaluate whether a Claude output passes every
   assertion in a rubric. Binary judgement, no hedging. End
   your response with a fenced regression-check block
   containing JSON {all_pass: boolean, failed_assertions:
   string[], reasoning: string}."`

   User message contains the entry's rubric and the treatment
   output, clearly labelled. The subagent's response ends
   with a fenced ` ```regression-check ` block. Extract and
   parse the block. If extraction fails, log a JSONL
   intervention via `log-intervention` with category
   `regression_check_failed` (record includes `learning_id`)
   and skip this entry.

4. **Record the result.**
   - If `all_pass: true` → increment `regressions_passing`
     and add `id` to `current_passing_ids`.
   - If `all_pass: false`:
     - Increment `regressions_failing`.
     - If `id` was in `prior_passing_ids` → this is a new
       regression. Log a JSONL intervention via
       `operator-checks.ts log-intervention`:

       ```bash
       bin/griot operator-checks log-intervention <<'INPUT'
       {"log_path": "learnings/regressions.jsonl",
        "record": {
          "ts": "<ISO 8601 timestamp>",
          "category": "regression",
          "learning_id": "L-NNN",
          "failed_assertions": ["..."],
          "reasoning": "...",
          "was_passing_in_prior_run": true
        }}
       INPUT
       ```

       Increment `regressions_new` and append a summary
       record `{id, failed_count: <length>, reasoning}` to
       `new_regression_records` for §4.
     - If `id` was NOT in `prior_passing_ids` → chronic
       failure. Do NOT log (avoids per-run noise on entries
       that have never passed). The chronic failure still
       counts toward `regressions_failing`.

After all entries are processed, the regression counters and
`current_passing_ids` are ready for §4 (PR body) and §5
(bench-history append).

### 4. Compose nightly PR body

Compose a markdown blob synthesizing the run's results and emit
it to the user via the skill response. No file write — the
chat output is the delivery channel.

Blob shape (always include every section, with `(none)` in
empty lists for predictable structure):

```markdown
# Nightly /griot-compact run — <today's date YYYY-MM-DD>

## Run summary
- Notes processed: <N>
- Promoted: <N>
- Did not reproduce: <N>
- Escalated: <N> (stuck: <S>, rubric tampered: <T>, rewriter
  failed: <RF>, test subject failed: <TSF>, no consensus: <NC>)
- Rollup entries checked: <regressions_total>
  (passing: <regressions_passing>, failing:
  <regressions_failing>, new regressions: <regressions_new>)

## Promoted learnings
- L-NNN — "<short title>" (from <slug>) — attempt <M>
[...for each note marked promoted; or "(none)"]

## Escalations needing review
- <slug>: <reason>
[...for each escalation; or "(none)"]

## New regressions
- L-NNN — <count> failed assertions
[...for each entry in new_regression_records; or "(none)"]

## Run metadata
\`<bench-history record JSON, single line>\`
```

Where `regressions_total = regressions_passing +
regressions_failing` (entries successfully processed; entries
skipped for missing prompts are not counted). The
`bench-history record JSON` in the `## Run metadata` section
is the same record that §5 will append — it can be assembled
in working state here and reused.

After emitting the blob, add a one-line pointer below it:
"Copy the section above into a GitHub PR. Diagnosis detail is
in `learnings/operator-log.jsonl` and
`learnings/regressions.jsonl`."

### 5. End-of-run housekeeping

Append the run record to `learnings/bench-history.jsonl` via
`operator-checks.ts log-intervention`:

```bash
bin/griot operator-checks log-intervention <<'INPUT'
{"log_path": "learnings/bench-history.jsonl",
 "record": {
   "ts": "<ISO 8601 timestamp>",
   "notes_processed": <int>,
   "notes_promoted": <int>,
   "notes_did_not_reproduce": <int>,
   "notes_no_consensus": <int>,
   "notes_escalated": <int>,
   "regressions_total": <int>,
   "regressions_passing": <int>,
   "regressions_failing": <int>,
   "regressions_new": <int>,
   "passing_ids": ["L-001", "L-002", "..."],
   "run_kind": "compact"
 }}
INPUT
```

`notes_escalated` is the sum of `STUCK_LEARNING`,
`RUBRIC_TAMPERED`, `REWRITER_FAILED`, and
`TEST_SUBJECT_FAILED` outcomes. (`NO_CONSENSUS` has its own
counter.) `passing_ids` is the sorted array form of
`current_passing_ids` from §3 — the next run reads this field
to decide which failures are NEW vs chronic.

This append is the skill's last action. The PR body in §4 is
already in the user's chat; §5 just persists the record.

## Do not

- Do not invoke this skill automatically. The user triggers it.
- Do not edit `rubric.md` files post-write. They are immutable
  after `griot-rubric-author` writes them. Tampering is detected
  programmatically by `operator-checks.ts verify-rubric` between
  rewrite attempts; a tampered rubric exits the attempt loop and
  escalates.
- Do not skip the rubric integrity check on attempt > 1. The
  check is the only thing standing between the rewriter and
  rubric drift; bypassing it defeats the immutability guarantee.
- Do not hand-promote a learning to `rollup.json`. Only `IMPROVED`
  via the judge panel gets in. Round-1 unanimity OR round-2
  supermajority OR round-2 tiebreak — anything else does not
  promote.
- Do not append to `learnings/operator-log.jsonl` or
  `learnings/bench-history.jsonl` directly. Every JSONL write
  goes through `operator-checks.ts log-intervention`. No raw
  `>>` redirects, no `echo` to JSONL paths.
- Do not import `@anthropic-ai/sdk` or call the Anthropic API
  directly. The dependency was removed in Phase 3; the only path
  is pooled tokens via subagent dispatch.
- Do not iterate the attempt loop past
  `config.rewrite.max_attempts`. The loop's exit conditions are
  exhaustive: a final verdict at any attempt that isn't
  `UNCHANGED` or `REGRESSED` exits immediately;
  `UNCHANGED`/`REGRESSED` exits at `max_attempts` with
  `STUCK_LEARNING`.
- Do not skip the regression suite when `rollup.json` has entries.
  The pass-check is what detects model drift between runs; an
  empty rollup is the only valid skip condition.
- Do not log a chronic regression failure (a rollup entry that
  was failing the prior run and is still failing now). Only NEW
  failures — entries that flipped from passing to failing —
  warrant a record in `regressions.jsonl`. Chronic failures
  count toward `regressions_failing` but do not log.
- Do not write the nightly PR body to disk. The user's chat
  output is the delivery channel; persisting to a file is out
  of scope for this skill.
- Do not use the full 4-judge panel for regression checks. The
  regression suite uses a single `general-purpose` subagent for
  treatment generation and a single `general-purpose` subagent
  (opus tier) for the pass-check. The full panel is reserved
  for per-note judgement; using it for regression doubles+ the
  cost without proportional signal.

## After a successful run

The post-run summary is delivered via the skill response — copy-paste
into a GitHub PR. Trend / cost / judge-calibration reporting was
previously offered by the `/griot-report` wrapper skill, which was
removed in `substrate-cli` Phase 1 once `bin/griot` made the wrapping
unnecessary; future reporting can read `bench-history.jsonl` and
`operator-log.jsonl` directly.
