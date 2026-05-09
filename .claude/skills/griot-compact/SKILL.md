---
name: griot-compact
description: >-
  Run the learnings validation pipeline using griot-* subagents. Bills
  against pooled Claude Code subscription tokens (no ANTHROPIC_API_KEY
  required). Use ONLY when explicitly invoked via /griot-compact.
  Processes every unprocessed session-note in learnings/session-notes/,
  runs the four-judge tier-based panel via parallel Agent calls,
  mediates consensus through .claude/scripts/griot/mediate-panel.ts,
  promotes IMPROVED learnings to rollup.md, and archives notes that
  reached DID_NOT_REPRODUCE. UNCHANGED/REGRESSED outcomes are
  surfaced as deferred (the rewrite loop arrives in Phase 2 D2).
user-invocable: true
disable-model-invocation: true
allowed-tools: Read, Write, Bash, Agent
---

# Learnings Compact

Drive the learnings validation pipeline using griot-* subagents and
the deterministic helpers under `.claude/scripts/griot/`. The skill
itself is the orchestrator — there is no Node script delegating
orchestration. Each LLM call is a subagent spawn; each
parsing/tally/threshold step is a Bash invocation of a helper script.

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
  `griot-debate-summarizer`, `griot-operator` (used in D2 only),
  `griot-rewriter` (used in D2 only).
- Tier-based config in `learnings/config.yaml`.
- `.claude/scripts/griot/mediate-panel.ts` — pipes judge outputs
  through to get parsed verdicts, tally, threshold check,
  tier-split detection, tiebreak application.
- `.claude/scripts/griot/operator-checks.ts` — used in D2 for
  rubric tampering detection and intervention logging. Not yet
  invoked from this skill.

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

#### Step A — Rubric

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
array shape), append a JSONL line to
`learnings/operator-log.jsonl` with category `rubric_author_failed`
and stop processing this note.

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
`expected_rubric` for the rest of this note's pipeline. D2 will use
this for tampering detection via `operator-checks.ts`.

#### Step B — Generate control + treatment

In a single tool-use message, spawn two `general-purpose` subagents
in parallel, both with `model` matching `test_subject.tier`:

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

If either subagent errors or returns no usable text, append a JSONL
line to `learnings/operator-log.jsonl` with category
`test_subject_failed`, the note slug, and the error text. Stop
processing this note.

#### Step C — Round 1 panel

In a single tool-use message, spawn 4 `griot-judge` subagents in
parallel — one per entry in the `judges` array. Each spawn's `model`
parameter matches that judge's `tier`.

The brief for each judge contains, in this order:

