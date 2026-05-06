# Project substrate conventions

Canonical reference for the formats and structures of the project substrate.
The `/trout-*` skill family and the `/ev-*` execution loops both read from
and write to the shapes defined here. If you are a skill and you are unsure
of a format, read this file first.

## Substrate primitive shapes

Four shapes of substrate work. The shape determines the primitive.

| Shape | What it is | Primitive | Where it lives |
|-------|------------|-----------|----------------|
| **CRUD** | Read / edit / write files. Deterministic. No LLM judgment. | Node script (stdlib only) | `.claude/scripts/<family>/<verb>.js` |
| **LLM** | Judgment, taste, narrative, classification. | Skill | `.claude/skills/<name>/SKILL.md` |
| **Interactive** | Multi-turn user conversation. Must run in the main thread. | Skill | `.claude/skills/<name>/SKILL.md` |
| **Orchestration** | Composes Skill + Agent in the same context. | Skill | `.claude/skills/<name>/SKILL.md` |

LLM-shaped skills with a deterministic CRUD epilogue (write file, append
manifest event, invoke other substrate) split: the skill body keeps the
LLM portion as prose; the CRUD epilogue extracts to a script and the skill
body invokes it via `Bash`. This is the **shell extraction** pattern.
Apply only when the epilogue is non-trivial.

### Why orchestration stays a skill

Orchestration substrate invokes other skills via the `Skill` tool. The
`Skill` tool is a model-initiated invocation. Empirically,
`disable-model-invocation: true` on a skill blocks all model-initiated
invocations of it, including transitive `Skill` tool calls from other
skills. So a skill cannot be simultaneously "composable from another
skill" and "blocked from ambient auto-discovery." The only path to
composition-only behavior is a different primitive (script or subagent).
Orchestration substrate must therefore stay discoverable.

### `.claude/scripts/` directory layout

```
.claude/scripts/
├── trout/                             ← project state primitives
│   ├── autosave.js
│   ├── autoload.js
│   └── ...
├── griot/                             ← learnings primitives
│   ├── capture.js
│   └── use.js
└── guild/                             ← agent-panel primitives
    └── parse-and-aggregate.js
```

Scripts are Node, stdlib only — no npm dependencies. Callers shell out
via `Bash("node .claude/scripts/<family>/<verb>.js <args>")`.

### Permissions

Add one wildcard per family to project-wide `.claude/settings.json` as
the family's first script lands:

```jsonc
"Bash(node .claude/scripts/trout/*)",
"Bash(node .claude/scripts/griot/*)",
"Bash(node .claude/scripts/guild/*)"
```

Per-script entries are not used; the family wildcard is narrow enough.

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

| Event | Detail format | Emitter |
|-------|---------------|---------|
| `project-initialized` | — | `/trout-autosave --init` |
| `phase-started` | `<phase-number> <phase-name>` | *reserved — phase status set via `--phase-update`* |
| `phase-completed` | `<phase-number>` | `/ev-loop-confidence`, `/ev-loop-interactive` |
| `phase-blocked` | `<phase-number> on: <reason>` | *reserved — phase status set via `--phase-update`* |
| `phase-unblocked` | `<phase-number>` | *reserved — phase status set via `--phase-update`* |
| `checkin-created` | `<NN> on <branch>` | `/ev-loop-confidence`, `/ev-loop-interactive` |
| `pr-opened` | `#<N>` | `/trout-pull-request` |
| `pr-updated` | `#<N>` | `/trout-pull-request` |
| `pr-merged` | `#<N>` | *not yet tracked* |
| `session-saved` | `<filename>` | `/trout-save-session` |
| `retro-written` | `tier-<N>` or `phase-<N>` | `/ev-loop-confidence` |
| `archived` | `<destination path>` | `/trout-archive` |
| `note` | `<freeform one line>` | user-invoked manually |

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
in its body, listing the checkin numbers the PR description was authored
from:

```html
<!-- project-pr-checkins: NN[,NN,...] -->
```

Single-checkin PRs use the same plural form with one entry, e.g.
`<!-- project-pr-checkins: 01 -->`. The older singular form
`<!-- project-pr-checkin: NN -->` is parsed as backward-compat
(interpreted as the set `{NN}`); only the plural form is written.

Let `M` = checkin numbers in the marker, `D` = checkin numbers on disk
in `checkins/<branch>/`.

- `M == D` → **fresh**. Skill is a no-op.
- `M ⊂ D` (proper subset, including the no-marker / `M = ∅` case) →
  **stale**. Skill rewrites the body from the full disk set and bumps
  the marker.
- `M ⊃ D`, OR sets diverge in both directions → **drift**. Skill
  refuses to act and reports.

`/trout-pull-request` is idempotent. PRs authored by the skill lead with
a `## Motivation` section sourced from PLAN.md's `## Context` and
per-checkin Goal rationale. When source material is thin, the skill
stops and asks the user for motivation rather than synthesizing a
placeholder.

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
<loop-specific; free-form>
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
