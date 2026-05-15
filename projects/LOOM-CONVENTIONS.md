# Loom project-substrate conventions

Canonical reference for loom-managed projects. Loom is a JSON-first,
loop-friendly CLI for project-substrate work — birthing projects,
writing checkins, opening PRs, handing off sessions, archiving. This
doc is the contract every loom verb implements and every `loom-*`
skill reads from. If a substrate detail is ambiguous, this file is
authoritative.

This document describes a *new* substrate. It does not replace or
modify `projects/CONVENTIONS.md`, which governs the existing trout
substrate. The two substrates coexist; they share neither file paths
nor file shapes.

## Design principles

1. **Loops are first-class consumers.** Read verbs emit JSON to stdout
   by default. Write verbs return JSON results. Errors are structured.
   Schemas are stable. An orchestration loop can call any loom verb
   and parse the output without pattern-matching prose.

2. **JSON-only storage, except PLAN.md.** Manifest, events, config,
   checkins, sessions, retros — all JSON. `PLAN.md` is the sole
   narrative file in a project; it is the human-facing introduction
   to what the project is and how it is shaped. Everything else is
   robot-shaped.

3. **Narrative is composed at output time.** Prose for PR bodies,
   retrospectives, and session summaries is composed by `loom-*`
   skills reading structured JSON. Prose lives at the output
   boundary (GitHub, terminal), not in storage.

## Substrate boundary

Loom is angular to two adjacent substrates:

- **Planning** — wherever a `PLAN.md` came from (a human, a future
  planning CLI, an LLM skill), loom does not care. `loom project
  scaffold` takes `PLAN.md` as input. No verb in loom produces or
  iterates on a plan.

- **Learnings** — retros live under `loom retro` for now, but they
  are tenants. When a griot CLI eventually exists, retros migrate
  there. The flat `retros/` layout and the `type` field on every
  retro JSON are designed to make that lift-out easy.

## Directory layout

A loom-managed project lives at `projects/<YYYY-MM-DD>-<slug>/`.
Archived projects relocate to `projects/archive/<YYYY-MM-DD>-<slug>/`.

```
projects/
├── <YYYY-MM-DD>-<slug>/                   ← active projects
│   ├── manifest.json                      ← source of truth: phases, state, branches
│   ├── events.jsonl                       ← append-only event log
│   ├── config.json                        ← PR settings, verification, worker bindings
│   ├── PLAN.md                            ← narrative plan (only markdown file)
│   ├── checkins/
│   │   └── <branch-name>/                 ← one subdir per git branch
│   │       ├── 01.json                    ← immutable numbered checkins
│   │       ├── 02.json
│   │       └── ...
│   ├── sessions/
│   │   └── YYYY-MM-DD-<letter>.json       ← narrative-source session handoffs
│   └── retros/
│       ├── phase-<N>-tier-<M>.json        ← session-type retros (confidence-loop tiers)
│       └── project.json                   ← project-type retro (at archive time)
└── archive/
    └── <YYYY-MM-DD>-<slug>/               ← same shape, read-only
```

**Branch names with `/`**: the slash becomes a real subdirectory.
A branch named `loom-cli/phase-1-schemas` produces
`checkins/loom-cli/phase-1-schemas/NN.json`.

**Empty directories are not committed**; loom creates them on first
write.

## File purposes (one paragraph each)

The detailed JSON shapes of each file land in `cli/lib/types.ts` (Phase
1, units 02 and 03). This section names *what* each file is for, not
*what fields it has*.

- **manifest.json** — Source of truth for project state at this
  moment. Records phases (with status, branch, latest checkin, PR
  reference), the project's overall status (active | archived), the
  current branch, the latest checkin across all branches, and a
  strategy paragraph distilled from PLAN.md context. State changes
  are atomic with the relevant write verb (`phase update`, `checkin
  write`, etc.).

- **events.jsonl** — Append-only audit log. Each line is a single
  JSON object with at minimum `{at, event, detail}` fields, where
  `at` is an ISO-8601 UTC timestamp, `event` is a name drawn from
  the closed vocabulary below, and `detail` is an event-specific
  object. Loom never rewrites this file mid-line; new events go on
  new lines.

