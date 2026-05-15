---
name: ev-loop-interactive
description: >-
  Execution loop for human-paired work. Runs a phase as a sequence
  of deliverables, each with its own unit contract and evaluator
  checkpoint. Supports sequential (ordered) and free (user picks next)
  deliverable ordering. Composes /trout-* primitives; composes no
  other loop. Use when a phase is exploratory, creative, or otherwise
  not a bulk transform.
argument-hint: "<project-slug-or-path> <phase-number>"
allowed-tools: Read, Write, Edit, Bash, Agent, Skill
---

# /ev-loop-interactive

Execute one phase of a project as a human-paired loop: discrete
deliverables, per-deliverable contract and checkpoint. The human drives
order when ordering is free; the loop keeps the substrate honest.

**Composes**: `.claude/scripts/trout/autosave.ts`,
`.claude/scripts/trout/autoload.ts` (both via Bash),
`/trout-pull-request`, `/guild-validate`.
**Does not compose**: other loops.

**Format reference**: `projects/CONVENTIONS.md` (repo-relative).

Skill invocations like `/trout-pull-request` and `/guild-validate` below
mean `Skill(skill: <name>, args: "…")` — the Skill tool is how loops
compose substrate skills. Script invocations like
`.claude/scripts/trout/autosave.ts` mean
`Bash("node .claude/scripts/trout/autosave.ts <args>")`. Antagonist
evaluation runs through `/guild-validate`, which spawns evaluator agents
in parallel via `/guild-spawn`; the loop itself never calls the `Agent`
tool directly.

## Arguments

- `<project-slug-or-path>` — resolved like `.claude/scripts/trout/autosave.ts`
  (exact slug → suffix match → full path). If missing or unresolved,
  stop and ask the user for the project.
- `<phase-number>` — which phase to run. If missing, default to the
  next non-`completed` phase from MANIFEST.md and confirm with the
  user before proceeding. If the named phase is already `completed`,
  stop and ask whether to re-run or pick a different phase.

## Ordering

Read the phase entry in PLAN.md to determine ordering:

- **Sequential** — deliverables are numbered and must run in order.
  The loop picks the next one automatically.
- **Free** — deliverables are a set. The loop presents them and asks
  the user to pick.

If PLAN.md doesn't specify, default to **free** and ask.

## Phase-level process

### Whiteboard (opt-in)

If the phase entry in PLAN.md declares a `**Whiteboard**:` block, run a
multi-engineer design pass **once before Step 1** (deliverable
enumeration). The whiteboard output becomes shared reference material
for every unit in the phase (cited in each unit's contract `Inputs:`
line).

**Phase config format** (in PLAN.md, immediately under the phase's
prose):

```
**Whiteboard**: engineers=<comma-separated names>; topic=<one-line topic>; rounds=<N>
```

