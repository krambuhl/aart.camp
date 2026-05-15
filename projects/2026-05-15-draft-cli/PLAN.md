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
imports these directly. The `LoomError` name is asymmetric for draft —
documented in `## Decisions` and accepted; renaming the substrate error
is out of scope for this project.

Two outputs land per project:

- `projects/<date>-<slug>/PLAN.md` — the clean final shape. Polished,
  structured, no scratch.
- `projects/<date>-<slug>/INTERVIEW.md` — the grill-me trail. Decision
  tree as it was walked. Birth-time artifact alongside the canonical
  one. (Renamed from RESEARCH.md per round-1 whiteboard feedback —
  the file's role is "the interview transcript," not "research
  notes.")

Two interfaces:

- `/draft-plan <topic>` — user-invoked skill at project birth. Runs
  grill-me, synthesizes INTERVIEW.md and PLAN.md, calls the CLI to
  commit them.
- `/draft-revise <slug>` — thin skill invoked by loop skills when a
  scope-shift signal fires. Composes the revision file (full new
  PLAN.md content reflecting the change), surfaces it to the user
  for confirm, shells out to `bin/draft revise`. No grill-me ceremony
  — that's reserved for initial planning. Lifted to a skill (per
  round-1 whiteboard feedback) so the composer logic has a single
  locus rather than being inlined into multiple loop skills.

Revisions live in git history plus an in-PLAN `## Revision log` tail
section authored by `bin/draft revise --rationale=<str>`. The commit
message and the log entry both carry the rationale. "Draft" is the
implicit state of a plan-in-progress, known-only-when-complete. No
`REVISION-N.md` files.

## Scope

**In:**

- `.claude/cli/draft.ts` + `bin/draft` shim. Mirrors loom-cli's CLI
  layout exactly (same entry pattern as `.claude/cli/loom.ts`, same
  bash shim shape as `bin/loom`).
- **Pure/effect split per verb.** Each verb is a pure function
  returning a plan (`{filesToWrite, commitMessage, gitArgs}` or
  similar shape) — testable directly against fixtures. A thin wrapper
  executes the plan against the real filesystem and git. Mirrors
  loom.ts's `parseInvocation` / `dispatch` separation.
- CLI verbs: `plan`, `revise`, `read`. Flat namespace.
- CLI flags: `plan` takes `--plan-file=<path>`, `--interview-file=<path>`,
  optional `--no-commit`. `revise` takes `--revision-file=<path>`,
  required `--rationale=<str>`, optional `--no-commit`. `read` takes
  `--pretty`.
- **Imports from loom-cli's lib**: `resolveProject` from
  `.claude/cli/lib/project.ts` for fuzzy slug matching; `LoomError`
  from `.claude/cli/lib/errors.ts` for structured errors. A new
  `createSlug(topic, today): slug` helper lands in
  `.claude/cli/lib/project.ts` (alongside `resolveProject`) — it's a
  naming primitive, belongs in the shared lib. Test-covered.
- TypeScript types in `.claude/cli/lib/draft-types.ts` (or inline if
  minimal) + fixtures in `.claude/cli/fixtures/` (e.g.
  `draft-plan-basic.json`, `draft-revise-basic.json`,
  `draft-read-basic.json`) + round-trip tests covering every verb
  input/output shape. Tests are written first (TDD mirroring
  loom-cli).
- Edge-case fixture coverage: `plan` against directory-exists-but-no-
  PLAN.md (should succeed); `plan` re-run after failed commit (should
  succeed via the "uncommitted PLAN.md is overwritable" rule);
  `revise` against missing PLAN.md (errors with `plan-not-found`,
  message suggests `plan` as remedy).
- `/draft-plan` skill. SKILL.md authors the grill-me interview as
  prose. Synthesizes INTERVIEW.md (walked decision tree) and PLAN.md
  (clean shape). Shells out to `bin/draft plan` for file IO and
  commit.
- `/draft-revise` skill. SKILL.md is short. Takes slug + scope-shift
  context. Composes a revision file (full new PLAN.md) from current
  PLAN.md + the signal. Surfaces summary to user, gets confirm,
  shells out to `bin/draft revise --rationale=<short summary>`.
- Loop wiring: `ev-loop-confidence` and `ev-loop-interactive` gain a
  scope-shift detection step with **restrictive default** — only
  offers `/draft-revise` when at least two signals concur (e.g.,
  evaluator finding *and* user comment, or whiteboard contradiction
  *and* explicit phase-boundary). One-signal heuristics surface in
  the unit's notes for later review but do not interrupt.