- **config.json** — Configuration that does not change frequently:
  base branch for PRs, reviewers, labels, verification commands
  (lint/test/build), worker bindings (which loop runs which phase).
  Authored by `loom project scaffold` and edited rarely.

- **PLAN.md** — The narrative plan for the project. Free-form
  markdown. Loom reads it for motivation source material (PR body
  composition by `loom-pr`) and for phase deliverable enumeration
  (`/ev-loop-*` skills). Loom never writes PLAN.md.

- **checkins/`<branch>`/NN.json** — Immutable, zero-padded, numbered
  records of unit-of-work outcomes. Contract (negotiated before
  execution), execution details (structured arrays — actions, files
  touched, corrections), verdict (approved | flagged with reasons),
  notes for the PR (structured bullets composed later into prose).
  New information produces a new numbered file; existing files are
  never edited.

- **sessions/YYYY-MM-DD-`<letter>`.json** — End-of-session handoff
  records. Composed by the `loom-session` skill from manifest events
  + checkin corrections + cwd state. Read by the next session's
  router for orientation. Letter suffix increments per additional
  session on the same date.

- **retros/`<filename>`.json** — Retrospective records. The `type`
  field on every retro distinguishes `session` (per phase × tier,
  from confidence-loop work) from `project` (whole-project, at
  archive time). Filenames are descriptive (`phase-1-tier-2.json`,
  `project.json`); the type field is canonical.

## CLI conventions

### Output

| Verb kind | Default | Human view |
|-----------|---------|------------|
| Read (`project read`, `phase list`, `events read`, etc.) | JSON on stdout | `--pretty` flag |
| Write (`project scaffold`, `phase update`, `checkin write`, etc.) | JSON result on stdout | — |

Every verb's JSON output is stable: a loop can parse it without
brittle string matching. Field names and types are documented in
`cli/lib/types.ts`.

### Errors

On failure, loom writes a structured JSON object to stderr and exits
non-zero:

```
{"error": "<code>", "message": "<human-readable>", "candidates"?: ["<a>", "<b>"]}
```

- `error` — short kebab-case code (`project-not-found`,
  `slug-ambiguous`, `pr-marker-drift`, etc.). Stable across loom
  versions.
- `message` — one-line human-readable explanation.
- `candidates` — optional list, present when disambiguation helps
  (e.g., slug-ambiguous lists the matching slugs).

### Exit codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | Generic error; structured error JSON on stderr |
| 2 | Argument parse error |

Reserved for future use: codes 3+. Loom should never exit 0 on a
write that did not happen.

### Slug resolution

Every verb that takes a `<slug>` argument accepts four forms:

| Form | Example |
|------|---------|
| Date-less | `loom-cli` (resolves to the unique active match) |
| Full | `2026-05-15-loom-cli` |
| Relative path | `./projects/2026-05-15-loom-cli` |
| Absolute path | `/home/.../projects/2026-05-15-loom-cli` |

Resolution scans `projects/<YYYY-MM-DD>-<slug>/` first; the archive
is read-only and only matched when the active scan fails. Ambiguous
date-less match → `{"error": "slug-ambiguous", "candidates": [...]}`.

Verbs that can infer slug from cwd (e.g., when run inside a project
directory) treat `<slug>` as optional and default to the enclosing
project.

### Verb naming

Loom uses **noun-verb** taxonomy: `loom <noun> <verb>` where the noun
is the substrate domain and the verb is the operation. Examples:
`loom phase read`, `loom events latest`, `loom checkin write`. Verbs
within a namespace are: `read`, `list`, `write`, `update`, `latest`,
`scaffold`, `archive`, etc., chosen for consistency across
namespaces.

### Argument conventions

| Pattern | Use |
|---------|-----|
| `<positional>` | Required, ordered (slug, phase number, event type) |
| `--<flag>=<value>` | Optional or named values |
| `--<noun>-file=<path>` | Read content from a file (preferred over inline values for content that spans multiple lines or contains JSON) |
| `--pretty` | Human-readable output (read verbs only) |
| `--type=<v>` | Type discriminator (e.g., `--type=session` on retros) |

