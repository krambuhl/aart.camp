# Draft: a grill-me-shaped planning CLI and skill

## Context

Today the project substrate has one planning entry point: `/trout-plan`,
which interviews briefly and scaffolds the full project ceremony in a
single act. That's the lightweight "I know what I want" path. There's
no heavyweight "grill me until we're sure" path — relentless interview,
one decision at a time, recommendation each time, walking down each
branch of the decision tree.

This project ships that path as a sibling substrate: **draft**. A small
CLI that owns the deterministic CRUD of plan files, and a grill-me-shaped
skill that drives the conversation. Drafts are angular to project
execution details (config, manifest, sessions, checkins) — those belong
to `/trout-plan` today and `loom` going forward. The symmetry mirrors
loom-cli's "angular to planning" posture: loom owns project state, draft
owns plan authoring, they meet at `PLAN.md`.

Draft is **a sibling consumer of loom-cli's CLI substrate**, not a
duplicate. Loom-cli has already shipped `.claude/cli/lib/project.ts`
(fuzzy slug resolution via `resolveProject(slugOrPath, projectsRoot)`),
`lib/errors.ts` (structured `LoomError` pattern), the `bin/<name>` shim
convention, and the `.claude/cli/fixtures/` test-data layout. Draft
imports these directly; it does not reimplement them.

Two outputs land per project:

- `projects/<date>-<slug>/PLAN.md` — the clean final shape. Polished,
  structured, no scratch.
- `projects/<date>-<slug>/RESEARCH.md` — the grill-me trail. Decision
  tree as it was walked. Working artifact alongside the canonical one.

Two interfaces:

- `/draft-plan <topic>` — user-invoked skill at project birth. Runs
  grill-me, synthesizes RESEARCH.md and PLAN.md, calls the CLI to commit
  them.
- `draft revise <slug> --revision-file=<file>` — CLI-only verb. Replaces
  PLAN.md with the revision content, commits. Invoked by loop skills when
  a scope-shift signal fires. There is intentionally no `/draft-revise`
  skill; revisions are surgical, not ceremonial.

Revisions live in git history. "Draft" is the implicit state of a
plan-in-progress, known-only-when-complete. No `REVISION-N.md` files.

## Scope

**In:**

- `.claude/cli/draft.ts` + `bin/draft` shim. Mirrors loom-cli's CLI
  layout exactly (same entry pattern as `.claude/cli/loom.ts`, same
  bash shim shape as `bin/loom`).
