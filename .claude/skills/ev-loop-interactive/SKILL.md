---
name: ev-loop-interactive
description: >-
  Branded execution loop for human-paired work. Runs a phase as a sequence
  of deliverables, each with its own unit contract and evaluator
  checkpoint. Supports sequential (ordered) and free (user picks next)
  deliverable ordering. Composes /project-* primitives; composes no
  other loop. Use when a phase is exploratory, creative, or otherwise
  not a bulk transform.
argument-hint: "<project-slug-or-path> <phase-number>"
disable-model-invocation: true
allowed-tools: Read, Write, Edit, Bash, Agent, Skill, mcp__github__get_file_contents
---

# /ev-loop-interactive

Execute one phase of a project as a human-paired loop: discrete
deliverables, per-deliverable contract and checkpoint. The human drives
order when ordering is free; the loop keeps the substrate honest.

**Composes**: `/trout-autosave`, `/trout-pull-request`, evaluator.
**Does not compose**: other loops.

**Format reference**: `projects/CONVENTIONS.md` (repo-relative).

Invocations like `/trout-autosave` and `/trout-pull-request` below
mean `Skill(skill: trout-autosave, args: "…")` — the Skill tool is
how branded loops compose substrate skills. The `evaluator` subagent
is spawned via the Agent tool with `subagent_type: evaluator`.

## Arguments

- `<project-slug-or-path>` — resolved like `/trout-autosave`.
- `<phase-number>` — which phase to run. Must not be in `completed`
  state.

## Ordering

Read the phase entry in PLAN.md to determine ordering:

- **Sequential** — deliverables are numbered and must run in order.
  The loop picks the next one automatically.
- **Free** — deliverables are a set. The loop presents them and asks
  the user to pick.

If PLAN.md doesn't specify, default to **free** and ask.

## Phase-level process

### Step 0. Pre-flight

- `/trout-autoload <slug>` to refresh state.
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
3. **Evaluate.** Spawn the `evaluator` subagent via the Agent tool with
   `subagent_type: evaluator`. The prompt is the packet: the Contract
   section verbatim, the artifact (files changed + Execution section),
   and the original ask (the deliverable's line from PLAN.md). Expect
   a reply that begins `VERDICT: approved` or `VERDICT: flagged` with
   specific reasons (see `.claude/agents/evaluator.md` for the shape).
4. **Iterate or commit.**
   - Flagged: address the specific reasons, re-spawn. Up to 2 retries
     (3 evaluator runs total).
   - Approved: finalize the checkin.
5. **Autosave.** `/trout-autosave ... --event=checkin-created`.
6. **Checkpoint.** Free mode: after every deliverable. Sequential mode:
   after every deliverable **or** when the human explicitly asks.
   Invoke `/trout-pull-request <slug> <branch>`.

### Step 3. Phase close

- All deliverables accounted for.
- Full verification passes.
- `/trout-pull-request` is fresh.
- `/trout-autosave --event=phase-completed --detail=<N>
  --phase-update=<N>:completed`.

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
  `learnings/session-notes/` via `/griot-capture --from-checkin`
  at end of session; `/griot-compact` decides which get promoted.
  The loop itself never writes to `learnings/`.
- **No emojis.**

## Failure modes

- User goes quiet mid-deliverable → stop, checkpoint whatever is safe,
  save a session handoff.
- Evaluator flags 3× → escalate to user.
- Working tree dirty → stop.