- Smoke tests at phase boundary: throwaway project, run `/draft-plan`,
  verify PLAN.md + INTERVIEW.md committed; simulate two-signal scope-
  shift, verify `/draft-revise` proposes a revision and `bin/draft
  revise --rationale=...` updates PLAN.md, log, and commits.

**Out:**

- Config.md, MANIFEST.md, sessions/, checkins/. Run `/trout-plan`
  afterward (or `loom project scaffold` once Phase 3 of loom-cli
  ships) to add execution substrate.
- Replacement of `/trout-plan`. Both coexist; user picks based on
  confidence.
- A new PLAN.md template. Reuses the existing `/trout-plan` template
  (Context / Scope / Phases / Dependencies / Verification / Risks /
  Open questions), optionally extended with `## Decisions` and `##
  Revision log` per loom-cli's PLAN convention.
- JSON storage. PLAN.md and INTERVIEW.md are markdown — narrative,
  human-first.
- A `/draft-finalize` verb. "Draft" is implicit state; plans become
  final when the project archives.
- Renaming `LoomError` to `CliError`. Out of scope. Accepted asymmetry;
  documented.
- Renaming `/draft-plan` skill to disambiguate from `bin/draft plan`
  verb. Accepted matched naming; the seam is documented in the skill
  body.
- Subnamespaces in the CLI verb surface. Draft is three flat verbs.

**Deferred:**

- Auto-promotion of scope-shift detection from "loop offers revise" to
  "loop auto-rewrites." V1 is two-signal-concurrence offer + user
  confirm; gather data; iterate.
- A grill-me ceremony inside `/draft-revise`. V1 is surgical: read
  signal, compose, confirm, commit. If revision quality slips,
  upgrade.
- Loom convergence: when `loom project scaffold` lands (Phase 3 of
  loom-cli), revisit whether `bin/draft plan` delegates to it or stays
  self-contained.
- A formal scope-shift signal schema (evaluator output field, manifest
  event type). Start heuristic with two-signal-concurrence.
- Extracting the PLAN.md template to `projects/PLAN-TEMPLATE.md` as a
  single source of truth. Defer until a third writer appears.

## Methodology — TDD throughout

Mirrors loom-cli. Every CLI verb is built test-first:

1. **Fixture first.** Author a representative input/output example for
   the verb under `.claude/cli/fixtures/` (same directory loom uses;
   draft fixtures are namespaced by filename, e.g.
   `draft-plan-basic.json`, `draft-revise-basic.json`).
2. **Failing test.** Write the vitest `<verb>.test.ts` asserting expected
   output from the *pure* verb function for the fixture. Confirm it
   fails.
3. **Implement the pure verb.** Write the function until the test
   passes. Then implement the thin IO wrapper. Side effects are only
   exercised in integration / smoke tests, not in the unit tests.
4. **Refactor.** Once green, tidy. Tests stay green.

The skills are LLM prose, not code, so they get **smoke tests at the
phase boundary**: end-to-end run on a throwaway project, produces
both files, eyeball the output. `/draft-revise` smoke covers the
revision path.

## CLI surface (target)

Three flat verbs. JSON output by default on reads; `--pretty` for human
view (same convention as loom-cli).

- `plan <slug-or-topic> --plan-file=<path> --interview-file=<path> [--no-commit]` —
  creates `projects/<date>-<slug>/` if PLAN.md doesn't already exist;
  writes PLAN.md and INTERVIEW.md from the provided files. By default
  runs `git add <both-files-by-name> && git commit`. With `--no-commit`,
  files are written but not staged/committed. Refuses if PLAN.md
  already exists *and* is committed; if PLAN.md exists but is
  uncommitted (prior run that failed at commit), allows overwrite.
  Slug resolution: for new projects, `createSlug(topic, today)` builds
  `<YYYY-MM-DD>-<slugify(topic)>`; for existing projects, errors with
  `project-already-exists` (use `revise` instead).
