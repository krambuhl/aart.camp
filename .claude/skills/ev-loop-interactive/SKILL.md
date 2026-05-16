---
name: ev-loop-interactive
description: >-
  Execution loop for human-paired work. Runs a phase as a sequence
  of deliverables, each with its own unit contract and evaluator
  checkpoint. Supports sequential (ordered) and free (user picks next)
  deliverable ordering. Dispatches to bin/loom and bin/draft CLIs
  directly; composes /guild-validate; composes no other loop. Use when
  a phase is exploratory, creative, or otherwise not a bulk transform.
argument-hint: "<project-slug-or-path> <phase-number>"
user-invocable: true
allowed-tools: Read, Write, Edit, Bash, Agent, Skill
---

# /ev-loop-interactive

Execute one phase of a project as a human-paired loop: discrete
deliverables, per-deliverable contract and checkpoint. The human drives
order when ordering is free; the loop keeps the substrate honest.

**Composes**: `bin/loom` and `bin/draft` CLIs (via Bash) for substrate
operations; `/guild-validate` (via the Skill tool) for the antagonist
panel.
**Does not compose**: other loops. No ambient `/loom-*` or
`/draft-revise` skills — substrate plumbing dispatches directly to the
CLIs (see § Substrate compositions).

**Format reference**: `projects/LOOM-CONVENTIONS.md` (repo-relative).

Skill invocations like `/guild-validate` below mean
`Skill(skill: <name>, args: "…")`. CLI invocations like
`bin/loom phase update` mean `Bash("bin/loom phase update <args>")`.
Antagonist evaluation runs through `/guild-validate`, which spawns
evaluator agents in parallel via `/guild-spawn`; the loop itself never
calls the `Agent` tool directly.

## Substrate compositions

Every substrate operation this loop performs dispatches directly to
`bin/loom`, `bin/draft`, `bin/griot`, or `bin/guild` — no ambient
skills, no trout scripts. The unit loop steps below cite recipes by
name (e.g. "checkpoint per § Compose PR"). All `§ <Recipe>` references
in this body resolve in `projects/SUBSTRATE-COMPOSITIONS.md`. For loom
verb shapes and event vocabulary, see `projects/LOOM-CONVENTIONS.md`.

## Arguments

- `<project-slug-or-path>` — resolved by loom's standard slug resolution
  (full slug → date-less suffix → relative or absolute path). If missing
  or unresolved, stop and ask the user for the project.
- `<phase-number>` — which phase to run. If missing, default to the
  next non-`completed` phase from the manifest and confirm with the user
  before proceeding. If the named phase is already `completed`, stop
  and ask whether to re-run or pick a different phase.

## Ordering

Read the phase entry in PLAN.md to determine ordering:

- **Sequential** — deliverables are numbered and must run in order.
  The loop picks the next one automatically.
- **Free** — deliverables are a set. The loop presents them and asks
  the user to pick.

If PLAN.md doesn't specify, default to **free** and ask.

## Phase-level process

### Whiteboard

Every phase runs a multi-engineer design pass **once before Step 1**
(deliverable enumeration). The whiteboard output becomes shared
reference material for every unit in the phase (cited in each unit's
contract `Inputs:` line). This step is **always-on**: the loop
invokes `/guild-whiteboard` at phase start regardless of explicit
configuration; an optional PLAN.md block overrides defaults.

**Default behavior** (no `**Whiteboard**:` block in PLAN.md):
- `engineers` = all currently registered `whiteboard-*` agents,
  resolved via glob of `.claude/agents/whiteboard-*.md`.
- `topic` = the phase name (e.g. "Whiteboard mechanism + engineers"
  for Phase 3).
- `rounds` = 1.

**Override** — optional PLAN.md block, placed immediately under the
phase's prose paragraph:

```
**Whiteboard**: engineers=<comma-separated names>; topic=<one-line topic>; rounds=<N>
```

Any field in the block overrides the corresponding default. Partial
blocks are allowed (e.g. only `topic=` overrides the topic; engineers
and rounds keep their defaults).

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

