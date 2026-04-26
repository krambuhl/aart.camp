# Project substrate conventions

Canonical reference for the formats and structures used by the `/project-*`
substrate. All substrate skills and all branded loops read from and write to
the shapes defined here. If you are a skill and you are unsure of a format,
read this file first.

## Directory layout

```
./projects/
├── CONVENTIONS.md                      ← this file
├── <date>-<slug>/                      ← active projects (hot path)
│   ├── PLAN.md                         ← authored by /trout-plan
│   ├── MANIFEST.md                     ← ground truth; maintained by /trout-autosave
│   ├── config.md                       ← worker bindings, PR settings, verification cmds
│   ├── sessions/
│   │   └── YYYY-MM-DD-a.md             ← narrative handoffs; letter suffix if multiple per day
│   ├── checkins/
│   │   └── <branch-name>/              ← one directory per git branch
│   │       ├── 01.md                   ← immutable numbered snapshots
│   │       ├── 02.md
│   │       └── 03.md
│   └── <scope-dir>/                    ← one per confidence-loop phase, optional
│       ├── MANIFEST.md                 ← phase-scoped manifest (confidence-loop internal)
│       ├── inventory.md                ← generated JIT by /ev-loop-confidence
│       └── retros/
│           └── tier-N.md
└── archive/
    └── <date>-<slug>/                  ← closed projects (read-only)
        ├── [preserved files]
        └── RETROSPECTIVE.md            ← written at /trout-archive time
```

**Slug** — kebab-case project identifier. The full directory name is
`<YYYY-MM-DD>-<slug>` where the date is the project start date.

**Branch names in paths** — checkin directories use the literal branch name.
If the branch contains `/` (e.g. `claude/adopt-biome-v1`), the slash becomes
a real subdirectory: `checkins/claude/adopt-biome-v1/01.md`.

## MANIFEST.md format

```markdown
# Project: <human title>

**Slug**: <YYYY-MM-DD-slug>
**Started**: YYYY-MM-DD
**Status**: active | archived
**Current branch**: <branch-name or —>
**Latest checkin**: <relative path or —>

## Strategy
<one short paragraph summarizing approach — sourced from PLAN.md>

## Phases

| # | Name | Status | Branch | Latest checkin | PR |
|---|------|--------|--------|----------------|----|
| 1 | <name> | completed | <branch> | 04 | #12 (merged) |
| 2 | <name> | in-progress | <branch> | 03 | #14 (open) |
| 3 | <name> | not-started | — | — | — |

## Dependencies
- Phase N requires Phase M merged
- (or: "none")

## Current state
<2–3 lines on what is happening right now — updated per unit>

## Events

| When | Event | Detail |
|------|-------|--------|
| YYYY-MM-DD HH:MM | <event> | <detail> |
```

**Status values for a phase**: `not-started`, `in-progress`, `blocked`,
`completed`.

**Latest checkin** (top-level field) points to the single most recent checkin
across all branches. Each phase row has its own latest-checkin number scoped
to that phase's branch.

## Event vocabulary

Every write to MANIFEST.md appends one row to the Events table. The event
column is drawn from a closed vocabulary:

| Event | Detail format |
|-------|---------------|
| `project-initialized` | — |
| `phase-started` | `<phase-number> <phase-name>` |
| `phase-completed` | `<phase-number>` |
| `phase-blocked` | `<phase-number> on: <reason>` |
| `phase-unblocked` | `<phase-number>` |
| `checkin-created` | `<NN> on <branch>` |
| `pr-opened` | `#<N>` |
| `pr-updated` | `#<N>` |
| `pr-merged` | `#<N>` |
| `session-saved` | `<filename>` |
| `retro-written` | `tier-<N>` or `phase-<N>` |
| `archived` | `<destination path>` |
| `note` | `<freeform one line>` |

Prefer an existing event over inventing new ones. Use `note` for anything
that does not fit.

## Checkin format

Each unit of work produces one numbered, immutable checkin. Filename is
zero-padded: `01.md`, `02.md`, … `99.md`.

```markdown
# Checkin NN — <branch-name>

**Created**: YYYY-MM-DD HH:MM
**Phase**: <phase-number-and-name>
**Unit**: <short unit name>

## Contract
- **Goal**: <one sentence>
- **Acceptance criteria**:
  - <criterion>
  - <criterion>
- **Rules applied**: <rule files, style guides, verification commands>
- **Disqualifiers**: <what would mean this is NOT done>
- **Inputs**: <files in scope, specs referenced>

## Execution
<what was actually produced>

## Scope
<files / areas touched at this snapshot>

## Changes since previous checkin
<diff-level summary; for NN=01 write "first checkin on this branch">

## Evaluator verdict
<approved | flagged — with specific reasons if flagged>

## Notes for the PR
<anything worth surfacing in the PR body>
<Prefix any line that records a mid-flight correction with `correction: ` —
`/trout-save-session` scans for these when surfacing
`/griot-capture` candidates.>
```

Checkins are **immutable**. New information produces a new numbered file.
The Contract section is written up-front (before execution) and never
retroactively rewritten. If scope changes mid-unit, write a new checkin with
a revised contract rather than editing in place.

## PR marker

Every PR authored by `/trout-pull-request` carries an HTML comment marker
in its body:

```html
<!-- project-pr-checkin: NN -->
```

Where `NN` is the checkin number the PR description was authored from. A PR
is **stale** when the latest checkin in `checkins/<branch>/` is numbered
higher than the marker. `/trout-pull-request` is idempotent: stale → rewrite
from the latest checkin and bump the marker; fresh → no-op.

## config.md format

```markdown
# Project config

## Verification
- `npm run lint`
- `npm run build`

## PR settings
- Base branch: main
- Reviewers: —
- Labels: project/<slug>

## Worker bindings
<branded-layer-specific; free-form>
```

## Session handoff format

`sessions/YYYY-MM-DD-<letter>.md`. Letter starts at `a`, increments per
additional session on the same date.

```markdown
# Session YYYY-MM-DD-<letter>

**Phases touched**: 2
**Checkins written**: 03, 04
**PR activity**: #14 updated

## What happened
<narrative: 2–6 sentences>

## Open threads
<what the next session should pick up>

## Notes
<anything not captured elsewhere>
```
