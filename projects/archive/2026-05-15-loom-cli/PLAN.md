# Loom: a JSON-first, loop-friendly project-substrate CLI

## Context

Project-substrate work — birthing projects, writing checkins, opening
PRs, handing off sessions, archiving — needs a CLI that serves
orchestration loops as first-class consumers. Today's substrate is
markdown-shaped: every file is prose with structured fields embedded
in tables and headers. Parsing is fragile, agents pattern-match on
text, and there's no machine-readable surface.

Loom is the CLI for project-substrate work, designed around three
principles:

1. **Loops are first-class consumers.** Every read verb emits JSON.
   Every write verb returns a JSON result. Errors are structured.
   Schemas are stable. Outputs are predictable enough that an agent
   loop can call loom verbs and parse results without pattern-matching
   on prose.

2. **JSON-only storage, except PLAN.md.** The substrate is fully
   structured: manifest, events, config, checkins, sessions, retros —
   all JSON. PLAN.md is the sole narrative file in a project; it's
   the human-facing introduction to what the project is and how it's
   shaped. Everything else is robot-shaped.

3. **Test-driven, end to end.** Every loom verb is built test-first.
   Phase 1 ships schemas plus the test fixtures that validate them
   before any production code exists. Later phases develop each verb
   by writing the fixture and failing test first, then implementing.
   The test suite is the spec.

Loom is paired with a `loom-*` skill family that handles the
LLM/interactive/orchestration-shaped work: session narrative,
PR body composition, comment classification, retrospective synthesis.
Skills are thin shells — most of each file is prose for the model,
with `Bash("bin/loom ...")` calls at the seams. Skills compose
narrative *at output time* (PR body for `gh`, retrospective prose)
from structured JSON read out of the substrate. Prose lives at the
output boundary, not in storage.

Loom is deliberately **angular to planning**. PLAN.md is input to
`project scaffold`; wherever it came from — a human, a future planning
CLI, an LLM skill — loom doesn't care. Loom is angular to learnings
too: retros are temporary tenants under `loom retro` until a future
griot CLI exists to absorb them.

## Scope

**In**:
- New `.claude/cli/loom.ts` entry + `bin/loom` shim.
- JSON schemas for manifest, events, config, checkin, session, retro;
  versioned with `schema_version: 1`.
- Internal storage lib implementing the schemas, fully test-covered.
- CLI surface — introspection, lifecycle (scaffold/archive),
  state (phase update, checkin write, session write, retro write),
  PR work (discover, open, update, comments, respond).
- JSON-by-default on every read verb; `--pretty` flag for human output;
  structured errors with non-zero exit on failure.
- Slug resolution: every `<slug>` argument accepts date-less form
  (`loom-cli`), full form (`2026-05-15-loom-cli`), or path.
- New `loom-*` skill family: `loom-session`, `loom-pr`,
  `loom-pr-respond`, `loom-archive`.
- New conventions doc (`projects/LOOM-CONVENTIONS.md`) describing the
  JSON-first layout, CLI conventions, verb taxonomy.

**Out**:
- Any modification to existing trout-* skills, scripts, or projects.
- Planning of any kind: no `loom-plan` skill, no slug-suggestion verb,
  no plan-iteration support. Planning belongs to a future, separate
  substrate.
- Migration from old markdown projects to loom JSON.
- Griot and guild substrate. Loom is project-memory only.
- Compiled binary or npm distribution. Loom is TypeScript run via
  node + `bin/loom` shim.
- `pr motivation-check` verb. Deferred — useful pattern but tied to
  one specific PR-body design; revisit when loom-pr is built.
- `events append` as a public verb. Internal util only; state changes
  flow through high-level verbs that auto-append events.

**Deferred**:
- Successor for the existing trout substrate.
- Lifting retros to a griot CLI when one exists.
- Schema migrations (when schema_version eventually bumps).

## Methodology — TDD throughout

Every verb is built test-first:

1. **Fixture first.** Author a representative JSON input/output
   example for the verb. Lives in `cli/fixtures/` or alongside.
2. **Failing test.** Write the vitest `<verb>.test.ts` asserting
   expected JSON output for the fixture. Run it; confirm it fails.
3. **Implement.** Write the verb until the test passes.
4. **Refactor.** Once green, tidy. Tests stay green.

Phase 1 is a special case: the deliverable *is* the spec. Schemas
land with fixture JSON files demonstrating every shape, plus
validation tests that round-trip every fixture.

Skills are LLM prose, not code, so they get **smoke tests at phase
boundaries**: each skill runs end-to-end on a throwaway project,
produces the expected files, verifier eyeballs the output.

## CLI surface (target)

Eight namespaces, ~22 verbs. JSON output by default; `--pretty`
on read verbs for human view.

- `project` — `scaffold <slug>`, `read <slug>`, `list` (alias `ls`),
  `status`, `archive <slug>`
- `phase` — `read <slug> <N>`, `list <slug>`,
  `update <slug> <N> --status= [--branch=] [--pr=]`
- `events` — `read <slug>`, `latest <slug>`
- `checkin` — `write`, `list`, `read`, `latest`
- `session` — `write`, `list`, `read`, `corrections`
- `pr` — `open`, `update`, `discover`, `comments`, `respond`
- `retro` — `write --type=session|project`, `list`, `read`
- `doctor` — `doctor [<slug>]`

Every `<slug>` argument resolves date-less form, full form, or path.
Ambiguous match → structured error with candidates.

## Phases