Flags are GNU-style long form. No short aliases except where standard
(`--help` only).

## Verb surface

Eight namespaces, ~22 verbs. State-modifying verbs auto-append the
corresponding event to `events.jsonl`; callers do not need to manage
the event log directly.

### `loom project`

| Verb | Signature | Purpose |
|------|-----------|---------|
| `scaffold` | `<slug> --plan-file=<path> --config-file=<path>` | Create project directory, write manifest.json/config.json/events.jsonl, copy PLAN.md, emit `project-initialized` |
| `read` | `<slug> [--pretty]` | Return full manifest JSON |
| `list` | `[--archived] [--pretty]` | Enumerate active (or archived) projects |
| `status` | `[--pretty]` | Terse current-project summary from cwd |
| `archive` | `<slug>` | Update manifest status to `archived`, relocate dir to `projects/archive/`, emit `archived` |

`list` accepts `ls` as an alias.

### `loom phase`

| Verb | Signature | Purpose |
|------|-----------|---------|
| `read` | `<slug> <N> [--pretty]` | Return phase N's JSON |
| `list` | `<slug> [--pretty]` | Return all phases |
| `update` | `<slug> <N> --status=<v> [--branch=<b>] [--pr=<n>]` | Update phase status/branch/PR; emit `phase-started` / `phase-completed` / `phase-blocked` / `phase-unblocked` as appropriate |

### `loom events`

| Verb | Signature | Purpose |
|------|-----------|---------|
| `read` | `<slug> [--since=<iso>] [--event=<name>] [--limit=<N>] [--pretty]` | Read events from events.jsonl, optionally filtered |
| `latest` | `<slug> [--event=<name>] [--pretty]` | Most recent event matching filter |

`events append` is intentionally not exposed; state changes happen
through the high-level verb that owns the event.

### `loom checkin`

| Verb | Signature | Purpose |
|------|-----------|---------|
| `write` | `<slug> --checkin-file=<path>` | Author new immutable checkin under `checkins/<branch>/NN.json`; emit `checkin-created` |
| `list` | `<slug> [--branch=<b>] [--pretty]` | Enumerate checkins (filtered by branch if given) |
| `read` | `<slug> --branch=<b> --number=<NN> [--pretty]` | Return one checkin |
| `latest` | `<slug> [--branch=<b>] [--pretty]` | Most recent checkin (optionally per branch) |

### `loom session`

| Verb | Signature | Purpose |
|------|-----------|---------|
| `write` | `<slug> --session-file=<path>` | Author session handoff `sessions/YYYY-MM-DD-<letter>.json`; emit `session-saved` |
| `list` | `<slug> [--pretty]` | Enumerate sessions |
| `read` | `<slug> --filename=<name> [--pretty]` | Return one session record |
| `corrections` | `<slug> [--since-checkin=<NN>] [--pretty]` | Surface `corrections[]` entries from recent checkins (for `loom-session` composition) |

### `loom pr`

| Verb | Signature | Purpose |
|------|-----------|---------|
| `discover` | `<slug> --branch=<b> [--pretty]` | Return `{checkins, marker_state, pr}` — the PR state machine |
| `open` | `<slug> --title=<t> --body-file=<path> [--branch=<b>]` | Open new PR via `gh`; emit `pr-opened` |
| `update` | `<slug> --pr=<N> --body-file=<path>` | Refresh PR body via `gh`; emit `pr-updated` |
| `comments` | `<slug> --pr=<N> [--pretty]` | Fetch PR comments via `gh`, return structured JSON |
| `respond` | `<slug> --pr=<N> --responses-file=<path>` | Write response files under `checkins/<branch>/responses/` |

Marker states from `discover`: `fresh` (PR body marker matches disk
checkin set), `stale` (marker is a proper subset), `drift` (marker
is a proper superset or sets diverge), `new` (no PR yet).

### `loom retro`