- CLI verbs: `plan`, `revise`, `read`. Flat namespace (no
  `project`/`phase`/etc subnamespaces — draft is small enough that
  loom's multi-namespace registry is overkill).
- **Imports from loom-cli's lib**: `resolveProject` from
  `.claude/cli/lib/project.ts` for fuzzy slug matching;
  `LoomError`-style structured errors from `.claude/cli/lib/errors.ts`
  (or a draft-specific subclass if separating error codes proves
  useful). No duplication of slug-resolution or error-shape code.
- TypeScript types in `.claude/cli/lib/draft-types.ts` (or inline in
  `draft.ts` if minimal) + fixtures in `.claude/cli/fixtures/` +
  round-trip tests covering every verb input/output shape. Tests are
  written first (TDD throughout, mirroring loom-cli's methodology).
- `/draft-plan` skill. SKILL.md authors the grill-me interview as
  prose. Synthesizes both RESEARCH.md (the walked decision tree) and
  PLAN.md (the clean shape) from the interview. Shells out to
  `bin/draft plan` for file IO and commit.
- Loop wiring: `ev-loop-confidence` and `ev-loop-interactive` gain a
  scope-shift detection step. When a deliverable surfaces a signal that
  PLAN.md is stale (evaluator finding implying a new phase, contract
  divergence, user comment, possibly `guild-whiteboard` output that
  contradicts current PLAN), the loop offers a revision. On confirm,
  the loop composes a revision file (full new PLAN.md content
  reflecting the change) and calls
  `bin/draft revise <slug> --revision-file=<tmp>`.
- Smoke tests at phase boundary: throwaway project, run `/draft-plan`,
  verify both files committed; simulate loop-side revision, verify
  `bin/draft revise` updates PLAN.md and commits.

**Out:**

- `/draft-revise` skill. Intentionally not built. Revisions are CLI-only.
- Config.md, MANIFEST.md, sessions/, checkins/. Run `/trout-plan`
  afterward (or `loom project scaffold` once Phase 3 of loom-cli ships)
  to add execution substrate.
- Replacement of `/trout-plan`. Both coexist; user picks based on
  confidence.
- A new PLAN.md template. Reuses the existing `/trout-plan` template
  (Context / Scope / Phases / Dependencies / Verification / Risks /
  Open questions), optionally extended with `## Decisions` per
  loom-cli's PLAN convention if grill-me sessions surface load-bearing
  decisions worth pinning.
- JSON storage. PLAN.md and RESEARCH.md are markdown — narrative,
  human-first.
- A `/draft-finalize` verb. "Draft" is implicit state; plans become
  final when the project archives.
- Subnamespaces in the CLI verb surface. Draft is three flat verbs.

**Deferred:**

- Auto-promotion of scope-shift detection from "loop offers revise" to
  "loop auto-rewrites." Start with offer; gather signal; iterate.
- Lifting `/draft-revise` to a skill if loop-side revision composition
  turns out to want its own grill-me ceremony.
- Loom convergence: when `loom project scaffold` lands (Phase 3 of
  loom-cli), revisit whether `bin/draft plan` delegates to it or stays
  self-contained.
- A formal scope-shift signal schema (evaluator output field, manifest
  event type). Start heuristic.

## Methodology — TDD throughout

Mirrors loom-cli. Every CLI verb is built test-first:

1. **Fixture first.** Author a representative input/output example for
   the verb under `.claude/cli/fixtures/` (same directory loom uses;
   draft fixtures are namespaced by filename, e.g.
   `draft-plan-basic.json`, `draft-revise-basic.json`).
2. **Failing test.** Write the vitest `<verb>.test.ts` asserting expected
   output for the fixture. Confirm it fails.
3. **Implement.** Write the verb until the test passes.
4. **Refactor.** Once green, tidy. Tests stay green.

The skill is LLM prose, not code, so it gets a **smoke test at the phase
boundary**: end-to-end run on a throwaway project, produces both files,
eyeball the output.

## CLI surface (target)

Three flat verbs. JSON output by default on reads; `--pretty` for human
view (same convention as loom-cli).

- `plan <slug-or-topic> --plan-file=<path> --research-file=<path>` —
  creates `projects/<date>-<slug>/` if PLAN.md doesn't already exist;
  writes PLAN.md and RESEARCH.md from the provided files; `git add` +
  `git commit`. Refuses if PLAN.md already exists (suggests `revise`
  instead). Slug resolution: today's date prepended for new projects;
  for existing projects use loom's `resolveProject`.
- `revise <slug> --revision-file=<path>` — uses `resolveProject` to
  find the existing project; replaces PLAN.md with the revision
  content; `git add` + `git commit`. Errors on missing project
  (LoomError `project-not-found`) or missing PLAN.md
  (`plan-not-found`). Does not touch RESEARCH.md.
- `read <slug>` — emits PLAN.md path + content as JSON; `--pretty`
  renders the file directly. Same JSON-by-default / `--pretty`-for-humans
  pattern as loom's read verbs.

## Phases

### Phase 1: Ship CLI + skill + loop wiring

Single PR per user direction. The CLI deliverables are now small because
loom-cli has already shipped slug resolution, error shape, the shim
convention, and the fixture layout.

Deliverables:

1. **CLI entry + shim.** `.claude/cli/draft.ts` (parseInvocation pattern
   adapted from loom.ts but flat verb dispatch; no NAMESPACES registry).
   `bin/draft` shim (copy of `bin/loom` with the entry path swapped).
   Imports `resolveProject` and `LoomError` from existing loom lib.

2. **`plan` verb.** Test-first. Fixture under
   `.claude/cli/fixtures/draft-plan-basic.json`. Creates project
   directory with today's date prefix, writes PLAN.md and RESEARCH.md
   from `--plan-file=` and `--research-file=`, runs `git add` + `git
   commit`. Refuses on existing PLAN.md.

3. **`revise` verb.** Test-first. Fixture for the happy path + the
   `plan-not-found` error. Resolves slug via `resolveProject`, replaces
   PLAN.md, commits.

4. **`read` verb.** Test-first. JSON-by-default; `--pretty` renders
   PLAN.md content directly.

5. **`/draft-plan` skill.** Grill-me interview as prose,
   recommendation-per-question pacing. Synthesis step that emits both
   RESEARCH.md (the walked tree) and PLAN.md (clean shape). Shells out
   to `bin/draft plan --plan-file=... --research-file=...`. Reuses
   existing PLAN.md template from `/trout-plan` (cross-referenced, not
   duplicated).

6. **Loop wiring.** Add a "scope-shift detection" step to
   `ev-loop-confidence` and `ev-loop-interactive`. When a deliverable's
   evaluator findings, user comments, or `guild-whiteboard` output
   imply PLAN.md is stale, the loop pauses, summarizes the proposed
   change to the user, composes a revision file (full new PLAN.md
   content reflecting the change), and on confirm runs `bin/draft
   revise <slug> --revision-file=<tmp>`. Resumes the deliverable
   afterward.

7. **Smoke tests.** End-to-end on a throwaway project: `/draft-plan`
   writes both files; simulated loop scope-shift triggers `bin/draft
   revise`; verify commits land.

**Verification:**

- `npm run lint` (Biome) clean.
- `npm run test` clean (vitest covers every CLI verb, written
  test-first).
- `npm run build` clean.
- Manual smoke through the throwaway project end-to-end.

**One PR.**

## Dependencies

None.

## Verification

- `npm run lint`
- `npm run test`
- `npm run build`
- Manual smoke against a throwaway project.

## Risks

- **Template drift between `/draft-plan` and `/trout-plan`.** Both write
  PLAN.md; if templates diverge silently, projects become inconsistent.
  Mitigation: cross-reference the template shape in both skills;
  consider a shared template stub if a third writer appears.
- **PLAN.md collision.** If `/trout-plan` runs first on a slug,
  `/draft-plan` should not clobber. Mitigation: `plan` verb refuses on
  existing PLAN.md and points the user at `revise` (with a manual
  revision file) or a different slug.
- **Scope-shift detection too noisy or too quiet.** Loop heuristics for
  "is this a scope shift?" are fuzzy. Mitigation: start permissive on
  the offer side, let user dismiss; iterate based on real signal. No
  auto-revise without user confirm in v1.
- **Grill-me interview length.** Relentless interview can drag.
  Mitigation: skill body sets pacing instructions (stop when the user
  approves or the decision tree resolves; one or two questions at a
  time).
- **Coupling to loom-cli's lib.** Draft imports `resolveProject` and
  error types from loom's `lib/`. If loom changes those signatures,
  draft breaks. Mitigation: small, well-named import surface; if loom
  ever refactors the lib, draft updates in lockstep (one PR, the
  signatures are simple).
- **TDD discipline drift.** Easy to slip into implementation-first on
  small verbs. Mitigation: PR description names test-first as required;
  reviewer checks git history.

## Decisions

Resolved during planning; baked into the implementation.

- **CLI lives at `.claude/cli/draft.ts`** following loom-cli's layout
  convention. `bin/draft` shim mirrors `bin/loom`.
- **Draft imports loom-cli's lib.** `resolveProject` from
  `.claude/cli/lib/project.ts` for slug resolution; error shape from
  `.claude/cli/lib/errors.ts`. Draft is a sibling consumer of loom's
  substrate utilities, not a parallel implementation. Resolves prior
  open question about slug-resolution duplication.
- **PLAN.md is the clean final shape; RESEARCH.md is the working trail.**
  Grill-me notes never bleed into PLAN.md. Both files are committed;
  both live next door in the project directory.
- **No `/draft-revise` skill.** Revisions are CLI-only; loop wiring
  composes revision files. If experience shows we need a grill-me
  revision ceremony, lift later.
- **Collision check is on PLAN.md existence, not directory existence.**
  Allows `/draft-plan` and `/trout-plan` to coexist on the same slug if
  needed.
- **Revisions are full PLAN.md replacements, not patches.**
  `revise --revision-file=` takes the new full content. Git handles the
  diff.
- **No new PLAN.md template.** Reuses `/trout-plan`'s template, possibly
  extended with a `Decisions` section borrowed from loom-cli if grill-me
  consistently surfaces them.
- **Flat verb namespace.** Three verbs, no subnamespaces. Draft is
  small enough that loom's `project`/`phase`/`events`/etc registry is
  overkill.

## Open questions

- Should `bin/draft plan` accept piped stdin for PLAN/RESEARCH content
  as an alternative to `--plan-file=` / `--research-file=`? Lean no —
  temp files are simpler for skills to compose. Revisit if friction.
- Does `read` add value over `cat`? Lean keep for symmetry with loom and
  for the JSON-emitting case (loops introspecting projects). Cheap to
  ship.
- Should `guild-whiteboard` output be a first-class signal source for
  scope-shift detection, alongside evaluator findings and user
  comments? Whiteboard runs pre-unit and is well-positioned to surface
  "this design contradicts PLAN" early. Lean yes-conceptually,
  no-formally-in-v1 — start with prose-level detection in the loop
  skills, formalize a signal type later if the heuristic proves
  reliable.