Four phases. One PR per phase. Each phase ships demoable end-to-end
functionality.

### Phase 1 — Schemas + fixtures (no production code)

JSON schemas for every substrate file, expressed as TypeScript types
in `cli/lib/types.ts`. Representative fixtures in `cli/fixtures/`
covering every shape and every edge case (every phase status, every
event type, every PR marker state, both retro types). Round-trip
validation tests.

Ship `projects/LOOM-CONVENTIONS.md` describing the JSON-first
substrate, CLI conventions (JSON-by-default, structured errors,
exit codes), verb taxonomy, directory layout.

Deliverable: schemas + fixtures + tests + conventions doc.
No CLI implementation yet.

Verification: every fixture round-trips clean; conventions doc is
internally consistent.

### Phase 2 — Foundations + read API

Stand up the CLI: entry point, command dispatch, help system,
`bin/loom` shim. Internal storage lib (read manifest.json,
events.jsonl, config.json, checkin/session/retro JSON) implementing
the Phase 1 schemas.

Build read verbs (introspection — same surface for loops and humans):
- `project read/list/status`
- `phase read/list`
- `events read/latest`
- `checkin list/read/latest`
- `session list/read`
- `retro list/read`
- `doctor`

Each verb test-first. Slug resolution lib included.

Verification: every verb returns valid JSON matching schemas;
`bin/loom <verb> --pretty` renders human view; tests pass.

### Phase 3 — Lifecycle write API + lifecycle skills

State-modifying verbs:
- `project scaffold <slug> --plan-file= --config-file=`
- `project archive <slug>` (coordinates manifest update + relocate;
  non-atomic; `doctor` reports drift if relocate fails)
- `phase update <slug> <N> --status= [--branch=] [--pr=]`
- `checkin write <slug> --checkin-file=`
- `session write <slug> --session-file=`
- `session corrections <slug> [--since-checkin=]`
- `retro write <slug> --type=session|project ...`

Skills:
- `loom-session` — composes session JSON from cwd state + recent
  events, calls `session write`
- `loom-archive` — interview + corpus synthesis → retro JSON →
  `retro write --type=project` → `project archive`

Verbs test-first; skills smoke-tested.

### Phase 4 — PR write API + PR skills

PR verbs:
- `pr discover <slug> --branch=` → `{checkins[], marker_state, pr}`
- `pr open <slug> --title= --body-file= [--branch=]`
- `pr update <slug> --pr= --body-file=`
- `pr comments <slug> --pr=` (wraps gh)
- `pr respond <slug> --pr= --responses-file=`

Skills:
- `loom-pr` — composes PR title + body from checkin JSON; uses
  `pr discover` + `pr open`/`pr update`
- `loom-pr-respond` — classifies comments from `pr comments`, drafts
  responses, calls `pr respond`

Verbs test-first; skills smoke-tested.

## Dependencies

- Phase 1 (schemas) merges before Phase 2.
- Phase 2 (foundations + read API) merges before Phase 3.
- Phase 3 merges before Phase 4. Nominally Phases 3 and 4 are
  independent, but sequential keeps the storage lib stable.

## Verification

- `npm run lint` (Biome)
- `npm run test` (vitest — every verb ships with sibling test, written first)
- `npm run build` (defensive)
- Manual end-to-end at each phase boundary against throwaway projects.

## Risks

- **Schema lock-in**: getting schemas wrong in Phase 1 forces rework
  downstream. Mitigation: review-heavy Phase 1 PR; round-trip tests
  catch ambiguity; `schema_version` reserved.
- **Forcing structure on what was narrative**: checkin Execution
  becomes a structured shape, not prose. Risk: feels constraining.
  Mitigation: design with real existing checkins as the design
  corpus; iterate before locking in.
- **Coexistence with existing trout substrate**: distinct skill
  prefixes; distinct file shapes; no overlapping paths.
- **TDD discipline drift**: easy to slip into implementation-first
  on tricky verbs. Mitigation: PR description names TDD as required;
  reviewer checks git history for test-before-impl order.
- **bin/loom executable bit**: must survive git on Linux runners.
- **Archive non-atomicity**: `project archive` writes manifest then
  relocates dir. If relocate fails, manifest says archived but dir
  remains. Mitigation: `doctor` reports the inconsistency; manual
  recovery is straightforward.

## Decisions

Resolved during planning; baked into Phase 1's conventions doc.

- **Schemas form**: TypeScript types in `cli/lib/types.ts`. No
  runtime JSON Schema validation — loom controls all inputs.
  Round-trip tests against fixtures are the contract.
- **Events storage**: append-only `events.jsonl` separate from
  `manifest.json`. No whole-file rewrite per event; clean separation
  of state vs audit log.
- **Retro storage**: flat `retros/` directory. Type (`session` |
  `project`) is a field in the retro JSON, not a path component.
  Easier to lift into a future griot CLI without rewriting paths.
- **Internal lib layout**: one file per domain in `cli/lib/` —
  `manifest.ts`, `events.ts`, `project.ts`, `checkin.ts`,
  `session.ts`, `retro.ts`, `types.ts`. Mirrors the verb namespaces.
- **Checkin execution shape**: structured `{actions[],
  files_touched[], corrections[]}`. Prose composition happens at
  output time (PR bodies, retrospectives), not in storage. Exact
  field set finalized in Phase 1's conventions doc.

## Open questions

- **PR comments shape**: how much classification structure does
  `pr comments` impose vs leave to the consuming skill? Phase 4
  decides.
