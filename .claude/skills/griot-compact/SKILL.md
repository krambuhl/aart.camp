---
name: griot-compact
description: >-
  Run the learnings validation pipeline using griot-* subagents. Bills
  against pooled Claude Code subscription tokens (no ANTHROPIC_API_KEY
  required). Use ONLY when explicitly invoked via /griot-compact.
  Processes every unprocessed session-note in learnings/session-notes/,
  runs the four-judge tier-based panel via parallel Agent calls,
  mediates consensus through .claude/scripts/griot/mediate-panel.ts,
  attempts up to config.rewrite.max_attempts rewrites on
  UNCHANGED/REGRESSED outcomes, and escalates stuck notes to
  griot-operator for diagnosis. All JSONL writes go through
  .claude/scripts/griot/operator-checks.ts log-intervention.
user-invocable: true
disable-model-invocation: true
allowed-tools: Read, Write, Bash, Agent
---

# Learnings Compact

Drive the learnings validation pipeline using griot-* subagents and
the deterministic helpers under `.claude/scripts/griot/`. The skill
itself is the orchestrator — there is no Node script delegating
orchestration. Each LLM call is a subagent spawn; each
parsing/tally/threshold step is a Bash invocation of a helper script;
each JSONL append is a Bash invocation of `operator-checks.ts
log-intervention`.

This skill is **idempotent**: if there are no unprocessed
session-notes AND `learnings/rollup.md` is empty or missing, it
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
- `.claude/scripts/griot/mediate-panel.ts` — pipes judge outputs
  through to get parsed verdicts, tally, threshold check,
  tier-split detection, tiebreak application.
- `.claude/scripts/griot/operator-checks.ts` — two modes:
  `verify-rubric` (rubric tampering detection, called between
  rewrite attempts) and `log-intervention` (sole writer for all
  JSONL appends in this pipeline: `operator-log.jsonl` and
  `bench-history.jsonl`).

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
3. If there are no unprocessed notes AND `learnings/rollup.md` is
   empty or missing, tell the user "nothing to compact" and stop.
4. Otherwise echo the list of unprocessed notes to the user, then
   proceed.

### 2. Per-note pipeline

For each unprocessed session-note (folder under
`learnings/session-notes/`), run the steps below in order. Process
notes serially; the parallelism is within each note's panel rounds,
not across notes.

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
node .claude/scripts/griot/operator-checks.ts verify-rubric <<'INPUT'
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
`.claude/scripts/griot/mediate-panel.ts` via Bash with stdin
JSON:

```bash
node .claude/scripts/griot/mediate-panel.ts <<'INPUT'
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

1. Generate the next `learning_id`. Read `learnings/rollup.md`
   (if it exists) and find the maximum existing `L-NNN` ID; the
   new ID is one more, zero-padded to three digits. If
   `rollup.md` does not exist, the first ID is `L-001`.
2. Append a new entry to `learnings/rollup.md` (creating the
   file if needed, preserving any existing content). Entry
   shape:

   ```
   ## L-<NNN>: <short title derived from learning.md>

   Promoted: <today's date in YYYY-MM-DD>
   Origin: <note's slug>

   ### Learning

   <full contents of note's learning.md>

   ### Rubric

   <full contents of expected_rubric>
   ```

   The "short title" is the first line of `learning.md` if it
   reads as a title, or a 3–5 word distillation of the
   learning's first sentence otherwise.
3. Move the session-note folder from
   `learnings/session-notes/<note>/` to
   `learnings/session-notes/archived/<note>/` via Bash.
4. Mark this note's outcome as
   "promoted as L-NNN on attempt N" for the run summary.

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

### 3. End-of-run

After all notes are processed:

1. Append a JSONL line to `learnings/bench-history.jsonl` via
   `operator-checks.ts log-intervention`:

   ```bash
   node .claude/scripts/griot/operator-checks.ts log-intervention <<'INPUT'
   {"log_path": "learnings/bench-history.jsonl",
    "record": {
      "ts": "<ISO 8601 timestamp>",
      "notes_processed": <int>,
      "notes_promoted": <int>,
      "notes_did_not_reproduce": <int>,
      "notes_no_consensus": <int>,
      "notes_escalated": <int>,
      "run_kind": "compact"
    }}
   INPUT
   ```

   `notes_escalated` is the sum of `STUCK_LEARNING`,
   `RUBRIC_TAMPERED`, `REWRITER_FAILED`, and
   `TEST_SUBJECT_FAILED` outcomes. (`NO_CONSENSUS` has its own
   counter.)

2. Show the user a one-paragraph run summary listing each
   note's outcome. Include counts by category. For escalated
   notes, name the specific reason
   (`stuck (<diagnosis.category>)`, `rubric tampered`,
   `rewriter failed`, `test subject failed`, `no consensus`).

3. Tell the user where to look for diagnosis detail:
   `learnings/operator-log.jsonl` has one record per
   intervention. Promoted notes are in `learnings/rollup.md`
   under the new `L-NNN` IDs.

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
- Do not hand-promote a learning to `rollup.md`. Only `IMPROVED`
  via the judge panel gets in. Round-1 unanimity OR round-2
  supermajority OR round-2 tiebreak — anything else does not
  promote.
- Do not append to `learnings/operator-log.jsonl` or
  `learnings/bench-history.jsonl` directly. Every JSONL write
  goes through `operator-checks.ts log-intervention`. No raw
  `>>` redirects, no `echo` to JSONL paths.
- Do not call `npm run learnings:compact`. The Node script's
  config-load is broken (it expects the old version-pinned
  config); Phase 3 deletes the script entirely. The skill is the
  pipeline now.
- Do not import `@anthropic-ai/sdk` or call the Anthropic API
  directly. Pooled tokens via subagent dispatch only.
- Do not iterate the attempt loop past
  `config.rewrite.max_attempts`. The loop's exit conditions are
  exhaustive: a final verdict at any attempt that isn't
  `UNCHANGED` or `REGRESSED` exits immediately;
  `UNCHANGED`/`REGRESSED` exits at `max_attempts` with
  `STUCK_LEARNING`.

## After a successful run

If `/griot-report` exists in the repo, remind the user it gives a
one-pager on trend, cost, and judge calibration. They can skim that
between runs to see how `corrections_per_session` is moving.
