---
name: ev-loop-confidence
description: >-
  Branded execution loop for tiered-transform work. Runs a phase as a
  sequence of tiers, each tier processing a batch of files under a tier
  contract, gated by evaluator verdicts and pre-flight checks. Writes
  tactical retros between tiers. Composes /project-* primitives; composes
  no other loop. Use when a phase is a bulk transform, audit, or
  find-replace-style operation across many files.
argument-hint: "<project-slug-or-path> <phase-number>"
disable-model-invocation: true
allowed-tools: Read, Write, Edit, Bash, Agent, Skill, mcp__github__get_file_contents
---

# /ev-loop-confidence

Execute one phase of a project as a confidence loop: tiered transforms,
ratcheting from small/safe to large/risky, with an evaluator verdict per
unit and a tactical retro per tier.

**Composes**: `/project-autosave`, `/project-pull-request`, evaluator.
**Does not compose**: other loops. Peer loops are invoked by the router,
not by each other.

**Format reference**: `./projects/CONVENTIONS.md`.

## Arguments

- `<project-slug-or-path>` — resolved like `/project-autosave`.
- `<phase-number>` — which phase of the project to run. Must exist in
  MANIFEST.md and not be in `completed` state.

## Scope directory

This loop creates and uses a scope directory at
`./projects/<slug>/<phase-slug>/` where `<phase-slug>` is a kebab-case
form of the phase name. Inside:

- `MANIFEST.md` — phase-scoped manifest (progress within the phase)
- `inventory.md` — the full list of files in scope, generated in step 1
- `retros/tier-<N>.md` — tactical retro per tier

Create this directory if it doesn't exist.

## Phase-level process

### Step 0. Pre-flight

Before any work:
- `/project-autoload <slug>` to refresh state.
- Confirm working tree is clean (`git status --porcelain`). If not,
  stop and ask the user to commit or stash.
- Confirm current branch matches the phase's branch in MANIFEST.md. If
  not, stop and ask whether to switch.
- Run the verification commands from `config.md` as a baseline. Record
  exit status. A red baseline before any work means the loop stops —
  you are not making a red build redder.

### Step 1. Coverage before transforms

Build `inventory.md` listing every file or item in scope for this phase.
The phase description in PLAN.md or `config.md` tells you the pattern
(e.g. "all .ts/.tsx files using ESLint disable comments"). Use `git ls-files`,
`grep`, `find`, or equivalent to enumerate. Include counts.

Format:

```markdown
# Scope inventory — Phase <N> <name>

**Generated**: YYYY-MM-DD HH:MM
**Total items**: <count>
**Pattern**: <description of what makes an item in-scope>

## Items
- [ ] path/to/file-1.ts  (tier: <tier>)
- [ ] path/to/file-2.tsx  (tier: <tier>)
```

Tier assignment is a judgment call (see Tier assignment below). Assign
tiers as you build the inventory, or leave them unassigned and prompt
the user.

**Do not begin transforms until the inventory is complete.** Partial
inventory = unknown blast radius.

### Step 2. Tier assignment

Divide inventory items into tiers of increasing risk/complexity:

- **Tier 1** — mechanical, obvious, identical across items
- **Tier 2** — same shape with small variations, low risk
- **Tier 3** — requires judgment, possible side effects
- **Tier 4+** — bespoke, high risk, may need human-paired work

If tier 4+ items appear, consider routing them to `/ev-loop-interactive`
rather than handling here. Surface this to the user and ask.

### Step 3. Execute tiers in order

For each tier, run a **tier loop** (see Tier-level process below).
Between tiers, write a tactical retro and re-run pre-flight.

### Step 4. Phase close

When all tiers in this phase are complete:
- Verify every inventory item is checked off.
- Run full verification.
- Ensure the latest checkin exists.
- Invoke `/project-pull-request <slug> <branch>` so the PR reflects the
  final state.
- Invoke `/project-autosave` with `--event=phase-completed
  --detail=<N>` and `--phase-update=<N>:completed`.
- Return control to the router.

## Tier-level process

Each tier runs as a sequence of **units**. A unit is one batch of
inventory items transformed together — sized so that one checkin covers
it cleanly.

### Batch sizing

- Tier 1: batch of 10–30 items (mechanical, cheap to redo)
- Tier 2: batch of 5–15 items
- Tier 3: batch of 1–5 items
- Tier 4+: batch of 1 item

Size down if verification grows slow or evaluator flags pile up.
Size up if you're burning checkins on trivial changes.

### Tier contract (a specialization of unit contract)

Before the first unit of a tier, write a **tier contract** as the first
checkin of that tier. The Contract section includes tier-wide rules
that every unit in the tier must satisfy:

```markdown
## Contract
- **Goal**: apply <transform> to all Tier <N> items
- **Acceptance criteria**:
  - Every item in this tier is updated
  - `<verification command>` passes after each batch
  - No unrelated files modified
- **Rules applied**:
  - <style/lint rules>
  - Verification: `<command>`
- **Disqualifiers**:
  - Any regression in <area>
  - Any file in scope left untouched
- **Inputs**: inventory.md Tier <N> items
```

Subsequent units inside the tier can reference the tier contract instead
of restating it, as long as the unit's checkin contract says
`Rules applied: tier-<N> contract (see checkin <NN>)` and lists only
unit-specific deltas.

### Unit loop

For each unit inside a tier:

1. **Negotiate.** Write a new checkin file with the Contract section
   populated. Pick the items for this batch from inventory.md (mark them
   with a tier tag if not already). Save the checkin with just the
   Contract section — Execution/Scope/Changes/Evaluator verdict come
   later.
2. **Execute.** Do the transform on the batch. Keep to scope.
3. **Evaluate.** Spawn the `evaluator` subagent via the Agent tool with:
   - `description`: "Evaluate unit <NN> (<tier>) for <phase>"
   - `subagent_type`: `evaluator`
   - `prompt`: the evaluation packet — the Contract section verbatim,
     plus the artifact (list of files changed and a summary of the
     diff), plus the original ask (the phase description).
4. **Iterate or commit.**
   - If flagged: update the checkin Execution section with the remedy
     taken, re-spawn the evaluator. Maximum 2 re-iterations per unit —
     on the third flag, stop and escalate to the user.
   - If approved: finalize the checkin (Execution, Scope, Changes,
     Evaluator verdict = approved, Notes for the PR). Check off the
     inventory items.
5. **Autosave.** Invoke `/project-autosave` with
   `--event=checkin-created --detail="<NN> on <branch>"` and
   `--phase-update` reflecting the latest checkin and branch.
6. **Checkpoint?** Call `should_checkpoint()` (see below). If true,
   invoke `/project-pull-request <slug> <branch>` so the PR tracks the
   latest state. Otherwise continue to the next unit.

### Should-checkpoint policy

Checkpoint (push to PR) when any of:
- A full tier has just finished.
- The number of units since last PR update ≥ 5.
- Verification is currently green and we're about to start a riskier
  tier.
- The user has explicitly asked for a checkpoint.

Do **not** checkpoint mid-tier unless verification is green.

### Tactical retro between tiers

Immediately after the last unit of a tier is approved, before moving to
the next tier:

1. Re-run pre-flight (working tree, verification).
2. Write `<scope-dir>/retros/tier-<N>.md`:

```markdown
# Tier <N> retro

**Items processed**: <count>
**Units**: <NN .. NN>
**Verification at tier close**: <green|red>

## What went smoothly
- …

## What bit us
- …

## Adjustment for next tier
- <one concrete change to batch size, tier assignment, or process>
```

3. Invoke `/project-autosave` with `--event=retro-written
   --detail="tier-<N>"`.

Tactical retros are short and specific. Strategic retrospection happens
at `/project-archive`, not here.

### Gate-and-ratchet

Before starting tier N+1, the gate closes if:
- Any tier N unit is still flagged.
- Verification is red.
- The tier retro identified a blocker for tier N+1.

A closed gate stops the loop and reports to the user. The user decides
whether to resume, re-tier, or bail.

## Message-driven redirects

If the router passes a message like "address feedback on #14", this
loop:
1. Invokes `/project-pr-respond <slug> <pr>` to get the response plan.
2. Treats each Blocker item as a new unit in the current tier (or a new
   tier if the feedback rewrites scope).
3. Iterates the unit loop. When done, re-invokes
   `/project-pull-request` to update the PR.

## Rules

- **Coverage before transforms.** Do not start tier 1 without a
  complete inventory.
- **Pre-flight before any tier.** Every tier starts from a known-good
  state.
- **One contract per tier, restated per unit only for deltas.**
- **Evaluator always runs.** No exceptions. Never self-approve.
- **Scope discipline.** Fixes outside this phase's pattern get noted in
  "Notes for the PR" and are deferred — not absorbed silently.
- **No emojis.**

## Failure modes

- Pre-flight fails → stop, report, do not proceed.
- Evaluator flags 3× → stop, escalate to user, do not auto-merge or
  force-approve.
- Inventory shrinks mid-phase (items disappear) → stop; something moved
  under you. Regenerate inventory and reconcile.
- Working tree dirty at boundary → stop; do not stash silently.