| Verb | Signature | Purpose |
|------|-----------|---------|
| `write` | `<slug> --type=session\|project --retro-file=<path> [--phase=<N>] [--tier=<M>]` | Author retro under `retros/`; emit `retro-written` |
| `list` | `<slug> [--type=<v>] [--pretty]` | Enumerate retros (filtered by type if given) |
| `read` | `<slug> --type=<v> [--phase=<N>] [--tier=<M>] [--pretty]` | Return one retro |

`--phase` and `--tier` are required when `--type=session` and ignored
when `--type=project` (one project retro per project).

### `loom doctor`

| Verb | Signature | Purpose |
|------|-----------|---------|
| `doctor` | `[<slug>] [--pretty]` | Health check: schema validity, missing fields, manifest/events consistency, archive non-atomicity drift |

## Event vocabulary

Closed list. Every state-modifying verb auto-appends the relevant
event; no caller manages events directly except via `note`.

| Event | Emitter | `detail` shape |
|-------|---------|----------------|
| `project-initialized` | `project scaffold` | `{}` |
| `phase-started` | `phase update --status=in-progress` | `{phase: <N>, name: <string>}` |
| `phase-completed` | `phase update --status=completed` | `{phase: <N>}` |
| `phase-blocked` | `phase update --status=blocked` | `{phase: <N>, reason: <string>}` |
| `phase-unblocked` | `phase update --status=in-progress` (from blocked) | `{phase: <N>}` |
| `checkin-created` | `checkin write` | `{number: <NN>, branch: <string>}` |
| `pr-opened` | `pr open` | `{pr: <N>, url: <string>}` |
| `pr-updated` | `pr update` | `{pr: <N>}` |
| `pr-merged` | reconcile path; not user-emitted | `{pr: <N>}` |
| `session-saved` | `session write` | `{filename: <string>}` |
| `retro-written` | `retro write` | `{type: <session\|project>, phase?: <N>, tier?: <M>}` |
| `archived` | `project archive` | `{destination: <string>}` |
| `note` | manual (not yet wired) | `{text: <string>}` |

Exact field shapes per event are finalized in `cli/lib/types.ts`
(Phase 1, unit 02). The vocabulary itself is stable.

## Settled design decisions

These were resolved during planning and are not re-litigated downstream.

- **Schemas form**: TypeScript types in `cli/lib/types.ts`. No runtime
  JSON Schema validation. Round-trip tests against fixtures are the
  contract.
- **Events storage**: append-only `events.jsonl`, separate from
  `manifest.json`. No whole-file rewrite per event; clean separation
  of state vs audit log.
- **Retro storage**: flat `retros/` directory; type is a JSON field,
  not a path component.
- **Internal lib layout**: one file per domain in `cli/lib/` —
  `manifest.ts`, `events.ts`, `project.ts`, `checkin.ts`,
  `session.ts`, `retro.ts`, `types.ts`. Mirrors the verb namespaces.
- **Checkin execution shape**: structured `{actions[], files_touched[],
  corrections[]}`. Prose composition happens at output time, not in
  storage.

One open design question remains: how much classification structure
`loom pr comments` imposes on returned comments vs leaves to the
consuming skill. Decided in Phase 4 when `loom-pr-respond` is built.

## Versioning

Every file format that loom writes carries a `schema_version` field,
starting at `1`. When the format changes incompatibly, the version
bumps. Loom refuses to operate on a project whose `schema_version` it
does not understand. Migration tooling is deferred; the surface is
reserved.

## Relationship to existing substrate

`projects/CONVENTIONS.md` (trout substrate) and this file
(LOOM-CONVENTIONS.md) define **separate, coexisting substrates**:

- Distinct directory layouts (trout: `MANIFEST.md`; loom:
  `manifest.json`).
- Distinct skill prefixes (`trout-*` vs `loom-*`).
- No shared files, no shared paths, no auto-migration.

A project belongs to one substrate or the other based on the files
present at scaffold time. Loom's verbs operate only on
loom-substrate projects; trout's tools operate only on trout-substrate
projects. `loom doctor` reports a clear error when invoked against a
trout project (`{"error": "wrong-substrate", "candidates": [...]}`).