- Origin prompt (note's `prompt.md`)
- Correction (note's `correction.md`)
- Candidate learning (note's `learning.md`)
- Rubric (the `expected_rubric` captured in Step A)
- Control output (from Step B)
- Treatment output (from Step B)

The judge's response ends with a fenced ` ```verdict ` block.
Capture each judge's full text as `raw_output[i]`, paired with
`judges[i].id` and `judges[i].tier`, preserving order.

#### Step D — Mediate round 1

Pipe the four raw outputs through
`.claude/scripts/griot/mediate-panel.ts` via Bash with stdin JSON.
The input shape (see the script's contract for details):

```json
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
```

Use a heredoc with quoted delimiter to pass the JSON through Bash
without shell interpolation:

```bash
node .claude/scripts/griot/mediate-panel.ts <<'INPUT'
{ ... full JSON above ... }
INPUT
```

Parse the JSON output. If `threshold_met` is `true`, the panel
reached unanimity (4/4) — proceed directly to Step F using
`consensus_verdict` as the verdict for this note.

If `threshold_met` is `false`, continue to Step E.

#### Step E — Round 2 panel (only when round 1 didn't reach unanimity)

1. Spawn `griot-debate-summarizer` with `model` matching
   `agents.debate_summarizer.tier`. The brief contains:
   - The round number that just completed (1).
   - For each non-errored judge from round 1: their `judge_id`,
     `tier`, `verdict`, and `reasoning` text.
   The summarizer's response ends with a fenced ` ```summary `
   block. Extract the summary text.

2. Spawn 4 `griot-judge` subagents again (same as Step C), but
   append the summary to each judge's brief under a clearly-
   delimited "## Other judges' reasoning from the previous
   round" section. Each judge re-evaluates with full knowledge
   of the prior round's positions.

3. Pipe the round 2 outputs through `mediate-panel.ts` with
   `round_num: 2`.

4. Branch on the result:
   - `threshold_met == true` → consensus is `consensus_verdict`.
     Proceed to Step F.
   - `threshold_met == false` AND `tiebreak_applied == true` →
     consensus is `tiebreak_verdict`. Proceed to Step F.
   - `threshold_met == false` AND `tiebreak_applied == false` →
     no consensus and no tiebreak fired. Append a JSONL line to
     `learnings/operator-log.jsonl` with category `no_consensus`,
     the note slug, and both rounds' tallies. Skip this note.
     Increment the run summary's `no_consensus` counter.

#### Step F — Outcome handling

Branch on the verdict reached in Step D or E.

**`IMPROVED`**:

1. Generate the next `learning_id`. Read `learnings/rollup.md` (if
   it exists) and find the maximum existing `L-NNN` ID; the new ID
   is one more, zero-padded to three digits. If `rollup.md` does
   not exist, the first ID is `L-001`.
2. Append a new entry to `learnings/rollup.md` (creating the file
   if needed, preserving any existing content). Entry shape:

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
   reads as a title, or a 3–5 word distillation of the learning's
   first sentence otherwise.
3. Move the session-note folder from
   `learnings/session-notes/<note>/` to
   `learnings/session-notes/archived/<note>/` via Bash.
4. Mark this note's outcome as "promoted as L-NNN" for the run
   summary.

**`DID_NOT_REPRODUCE`**:

1. Append a JSONL line to `learnings/operator-log.jsonl` with
   category `did_not_reproduce`, the note slug, and the round
   tallies.
2. Move the session-note folder to `archived/`.
3. Mark this note's outcome as "skipped (did not reproduce)".

**`UNCHANGED` or `REGRESSED`**:

1. Append a JSONL line to `learnings/operator-log.jsonl` with
   category `deferred_pending_rewrite_loop`, the note slug, and
   the round tallies.
2. Do **not** archive — D2 will pick this note up when the
   rewrite loop ships.
3. Mark this note's outcome as "deferred (rewrite loop pending)"
   for the run summary.

### 3. End-of-run

After all notes are processed:

1. Append a JSONL line to `learnings/bench-history.jsonl` with
   shape:

   ```json
   {
     "ts": "<ISO 8601 timestamp>",
     "notes_processed": <int>,
     "notes_promoted": <int>,
     "notes_did_not_reproduce": <int>,
     "notes_deferred": <int>,
     "notes_no_consensus": <int>,
     "run_kind": "compact-skeleton"
   }
   ```

   `run_kind: "compact-skeleton"` is forward-compat — D2 will
   change it to `"compact"` once the rewrite loop is in.

2. Show the user a one-paragraph run summary listing each note's
   outcome. Include counts by category.

3. Tell the user explicitly: _"The rewrite loop is not yet
   implemented; deferred notes will be picked up in Phase 2 D2.
   Other outcomes (promoted, archived, no_consensus) have already
   been written."_

## Do not

- Do not invoke this skill automatically. The user triggers it.
- Do not edit `rubric.md` files post-write. They are immutable
  after `griot-rubric-author` writes them. Phase 2 D2 will add a
  programmatic check via `operator-checks.ts verify-rubric`; for
  now, the immutability is honor-system.
- Do not hand-promote a learning to `rollup.md`. Only `IMPROVED`
  via the judge panel gets in. Round-1 unanimity OR round-2
  supermajority OR round-2 tiebreak — anything else does not
  promote.
- Do not modify `learnings/bench-history.jsonl` by hand. The
  skill appends one line per run; that is its sole writer.
- Do not call `npm run learnings:compact`. The Node script's
  config-load is broken (it expects the old version-pinned
  config); Phase 3 deletes the script entirely. The skill is the
  pipeline now.
- Do not import `@anthropic-ai/sdk` or call the Anthropic API
  directly. Pooled tokens via subagent dispatch only.

## After a successful run

If `/griot-report` exists in the repo, remind the user it gives a
one-pager on trend, cost, and judge calibration. They can skim that
between runs to see how `corrections_per_session` is moving.
