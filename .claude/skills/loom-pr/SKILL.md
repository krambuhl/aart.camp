---
name: loom-pr
description: >-
  Author or refresh the GitHub PR for a loom-managed project branch.
  Reads disk-side checkins, runs `bin/loom pr discover` for marker
  state, composes title + body from checkin JSON, and dispatches to
  `bin/loom pr open` (new) or `bin/loom pr update` (stale). Refuses
  on drift. Pairs with the loom CLI the way trout-pull-request pairs
  with pr-plumbing.ts.
argument-hint: "<project-slug-or-path> <branch>"
allowed-tools: Read, Write, Bash(bin/loom *)
---

# /loom-pr

Author or refresh a GitHub PR for a loom-managed branch. The PR's
title and body are composed from the checkin JSON on that branch —
robots filter and skim, humans read the rendered prose.

The skill is **idempotent**: invoke it any time the on-disk checkin
set is ahead of the PR body, and the body re-syncs. If the on-disk
set and the PR's marker diverge in a way that can't be reconciled
mechanically (drift), the skill refuses and reports.

**Format reference**: `projects/LOOM-CONVENTIONS.md` (§ PR marker,
repo-relative). Pairs with `bin/loom pr discover` for the four-state
machine.

## Arguments

- `<project-slug-or-path>` — resolved by loom's standard slug
  resolution.
- `<branch>` — the git branch the PR is tied to. May contain
  slashes (`loom-cli/phase-4-pr`).

## Process

### 1. Discover

```
Bash("bin/loom pr discover <slug> --branch=<branch>")
```

Returns `{checkins, marker_state, pr}` JSON. Dispatch on state:

- `fresh` → stop. Report `pr: no-op, #<N> current @ checkins <list>`.
- `drift` → stop. Report `pr: drift, marker <M> diverges from disk
  <D> — no action`. Refuses to overwrite a body whose marker has
  checkins that aren't on disk.
- `new` or `stale` → proceed to compose + dispatch.

### 2. Read the checkin corpus

For each number in `checkins`, fetch:

```
Bash("bin/loom checkin read <slug> --branch=<branch> --number=<NN>")
```

The output is the full Checkin JSON (contract, execution, scope,
verdict, notes_for_pr).

### 3. Compose title and body

**Title**:
- Single-checkin (`|disk| == 1`): `[Phase N] <unit name>` where N
  and unit name come from the checkin's `phase.number` +
  `phase.name` + `unit` fields. Trim to under 70 characters.
- Multi-checkin (`|disk| >= 2`): If every checkin shares the same
  phase, `[Phase N] <phase name>`. Else stop and report
  `pr: paused, awaiting title input — checkins span phases <list>`.

**Body** (always under 600 words; sections cap individually):

```markdown
<!-- loom-pr-checkins: NN[,NN,...] -->

> [!NOTE]
> Part of the **<project title>** project — see
> [PLAN.md](projects/<slug>/PLAN.md) for context.

## Motivation
<2-4 sentences distilled from checkin.contract.goal and PLAN.md
context. Why this work matters now, not what it does.>

## Summary
<3-5 one-line bullets distilled from checkin.notes_for_pr arrays
across all checkins. Each bullet is one conceptual change.>

## Reference (single-checkin) or ## Units (multi-checkin)
<For single: Goal + Checkin link. For multi: a table with one row
per checkin pointing to its file.>

## Verification
<One line per command from checkin.contract.rules_applied or
manifest config. Just the commands and their result.>

## Notes
<3-5 reviewer-relevant items: trade-offs, open questions, any
`correction:` lines from checkin.execution.corrections[].>

---
Tracked by project substrate: <manifest path> — checkin{s} <list>
```

**Motivation source check**: if `checkin.contract.goal` is empty
across all checkins AND PLAN.md doesn't have a `## Context` section,
stop and ask the user for motivation rather than synthesizing
placeholder prose. (Mirrors trout-pull-request's
`whyCheck.thin → pause` rule.)

Write the body to `/tmp/loom-pr-body-<branch>-<NN-list>.md`.

### 4. Dispatch

- `new` →
  ```
  Bash("bin/loom pr open <slug> --title=<title> --body-file=<path> --branch=<branch>")
  ```
- `stale` →
  ```
  Bash("bin/loom pr update <slug> --pr=<N> --body-file=<path>")
  ```
  Where N is from the discover JSON's `pr.number`.

### 5. Report

Exactly one of:

```
pr: no-op, #<N> current @ checkins <list>
pr: created #<N>, authored from checkins <list>
pr: updated #<N>, re-authored from checkins <list>
pr: drift, marker <M> diverges from disk <D> — no action
pr: paused, awaiting motivation input
pr: paused, awaiting title input (checkins span phases <list>)
```

## Rules

- **Marker is the first line of the body.** Always. Discover's
  staleness detection depends on it.
- **Compose `bin/loom`.** Never `node .claude/cli/loom.ts`.
- **Refuse on drift.** Don't overwrite a body whose marker has
  checkins the disk doesn't.
- **Motivation is sourced, not invented.** If thin, stop and ask.
- **Concise over exhaustive.** Section caps are hard; total body
  caps at 500-600 words. Acceptance criteria + execution
  + verdict are NOT pasted; they live in the linked checkin file.
- **No emojis.**

## Failure modes

- `discover` returns `drift` → stop and report. User resolves the
  divergence (either updates the PR's marker manually or amends
  disk).
- `discover` returns empty `checkins` → stop: `pr: empty, no
  checkins on branch`.
- Motivation thin and not provided → pause and ask.
- `pr open` returns `invalid-pr-url` → surface loom's error; gh
  likely produced unexpected output.
- `pr update` returns `gh-failed` → surface the error; usually
  auth or PR-permissions related.