Where `engineers` is a comma-separated list of `whiteboard-*`
`subagent_type` names, `topic` is the design question being explored
(used as the whiteboard file's header), and `rounds` is the number of
rounds to run (typically 1 or 2; round 2 lets engineers address
round-1 contradictions).

**Whiteboard artifact path**:
`projects/<slug>/whiteboards/<phase-number>-<topic-slug>.md`. Create
the parent directory if it doesn't exist.

**Per-round invocation**: for each round 1..N, invoke
`/guild-whiteboard` via the `Skill` tool with `engineers=<list>`,
`brief=<topic + any phase context>`, `whiteboard=<path>`. The skill
auto-detects round number from existing file state, so re-running is
idempotent (a re-invocation with the same whiteboard file detects
existing rounds and appends a NEW round). For round 2+, the skill
constructs `per_agent_context` from prior round state so engineers
can address contradictions.

**L-004 session-boundary**: if any of the named `whiteboard-*`
engineers were authored in the current session, drop them from the
`engineers=` list manually and surface the override in the next
unit's checkin Notes for the PR. The runtime registry is loaded once
per Claude Code process start; `/clear` is NOT a session boundary.

**Skipping**: if no `**Whiteboard**:` block is present in the phase
entry, skip this step entirely and proceed directly to Step 0.

### Step 0. Pre-flight

- `Bash("node .claude/scripts/trout/autoload.ts <slug>")` to refresh state.
- Working tree clean, branch matches MANIFEST, verification baseline.

### Step 1. Enumerate deliverables

Parse the phase's deliverables from PLAN.md. Each deliverable becomes
one unit. If the phase names 5 deliverables, you expect 5 checkins.

Show the list to the user with status markers (done, in-progress, not
started) pulled from existing checkins on this branch.

### Step 2. Unit loop

For each deliverable (picked per the ordering rule):

1. **Negotiate.** Draft the unit contract for this deliverable and
   write it into a new numbered checkin (Contract section only). Show
   the contract to the user for approval before execution. The human is
   in the loop — they should see what you agreed to.
2. **Execute.** Do the work. For creative or exploratory deliverables,
   pair with the user — ask when you hit a fork, report when you hit a
   dead end, don't charge ahead.
3. **Evaluate.** Invoke `/guild-validate` via the `Skill` tool to run
   the antagonist panel against this unit. Compose the panel by
   auto-derivation from the unit's file list (see § Panel
   auto-derivation below) — the result is contextual to the artifact
   rather than a fixed list. `evaluator-contract-fit` is always
   included as the baseline. The spec (file-type → evaluator mapping,
   precedence list, tokens-vs-naming boundary) lives in
   `.claude/agents/PANEL-COMPOSITION.md`; the derivation logic is
   `.claude/scripts/guild/derive-panel.ts`.
   - `agents`: comma-separated output of
     `node .claude/scripts/guild/derive-panel.ts --files=<paths>`
     (see § Panel auto-derivation for `<paths>` composition).
   - `packet`: build a **dense packet** (see shape below). The substrate
     default is dense — verbose packets correlate with budget-exhaustion
     failures under `evaluator-*`'s `maxTurns=5`. Live examples in
     PR #13's checkins 02-06.

   **Dense packet shape** (three sections, in this order):

   ```
   ## How to evaluate efficiently

   You have a tight tool-use budget (maxTurns=5). Pre-computed
   verification below is authoritative — do not re-run lint/build/
   test/grep unless you find specific evidence the artifact summary
   contradicts itself. Spot-check at most ONE or TWO criteria with
   targeted reads, then emit `VERDICT:`. If you cannot reach a verdict
   within budget, emit `VERDICT: flagged` with `parse-failure:
   budget-exhausted` so the loop escalates rather than no-ops.

   ## Contract (paraphrased)

   <Goal in 1-3 sentences. Acceptance criteria as a numbered list,
   condensed (full text in <checkin path>). Disqualifiers as a
   single-line summary. Inputs as a bulleted list of paths.>

   ## Artifact

   **Files** (created/modified/deleted): <bulleted paths>

   **Pre-computed verification (authoritative — do not re-run)**:
   - `npm run lint` → <result>
   - `npm run build` → <result>
   - `npm run test` → <result>
   - <other verification: grep results, smoke test outputs, etc.>

   **Direct mappings to acceptance criteria** (for spot-check
   efficiency): <AC N → file:line ranges or section pointers>

   **Iteration story** (if applicable): <prior panel runs and what
   was addressed; helps the evaluator avoid re-flagging fixed issues>

   ## Original ask

   <verbatim from PLAN.md or the triggering message>

   ## Suggested spot-check (one tool use)

   <the most efficient single read for confirming the most-suspicious
   criterion; optional but reduces investigation thrashing>
   ```

   Pass the contract as a paraphrased summary plus the checkin file
   path link, not verbatim — the checkin file is in the repo and
   renders one click away. The packet's job is orientation; the depth
   is one click away.

   The skill returns a structured verdict (`approved` | `flagged` |
   `flagged-conflict`) with `blocking_findings`, `advisory_findings`,
   `cli_runs`, and `conflicts` lists. See
   `.claude/agents/evaluator-base.md` for the per-evaluator verdict
   shape that `/guild-validate` parses and aggregates.
4. **Iterate or commit.**
   - Flagged: address the specific reasons, re-invoke `/guild-validate`.
     Up to 2 retries (3 panel runs total).
   - Approved: finalize the checkin.
5. **Autosave.** `Bash("node .claude/scripts/trout/autosave.ts <slug> --event=checkin-created --detail='<NN> on <branch>' --phase-update=<N>:in-progress:branch=<branch>:checkin=<NN>")`.
6. **Checkpoint.** Free mode: after every deliverable. Sequential mode:
   after every deliverable **or** when the human explicitly asks.
   Invoke `/trout-pull-request <slug> <branch>`.

### Panel auto-derivation