**Bootstrapping case (no engineers registered)**: if the
`.claude/agents/whiteboard-*.md` glob returns zero matches AND no
explicit `engineers=` override is given, log a one-line note ("no
whiteboard engineers registered — skipping whiteboard step") and
proceed directly to Step 0. This is the case for any phase running
before the engineer roster ships.

**L-004 session-boundary**: if any of the resolved `whiteboard-*`
engineers were authored in the current session, drop them from the
effective list manually and surface the override in the next unit's
checkin Notes for the PR. The runtime registry is loaded once per
Claude Code process start; `/clear` is NOT a session boundary.

### Step 0. Pre-flight

- Refresh state per § State refresh.
- Working tree clean, branch matches the manifest's current branch,
  verification baseline.

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
   `bin/guild derive-panel`.
   - `agents`: comma-separated output of § Derive panel (paths
     composed per § Panel auto-derivation below).
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
   - Approved: continue to step 4.5 (findings append + threshold)
     and step 5 (scope-shift detection), then finalize the checkin.
4.5. **Append findings + detect recurring threshold.** On approved
     verdict (and ONLY on approved — flagged findings that get
     addressed in iterations do NOT count toward the recurring counter;
     we count what landed in the substrate, not what was caught and
     fixed):

     For each entry in the verdict's `blocking_findings` AND
     `advisory_findings` lists:

     a. Append the finding per § Append finding with severity from
        the finding's list (`blocking` | `advisory`). Pass
        `--branch=<branch>` and `--unit=<NN>` so the entry is
        attributable; the recipe documents the quote-safety caveat.

     b. Query the recurring threshold for this finding's signature
        via § Append finding (the `count` subverb). The verb writes a
        single integer to stdout.

     c. **If the count is ≥ 3** (the recurring threshold for this
        SKILL — hardcoded; configurability is post-Phase-5), append
        a `correction:` line to this checkin's `## Notes for the PR`
        section in the shape:

        ```
        - correction: recurring evaluator finding — `<evaluator>` flagged `<code>` on <count> occurrences. Evidence: <evidence>. Avoid this pattern.
        ```

        Threshold-triggered corrections feed into session close
        (§ Save session) → § Capture finding (recurring pathway) at
        session boundary, no manual intervention. The loop does not
        invoke the verb directly here; capture happens at session
        close.

     d. Generator-antipattern detection is NOT done here. That
        classification requires human judgment about whether the
        generator output represents a recurring shape, not just
        whether an evaluator flagged it. A specialist evaluator's
        `Notes for the PR` may explicitly call out a generator
        antipattern; that's the channel for D2 to wire through.

     Skip step 4.5 entirely for substrate-only units whose panel had
     no domain findings (every finding was a `parse-failure` from
     `evaluator-contract-fit` against the contract itself, not against
     an artifact). The frequency counter is for evaluator findings
     about real artifacts, not contract-shape issues.
5. **Scope-shift detection (restrictive default).** Runs only on
   approved units (flagged-and-iterating units skip this step). Look
   for signals that PLAN.md is stale; offer a plan revision (per
   § Revise PLAN.md) ONLY on two-signal concurrence.

   **Signal sources**:
   - **Evaluator finding** mentioning a missing or changed phase,
     deliverable, or load-bearing decision (in either blocking or
     advisory findings).
   - **User comment during the unit** that proposed a change to
     plan structure (not just tactical refinement of this unit's
     contract).
   - **Whiteboard contradiction** (round 2+ whiteboard surfaces a
     disagreement between engineers that current PLAN doesn't
     resolve).
   - **Phase boundary** (this unit is the last in its phase OR
     the next phase is about to start).

   **Two-signal-concurrence rule**: offer a plan revision only when 2+
   signal sources fire for the same shift. Single signals get a note
   (see below); the loop does NOT interrupt.

   **Offer flow**: surface a short paragraph naming the two signals
   and a proposed one-line rationale. Use `AskUserQuestion` (or
   natural-language confirm) for accept/decline/defer. Default: decline
   (no interrupt unless the user explicitly accepts).

   **On accept**: integrate the change per § Revise PLAN.md. After the
   revision lands, proceed to step 6 (Phase update). Do not re-execute
   the unit.

   **On single signal** (no concurrence): append the signal to the
   unit's `notes_for_pr` array in the checkin JSON:
   ```
   signal: <signal type>: <one-line description> (single signal; no revise offered)
   ```
   Loop continues normally.

   **On zero signals**: no action. Loop continues.

6. **Phase update.** After a checkin lands, the checkin-created event
   auto-fires from § Checkin write. Then update phase state per
   § Phase update with `--status=in-progress --branch=<branch>` (the
   PR reference is set later when § Compose PR runs).
7. **Checkpoint.** Free mode: after every deliverable. Sequential mode:
   after every deliverable **or** when the human explicitly asks.
   Refresh the PR per § Compose PR.

### Panel auto-derivation

The `agents` list passed to `/guild-validate` is computed from the
unit's file list at evaluation time, not hardcoded. The composition
rules (file-type → evaluator mapping, precedence ordering, conflict
policy) live in `.claude/agents/PANEL-COMPOSITION.md` and are the
source of truth.

1. **Collect file paths.** Take the unit's changed and created files.
   Practical recipe: `git status --short` minus any deletions, plus
   any freshly-authored untracked paths that will land in the artifact
   commit. Substrate-only mutations (`projects/<slug>/manifest.json`
   or `events.jsonl` updates auto-written by `bin/loom` verbs)
   generally should be excluded — they shipped via the substrate
   itself, not as the unit's artifact.
2. **Derive the panel** per § Derive panel, passing the file paths
   from step 1. Use the verb's stdout as the `agents=` argument
   verbatim.
3. **Pass to `/guild-validate`.** Use the verb's stdout as the
   `agents=` argument verbatim. The skill body composes the dense
   packet as before; only the `agents` list changes.

Edge cases the verb handles, documented for reviewer awareness:

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

### Specialist-evaluator gate-then-review (Phase 4)

When a unit's panel includes a **specialist evaluator** paired with
a `generator-*` agent (e.g. `evaluator-css-architecture` paired with
`generator-css-codemod`), the specialist runs as part of the
parallel panel — its verdict participates with **elevated
precedence** per `.claude/agents/PANEL-COMPOSITION.md`. **No
control-flow change** to the loop is needed: the existing
parallel-spawn + precedence-resolution mechanism carries it.

The substrate signal worth honoring is **fail-fast on specialist
rejection**: when the aggregated panel verdict shows a specialist's
finding in `blocking_findings`, treat that as a stronger
re-iterate-or-flag signal than a generic evaluator's blocking
finding. Concretely: if a unit's specialist evaluator flagged but
other evaluators approved, do not treat the overall verdict as
`approved` — the specialist's blocking finding stands. The loop's
verdict-handling already does this (any blocking finding → flagged);
this section just documents the *why* in case future loops want
specialist-specific retry budgets or escalation thresholds.

### Step 3. Phase close

- All deliverables accounted for.
- Full verification passes.
- Refresh the PR per § Compose PR so it reflects the final state.
- Update the phase per § Phase update with `--status=completed`.

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
1. Triage the comments per § Triage PR comments + draft responses.
2. Each `blocker` classification becomes a new unit.
3. Run the unit loop. Refresh the PR per § Compose PR when done.

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
  checkin JSON's `execution.corrections[]` array. The session handoff
  (§ Save session) surfaces unresolved corrections into `open_threads`;
  § Capture finding (from-checkin pathway) promotes notable ones into
  `learnings/session-notes/` at session close, and `/griot-compact`
  decides which get promoted further. The loop itself never writes
  to `learnings/`.
- **No emojis.**

## Failure modes

- User goes quiet mid-deliverable → stop, checkpoint whatever is safe,
  save a session handoff.
- Evaluator flags 3× → escalate to user.
- Working tree dirty → stop.