- `revise <slug> --revision-file=<path> --rationale=<str> [--no-commit]` —
  uses `resolveProject` to find the existing project; replaces PLAN.md
  with the revision content; appends a one-line entry to PLAN.md's `##
  Revision log` section (date, rationale, will-be commit SHA);
  `git add PLAN.md && git commit -m "[draft revise] <slug>: <rationale>"`.
  Errors on missing project (`project-not-found`) or missing PLAN.md
  (`plan-not-found`, error message suggests `plan` as remedy). Does
  not touch INTERVIEW.md.
- `read <slug> [--pretty]` — emits a JSON envelope structurally
  compatible with loom's read verbs:
  ```json
  {
    "path": "projects/<date>-<slug>/PLAN.md",
    "content": "<full markdown>",
    "plan": {
      "slug": "<slug>",
      "interview_path": "projects/<date>-<slug>/INTERVIEW.md"
    }
  }
  ```
  `--pretty` renders PLAN.md content directly (no envelope).

## Skill-to-CLI contract

Documented once here, cited from both skills.

- Skills shell out via `bin/draft <verb> <args>`.
- CLI emits JSON to stdout on success; structured error JSON to stderr
  with non-zero exit on failure. Error codes are stable: `project-not-
  found`, `project-already-exists`, `plan-not-found`, `plan-exists-
  committed`, `missing-required-arg`, `invalid-rationale`.
- Skills parse the JSON envelope. On error, the skill surfaces the
  structured error to the user verbatim and stops.
- Exit codes: 0 success, 1 user-recoverable error, 2 internal error.

## Phases

### Phase 1: Ship CLI + two skills + loop wiring

Single PR per user direction. CLI deliverables are now small because
loom-cli has already shipped slug resolution, error shape, the shim
convention, and the fixture layout.

Deliverables:

1. **`createSlug` in `lib/project.ts`.** Tiny shared-lib addition.
   Test-first. Lives in loom-cli's lib so the naming primitive has
   one home.

2. **CLI entry + shim.** `.claude/cli/draft.ts` (parseInvocation
   pattern adapted from loom.ts — flat verb dispatch, no NAMESPACES
   registry). `bin/draft` shim mirroring `bin/loom`. Imports
   `resolveProject`, `createSlug`, `LoomError`.

3. **`plan` verb.** Pure verb function + thin IO wrapper. Test-first.
   Fixture covers happy path plus directory-exists-no-PLAN.md and
   uncommitted-overwrite cases. `--no-commit` flag.

4. **`revise` verb.** Pure verb function + thin IO wrapper.
   Test-first. Fixture covers happy path, missing-PLAN, and revision-
   log append. `--rationale` required, `--no-commit` optional.

5. **`read` verb.** Pure verb function + thin IO wrapper. Test-first.
   JSON envelope shape per § Skill-to-CLI contract; `--pretty` for
   humans.

6. **`/draft-plan` skill.** Grill-me interview as prose,
   recommendation-per-question pacing. Synthesizes INTERVIEW.md (the
   walked tree) and PLAN.md (clean shape) at the end. Shells out to
   `bin/draft plan --plan-file=... --interview-file=...`. Reuses
   existing PLAN.md template from `/trout-plan` (cross-referenced).
   Skill body documents the seam: `/draft-plan` (skill) and
   `bin/draft plan` (CLI) are distinct surfaces serving distinct
   audiences.

7. **`/draft-revise` skill.** Thin. Takes slug + scope-shift context
   from the calling loop. Reads current PLAN.md, composes a full new
   PLAN.md reflecting the change, surfaces a summary to the user for
   confirm, shells out to `bin/draft revise --rationale=<summary>`.
   No grill-me ceremony in v1.

8. **Loop wiring.** Add scope-shift detection to `ev-loop-confidence`
   and `ev-loop-interactive`. **Restrictive default**: only offers
   `/draft-revise` when at least two signals concur (e.g., evaluator
   finding *and* user comment, or whiteboard contradiction *and* phase
   boundary). One-signal cases surface in the unit's `Notes for the
   PR` for later review but do not interrupt. On confirm, invokes
   `/draft-revise <slug>` via the Skill tool.

9. **Smoke tests + phase close.** Throwaway project. Run `/draft-plan`;
   verify both files committed. Simulate two-signal scope-shift in a
   loop run; verify `/draft-revise` proposes a revision, user confirm
   triggers `bin/draft revise`, PLAN.md is updated, revision log
   appended, commit lands.

**Verification:**

- `npm run lint` (Biome) clean.
- `npm run test` clean (vitest covers every CLI verb, written
  test-first; `createSlug` covered too).
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
  extract to a shared `projects/PLAN-TEMPLATE.md` if a third writer
  appears.
- **PLAN.md collision.** Mitigation: `plan` verb refuses on committed
  PLAN.md; allows overwrite on uncommitted PLAN.md (recovery from
  failed commit). Suggests `revise` in the error message when refusing.
- **Scope-shift detection too noisy or too quiet.** Mitigation:
  restrictive default (two-signal-concurrence) for v1. Single signals
  surface in notes, do not interrupt. Iterate based on real data.
- **Grill-me interview length.** Relentless interview can drag.
  Mitigation: skill body sets pacing instructions (stop when user
  approves or decision tree resolves; one or two questions at a time).
  v1 uses LLM working memory; if interviews reliably blow context,
  revisit with a scratch-file approach.
- **Coupling to loom-cli's lib.** Mitigation: small import surface
  (`resolveProject`, `createSlug`, `LoomError`); if loom changes their
  signatures, draft updates in lockstep. Pin import list in code review.
- **`LoomError` name asymmetry in draft.** Mitigation: accepted and
  documented in Decisions. Substrate-wide rename is deferred to a
  separate effort if/when it earns its weight.
- **`/draft-plan` skill name echoes `bin/draft plan` verb.** Two
  surfaces, matched names. Mitigation: skill body documents the seam
  explicitly. Accept the cost; the alternative (renaming one of them)
  was deemed worse.
- **Atomicity: partial write then commit failure.** Mitigation: the
  "uncommitted PLAN.md is overwritable" rule. Re-running `plan`
  recovers without manual cleanup. Fixture covers this path.
- **TDD discipline drift.** Mitigation: PR description names test-first
  as required; reviewer checks git history for test-before-impl order.
- **Composer-in-skill (rather than in-loop) lock-in.** `/draft-revise`
  is the single locus for revision composition. If it turns out the
  composition needs grill-me, the upgrade is localized to one skill
  body. Risk is small.

## Decisions

Resolved during planning + round-1 whiteboard; baked into the
implementation.

- **CLI lives at `.claude/cli/draft.ts`** following loom-cli's layout
  convention. `bin/draft` shim mirrors `bin/loom`.
- **Draft imports loom-cli's lib.** `resolveProject`, `createSlug`
  (new, lands in same lib), and `LoomError` from `.claude/cli/lib/`.
  Draft is a sibling consumer of loom's substrate utilities.
- **PLAN.md is the clean final shape; INTERVIEW.md is the working
  trail.** Grill-me notes never bleed into PLAN.md. Both files are
  committed; both live next door in the project directory. INTERVIEW.md
  is a birth-time artifact — explicitly *not* updated by `revise`;
  goes stale relative to PLAN.md by design.
- **Revision rationale lives in two places.** `bin/draft revise
  --rationale=<str>` bakes the rationale into the commit message
  (stable shape: `[draft revise] <slug>: <rationale>`) AND appends a
  dated entry to PLAN.md's `## Revision log` section. The log entry
  survives outside-of-repo viewing; the commit message survives in git
  blame.