The `agents` list passed to `/guild-validate` is computed from the
unit's file list at evaluation time, not hardcoded. The composition
rules (file-type → evaluator mapping, precedence ordering, conflict
policy) live in `.claude/agents/PANEL-COMPOSITION.md` and are the
source of truth.

1. **Collect file paths.** Take the unit's changed and created files.
   Practical recipe: `git status --short` minus any deletions, minus
   the carryover stash file (typically `MANIFEST.md` from a prior
   reconcile), plus any freshly-authored untracked paths that will
   land in the artifact commit. Substrate-only mutations
   (`projects/<slug>/MANIFEST.md` reconcile events) generally should
   be excluded — they shipped in the prelude commit and don't
   represent the unit's artifact.
2. **Derive the panel.** Run
   `node .claude/scripts/guild/derive-panel.ts --files=<comma-
   separated paths>`. The script prints a comma-separated list of
   `subagent_type` names on stdout, precedence-ordered, with
   `evaluator-contract-fit` always first.
3. **Pass to `/guild-validate`.** Use the script's stdout as the
   `agents=` argument verbatim. The skill body composes the dense
   packet as before; only the `agents` list changes.

Edge cases the script handles, documented for reviewer awareness:

- **Empty file list** (substrate-only unit, no artifact files yet) →
  `evaluator-contract-fit`. Same single-evaluator behavior as before
  D7's auto-derivation landed.
- **Substrate-only files** (`.claude/agents/*.md`, skill `SKILL.md`,
  checkin `*.md`, `projects/**/{MANIFEST,PLAN}.md`) → contract-fit
  only. Domain evaluators don't apply to agent definitions, skill
  bodies, or project artifacts.
- **Substrate scripts** (`.claude/scripts/**/*.ts`) → contract-fit
  + naming. Script identifiers are public-API surface for substrate
  consumers.
- **L-004 session-boundary constraint.** A newly-authored evaluator
  agent that didn't exist at session start is registered as of next
  session start. If the derive-panel output includes such an
  evaluator AND that evaluator was added during this session, drop
  it from the `agents=` list manually and note the manual override
  in the checkin's `Notes for the PR` section. The script does NOT
  know which evaluators are session-cached vs newly-authored; that
  metadata is the caller's responsibility.

### Step 3. Phase close

- All deliverables accounted for.
- Full verification passes.
- `/trout-pull-request` is fresh.
- `Bash("node .claude/scripts/trout/autosave.ts <slug> --event=phase-completed --detail=<N> --phase-update=<N>:completed")`.

## Output format

After each checkpoint and at phase close, report:

```
Phase <N> — <title>
Deliverables: <done>/<total>  (list with status)
Last checkin: <path>
PR: <url or "not yet opened">
Next: <deliverable name, or "phase complete">
```

## Message-driven redirects

Trigger: if the caller's message (from the router) contains a pattern
like `address feedback on #<pr>` while this loop is active on that PR's
branch, branch into the flow below instead of continuing the normal
unit loop.

For "address feedback on #N":
1. `/trout-pr-respond <slug> <pr>` → plan.
2. Each Blocker becomes a new unit.
3. Run the unit loop. Re-checkpoint when done.

## Rules

- **The human co-pilots.** Don't write long stretches without pausing.
  If a unit spans more than ~3 files or ~200 lines of new/changed code
  without a natural pause, split it.
- **Contract before execution.** Always. Even if the deliverable feels
  small.
- **Evaluator always runs.** Same as the confidence loop — never
  self-approve. Evaluator budget is 3 runs per unit (initial + 2
  retries); on the third flag escalate to the user.
- **Scope discipline.** One deliverable at a time in a given checkin.
- **Record corrections in the checkin.** If the user redirects a unit
  mid-flight, overrides a decision, or the evaluator flags something
  the generator defaulted to incorrectly, note it verbatim in the
  checkin's "Notes for the PR" section with a `correction:` prefix.
  `/trout-save-session` captures every such line to
  `learnings/session-notes/` via
  `Bash("node .claude/scripts/griot/capture.ts --from-checkin=...")`
  at end of session; `/griot-compact` decides which get promoted.
  The loop itself never writes to `learnings/`.
- **No emojis.**

## Failure modes

- User goes quiet mid-deliverable → stop, checkpoint whatever is safe,
  save a session handoff.
- Evaluator flags 3× → escalate to user.
- Working tree dirty → stop.
