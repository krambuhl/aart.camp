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

**Composes**: `/project-autosave`, `/project-pull-request`, evaluator.
**Does not compose**: other loops.

**Format reference**: `./projects/CONVENTIONS.md`.

## Arguments

- `<project-slug-or-path>` — resolved like `/project-autosave`.
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

- `/project-autoload <slug>` to refresh state.
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
3. **Evaluate.** Spawn the `evaluator` subagent with the packet
   (Contract, artifact, original ask from PLAN.md).
4. **Iterate or commit.**
   - Flagged: address the specific reasons, re-spawn. Max 2 retries.
   - Approved: finalize the checkin.
5. **Autosave.** `/project-autosave ... --event=checkin-created`.
6. **Checkpoint.** Free mode: after every deliverable. Sequential mode:
   after every deliverable **or** when the human explicitly asks.
   Invoke `/project-pull-request <slug> <branch>`.

### Step 3. Phase close

- All deliverables accounted for.
- Full verification passes.
- `/project-pull-request` is fresh.
- `/project-autosave --event=phase-completed --detail=<N>
  --phase-update=<N>:completed`.

## Message-driven redirects

For "address feedback on #N":
1. `/project-pr-respond <slug> <pr>` → plan.
2. Each Blocker becomes a new unit.
3. Run the unit loop. Re-checkpoint when done.

## Rules

- **The human co-pilots.** Don't write long stretches without pausing.
  If a unit would take more than ~30 minutes of uninterrupted work,
  split it.
- **Contract before execution.** Always. Even if the deliverable feels
  small.
- **Evaluator always runs.** Same as the confidence loop — never
  self-approve.
- **Scope discipline.** One deliverable at a time in a given checkin.
- **No emojis.**

## Failure modes

- User goes quiet mid-deliverable → stop, checkpoint whatever is safe,
  save a session handoff.
- Evaluator flags 3× → escalate to user.
- Working tree dirty → stop.