- **Collision check is on PLAN.md existence + committed status.**
  Committed → refuse (suggest `revise`). Uncommitted → allow overwrite
  (recovery from failed commit). Directory existing without PLAN.md is
  fine.
- **Revisions are full PLAN.md replacements, not patches.**
  `revise --revision-file=` takes the new full content. Git handles the
  diff; the revision log captures the rationale.
- **No new PLAN.md template.** Reuses `/trout-plan`'s, extended with
  `## Decisions` and `## Revision log` sections per loom-cli's
  convention.
- **Flat verb namespace.** Three verbs, no subnamespaces.
- **Pure/effect split per verb.** Pure verb functions return plans;
  thin wrappers execute IO. Mirrors loom.ts. Critical for
  fixture-driven TDD.
- **`/draft-revise` is a thin skill, not inlined loop prose.** Single
  locus for composer logic. No grill-me ceremony in v1.
- **Scope-shift detection is restrictive by default.** Two-signal
  concurrence required to offer revise. Single signals surface in
  notes; do not interrupt.
- **Skill-to-CLI contract is documented in § Skill-to-CLI contract
  above.** Stable error codes, JSON envelope shape, exit code
  conventions.
- **`read` JSON envelope matches loom's read-verb shape.**
  `{path, content, plan: {...}}` — structurally compatible with
  loom's pattern so introspection scripts don't have to learn two
  envelopes.
- **`LoomError` name is kept.** Asymmetric for draft but renaming is
  out of scope. Documented; not silent.
- **`/draft-plan` skill name kept.** Matches `bin/draft plan` verb in
  name; skill body documents that they are distinct surfaces.

## Open questions

- Should `bin/draft plan` accept piped stdin for PLAN/INTERVIEW content
  as an alternative to `--plan-file=` / `--interview-file=`? Lean no —
  temp files are simpler for skills, and stdin would force
  one-file-at-a-time which breaks the atomicity invariant. Revisit if
  friction.
- Should `bin/draft revise` accept a `--no-rationale` escape hatch for
  fully programmatic invocations? Lean no — rationale is the load-
  bearing artifact for the revision trail; making it optional would
  invite empty rationales. If a programmatic caller doesn't know what
  to put, ask the user.
- Should `read` emit phase / section breakdowns in the JSON envelope
  (parsing PLAN.md markdown into structured fields), or just `path` +
  `content`? Lean minimal in v1 — match loom's shape, defer
  structured parsing until a consumer asks.
