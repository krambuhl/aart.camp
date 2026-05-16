# Substrate CLI

## Context

The aart.camp substrate is mid-consolidation. The `trout-sunset` project
shipped #91 → #95 over the past day, migrating project state and plan
authoring into peer CLIs under `bin/`: `bin/loom` and `bin/draft`. Trout's
entire substrate (5 skills + 16 scripts) is deleted; ev-loop SKILL.md
files now dispatch substrate operations directly to those CLIs, with
substantial named-recipe **"Substrate compositions"** sections cataloging
operations (§ State refresh, § Phase update, § Checkin write, § Compose
PR, § Triage PR comments, § Save session, § Revise PLAN.md, § Retro
write). Process steps cite these by name rather than inlining recipes
at each call site.

The pattern that emerged across trout-sunset:

- **CLI:JSON** — structured state goes in JSON, edited by the family
  CLI. Append-only logs (events.jsonl, findings.jsonl) win over
  mutable state files for parallel-work safety.
- **Skill:MD** — LLM-shaped narrative work (interviews, contracts,
  retrospectives, learnings) stays in markdown, authored by skills.
- **JSON references MD** when an artifact needs both kinds of state —
  the JSON holds structured fields plus paths to markdown bodies.

`trout-sunset` covered two of the four substrate families (loom + draft).
**This project applies the same shape to the remaining two — `griot`
(learnings) and `guild` (agent panels) — and is the "skill surface
cleanup" project that picks up trout-sunset's retro follow-ups.** It
kills the ambient wrapper skills that the new CLI verbs make obsolete,
applies the **two-axis frontmatter rubric** (disable-model-invocation
× user-invocable) across every skill in `.claude/skills/`, adopts the
**grill-me multi-choice pace** for the surviving interview-shaped skill
(`/loom-archive`), restructures griot's internal artifacts to match
the JSON/MD split, ships new evaluator + whiteboard agent families for
testing concerns (playwright, vitest, testing-strategy, substrate-
engineering), and codifies the parallel-work invariant.

Per the trout-sunset retro
(`projects/archive/2026-05-15-trout-sunset/retros/project.json`),
four follow-up themes surfaced:

- **#1 Revisions folder substrate** — PLAN.md becomes "current source
  of truth"; revisions live additively in `projects/<slug>/revisions/`.
  **Sibling project; deferred from this scope** (substantial; 3-4
  phases on its own).
- **#2 Grill-me pace audit** — adopt `/draft-plan`'s AskUserQuestion
  multi-choice pattern in `/loom-archive`. **Absorbed here.**
- **#3 Skill frontmatter audit** — apply the two-axis rubric across
  all skills. **Absorbed here.**
- **#4 Substrate gaps** (`bin/loom pr reconcile`, manifest-vs-PLAN
  drift, `bin/loom project adopt` redundancy). **Sibling batch
  project; deferred.**

Six feedback memories saved during trout-sunset close-out are the
planning constraints for this project:

- Loops invoke CLIs directly, not via skills.
- Loom and draft are paired halves of one substrate.
- Don't manually wrap prose for GitHub-rendered output.
- Grill-me multi-choice pace is the default for interview-style skills.
- PLAN.md is current state; revisions live in `/revisions` folder (per
  #1, a future change — until #1 ships this project still uses the old
  "## Revision log" pattern).
- Ambient vs user-invocable: the no-useless-ambient-skills rule applies
  only to ambient routing — `disable-model-invocation: true` +
  `user-invocable: true` is a legitimate shape for CLI-wrapping skills
  with thin synthesis.

The substrate's surviving-skill count target is **~12** across the
four families (`loom`, `draft`, `griot`, `guild`) plus 2 `ev-loop-*`
loops. Today's count is ~13 substrate-core (15 total in .claude/skills/
including global meta). The cleanup removes wrappers per the audit AND
the obvious targets (`/griot-capture`, `/griot-report`); the exact
count emerges from the audit's classifications.

## Scope

**In:**

- `bin/griot` CLI: `capture`, `use`, `mediate-panel`, `operator-checks`,
  `report` verbs. Replaces `.claude/scripts/griot/*.ts` directly.
- `bin/guild` CLI: `findings`, `derive-panel`, `parse-and-aggregate`,
  `whiteboard` verbs. Replaces `.claude/scripts/guild/*.ts` directly.
- **Skill surface cleanup**: full audit of every skill in
  `.claude/skills/` per the two-axis rubric (disable-model-invocation
  × user-invocable). For each skill: classify, justify its frontmatter,
  act per the audit's rubric (kill ambient noise; flip ambient-with-
  synthesis to non-ambient + user-invocable; pin internal substrate
  primitives to `disable-model-invocation: true`). Includes the obvious
  wrapper kills (`/griot-capture`, `/griot-report`) and any others
  surfaced by audit. Also: adopt the **grill-me multi-choice pace**
  (AskUserQuestion with 2-4 discrete options + recommendation labeled
  "(Recommended)") for `/loom-archive`'s interview body.
- griot session-notes restructure: replace today's YAML-frontmatter-
  on-`learning.md` kludge with `state.json` sidecar (classification,
  evaluator, code, frequency-count, status, promoted_as) +
  body MD files (`prompt.md`, `wrong.md`, `correction.md`,
  `learning.md`, `rubric.md`). Includes migration of any in-flight
  unprocessed notes.
- rollup format change: `learnings/rollup.md` → `learnings/rollup.json`
  (LLM-only artifact, not human-prose). New `/griot-load` skill +
  `bin/griot use --as=llm` flag renders rollup JSON to LLM-friendly
  prose at injection time.
- New `/griot-load` skill: `disable-model-invocation: true` +
  `user-invocable: true`. CLI does the rendering; skill is the
  addressable user surface for manual rollup loads. Pattern-matches
  the two-axis rubric the audit codifies.
- 4 new agent files: `evaluator-playwright`, `evaluator-vitest`,
  `whiteboard-testing-strategy`, `whiteboard-substrate-engineer`.
  Now that the project has playwright + vitest as real tools and
  substrate-design is its own recurring concern, the families
  earn dedicated panel/design voices.
- **§ Substrate compositions extraction**: extract the duplicated
  "Substrate compositions" section currently sitting in both
  `ev-loop-confidence` and `ev-loop-interactive` SKILL.md files into
  a shared reference (target: a `LOOM-CONVENTIONS.md` appendix or a
  new `projects/SUBSTRATE-COMPOSITIONS.md` — bikeshed decided in the
  phase contract). ev-loop bodies cite recipes by name from the
  shared reference. **Extraction lands before extension.**
- § extension: add named recipes for griot + guild operations to the
  shared reference (§ Load rollup, § Capture finding, § Append
  finding, § Derive panel). Replace any `.claude/scripts/<griot,guild>/*`
  references in ev-loop bodies with citations to the shared catalog.
- Parallel-work hardening pass: audit all CRUD verbs for append-only
  or branch-partitioned writes; codify the invariant in
  CONVENTIONS.md ("no shared mutable hotspots"); add explicit tests
  for any verb that touches shared state.
- CONVENTIONS.md sweep: re-articulate the "skills as interfaces vs
  workers" framing against `bin/<family>` and the four-family
  taxonomy; document the two-axis rubric for future skill authors.

**Out:**

- **#1 Revisions folder substrate** — sibling project. PLAN.md
  becomes "current source of truth"; new
  `projects/<slug>/revisions/<NN>.{md,json}` additive folder;
  `bin/draft revise` redesign. Substantial (3-4 phases) and
  orthogonal to substrate-cli's griot+guild focus. Until that ships,
  this project's revisions still use the old "## Revision log" pattern.
- **#4 Substrate gaps** — sibling batch project. Loom-side cleanup:
  `bin/loom pr reconcile` verb, manifest-vs-PLAN drift detection,
  `bin/loom project adopt` vs `bin/draft plan` auto-adopt redundancy.
  Orthogonal to substrate-cli's scope.
- ev-loop-* skill body updates pointing at `bin/loom` / `bin/draft` —
  those landed in `trout-sunset` Phase 2 (#92). This project only
  extends the same pattern for `bin/griot` and `bin/guild` operations.
- Cross-project / multi-repo griot sharing (federation). Deferred.
- `/griot-compact` judge panel redesign. The four-judge mechanism
  survives untouched.
- New evaluator catalogs / agents beyond the four named in scope.
- Eval-side `/griot-use` (project-specific catalog self-extension).
- `rollup.md` content semantics (L-NNN / AP-NNN ids, Project
  antipatterns section, citation contract). The format moves to
  JSON; the semantics stay.

**Deferred:**

- Cross-project / multi-repo griot federation.
- Eval-side `/griot-use` catalog self-extension.
- Migrating archived projects' learnings to the new rollup format
  (only the live `learnings/rollup.md` migrates).

## Phases

### Phase 1: `bin/griot` CLI + obvious wrapper kills

Move `.claude/scripts/griot/*.ts` (capture, use, mediate-panel,
operator-checks) into a new `bin/griot` CLI with subcommands matching
the verb names. Delete `.claude/skills/griot-capture/` and
`.claude/skills/griot-report/` (CRUD wrappers; classification per
two-axis rubric is documented inline in the unit contract — the
broader audit happens in Phase 3). The `/griot-compact` skill survives
(orchestrates the four-judge panel; pure LLM work).
Update `.claude/settings.json` permissions: replace
`Bash(node .claude/scripts/griot/*)` with `Bash(bin/griot *)`. Update
all in-repo references to the script paths (grep `.claude/scripts/griot`
in repo).

**Verification:** `npm run lint` clean. `npm test` covers the migrated
CLI subcommands (existing sibling tests move with the code).
`bin/griot capture --from-checkin=<path>` round-trip works (writes a
session-note folder identical to today's shape). `bin/griot use`
emits the same status line + content as today's
`.claude/scripts/griot/use.ts`. Skill registry no longer lists
`/griot-capture` or `/griot-report`.

**One PR.**

### Phase 2: `bin/guild` CLI

Move `.claude/scripts/guild/*.ts` (findings, derive-panel,
parse-and-aggregate, whiteboard) into a new `bin/guild` CLI with
subcommands matching the verb names. The three guild orchestration
skills (`/guild-spawn`, `/guild-validate`, `/guild-whiteboard`) all
survive — they invoke the Agent tool, which Node CLIs cannot. Update
`.claude/settings.json` permissions:
`Bash(node .claude/scripts/guild/*)` → `Bash(bin/guild *)`. Update
guild skill bodies' Bash invocations to point at `bin/guild`. Update
any in-repo references (grep `.claude/scripts/guild`).

**Verification:** `npm run lint` clean. `npm test` passes. `bin/guild
findings append/count` round-trips. `bin/guild derive-panel
--files=...` emits the same panel composition as today's script.
`/guild-validate` and `/guild-whiteboard` still aggregate verdicts /
write whiteboard sections correctly.

**One PR.**

### Phase 3: Skill surface cleanup (audit + grill-me)

Two passes shipped together; the project's contribution to
"trout-sunset retro themes #2 + #3."

- **Skill frontmatter audit**: scan every file in `.claude/skills/`.
  For each, classify on the two-axis rubric:
  - `user-invocable: true` + `disable-model-invocation: true` →
    user-only, non-ambient. Fine if it offers any coverage over raw
    CLI (interview, prose synthesis, multi-step orchestration).
  - `disable-model-invocation: false` (or unset) AND no real synthesis
    → ambient noise. Delete or move synthesis inline.
  - `disable-model-invocation: false` AND meaningful synthesis → judge
    case-by-case; usually flip to non-ambient + user-invocable.
  - Internal substrate primitives (`guild-spawn`, `guild-validate`,
    `guild-whiteboard`, future `/griot-load`) → pin
    `disable-model-invocation: true` always.
  Known unknowns to resolve explicitly: `/draft-plan`, `/griot-capture`
  (already killed in P1 if its branch landed first; otherwise covered
  here), `/review-skill`, `/a11y-review-file`, `/ev-loop-confidence`,
  `/ev-loop-interactive` (likely model-ambient since `/ev-run`
  dispatches them), `/ev-run` (already non-ambient).
  Output: per-skill classification, justification, and action (no-op,
  flip a flag, delete, etc.). Each action lands inline in the same PR
  with a short rationale row in the unit's Notes-for-the-PR.
- **Grill-me pace reshape for `/loom-archive`**: replace
  `/loom-archive`'s prose interview body with the AskUserQuestion
  multi-choice pattern (2-4 discrete options + first-option-Recommended
  + one question at a time or small grouped sets). Match `/draft-plan`'s
  established pattern. The skill's responsibilities don't change; only
  the interview cadence does.

**Verification:** `npm run lint` clean. Audit output document at
`projects/2026-05-16-substrate-cli/checkins/<branch>/<NN>-audit.md`
lists every skill + classification + action. Skill registry reflects
the audit's classifications after the PR merges. `/loom-archive`
SKILL.md body uses AskUserQuestion for its interview steps.

**One PR.**

### Phase 3 followup: top-level ev-loop-* + PR #101 manifest reconciliation

Discovered post-#101-merge while `/ev-run` attempted to dispatch
Phase 4: the audit's `disable-model-invocation: true` flag on
`ev-loop-confidence` and `ev-loop-interactive` blocks `/ev-run`
from composing them via the Skill tool. The intended rule was
"composed via `/ev-run`, never ambient," but the flag's actual
semantics block *all* model-driven Skill invocation, including
composition from another slash command — strictly broader than the
"no ambient routing" intent. Phase 3 shipped without a smoke-test
of the composition path, so this didn't surface until dispatch.

Two deliverables in one PR:

- **Top-level ev-loop-***: remove `disable-model-invocation: true`
  from `ev-loop-confidence.md` and `ev-loop-interactive.md`. Both
  remain `user-invocable: true`. Net result: `/ev-run`,
  `/ev-loop-confidence`, and `/ev-loop-interactive` are all
  directly invocable top-level slash commands; `/ev-run` composes
  the loops as needed and the user can also invoke a loop directly
  for a single-phase escape hatch. Update the Decisions section to
  pin the new rule against the original Phase 3 intent.
- **PR #101 manifest reconciliation**: PR #101 merged at
  2026-05-16T05:48:18Z but `manifest.json`'s Phase 3 row still
  records `pr.state: "open"`. Run
  `bin/loom phase update substrate-cli 3 --status=completed
  --pr=101 --url=https://github.com/krambuhl/aart.camp/pull/101
  --pr-state=merged` to reconcile. (The #4 substrate-gaps sibling
  project will land `bin/loom pr reconcile` for the general case;
  this is the one-off catch-up for #101.)

**Branch:** `substrate-cli/phase-3-followup`. No new manifest phase
row is added (loom lacks a `phase add` verb today, per the #4
substrate-gaps sibling project); Phase 3's manifest row stays
`completed`. This section documents the work in PLAN.md so it's
part of the project's plan history.

**Verification:** `/ev-run substrate-cli` successfully composes
`/ev-loop-interactive` via the Skill tool (smoke verifiable next
session, after the registry reloads the frontmatter changes — same
session-cache pattern as L-004). `bin/loom project read
substrate-cli --pretty` shows Phase 3's PR row with `state:
"merged"`. `npm run lint` clean.

**One PR.**

### Phase 3 followup 2: guild-* frontmatter correction

Discovered post-#102-merge while `/ev-loop-interactive` attempted to
invoke the Phase 4 whiteboard step: the Phase 3 audit's "Substrate-
internal primitives pin to `disable-model-invocation: true`" rule
applied to `guild-spawn`, `guild-validate`, and `guild-whiteboard` —
but these skills are composed by `/ev-loop-*` via the Skill tool
(whiteboard pre-step, per-unit evaluator panel). Same trap as #102:
`disable-model-invocation: true` blocks ALL model-driven Skill
invocation, not just ambient routing. Composition from another skill
fails identically to composition from a top-level command. The Phase
3 followup fixed the symptom for ev-loop-*; this followup extends the
fix to the guild-* family that ev-loop composes.

One deliverable in one PR:

- **guild-* frontmatter correction**: remove
  `disable-model-invocation: true` from `.claude/skills/guild-spawn/
  SKILL.md`, `.claude/skills/guild-validate/SKILL.md`, and
  `.claude/skills/guild-whiteboard/SKILL.md`. All three remain
  `user-invocable: false` — they are internal composition primitives,
  not top-level commands. Net result: `/ev-loop-interactive` and
  `/ev-loop-confidence` can compose `/guild-whiteboard` and
  `/guild-validate` via the Skill tool as the loop spec requires,
  while no `/guild-*` ambient slash commands appear in the registry.
  Update the audit-rubric Decision to correct the source-of-the-trap
  rule ("Substrate-internal primitives pin to `disable-model-invocation:
  true`") — the correct shape for an internal primitive composed via
  Skill from another skill is `user-invocable: false` +
  `disable-model-invocation: false`.

**Branch:** `substrate-cli/phase-3-followup-2`. No new manifest phase
row is added (same reason as the prior followup). This section
documents the work in PLAN.md so it's part of the project's plan
history.

**Verification:** Next session, `/ev-loop-interactive` successfully
composes `/guild-whiteboard` and `/guild-validate` via the Skill tool
(smoke verifiable after the registry reloads the frontmatter changes
— same session-cache pattern as L-004). `npm run lint` clean.

**One PR.**

### Phase 4: griot session-notes restructure

The original Phase 4 framing bundled three coupled changes
(session-notes shape, rollup format, /griot-compact body updates)
into one PR. The Phase 4 whiteboard round 1 (skeptic Finding 3 at
`projects/2026-05-16-substrate-cli/whiteboards/4-griot-internal-restructure.md`)
pressure-tested that bundling and surfaced a clean split-line:
session-notes shape (D1) and rollup format (D2) are independent at
the coupling level, meeting only at the `/griot-compact` body, which
can absorb edits from two separate PRs. CLAUDE.md PR conventions
("one conceptual change per PR") favor the split, and splitting
de-risks D2's schema decisions by letting D1 ship first. The session-
notes half ships here as Phase 4 proper; the rollup half ships as
Phase 4 rollup in the next branch.

One deliverable in one PR:

- **session-notes**: replace YAML-frontmatter-on-`learning.md` with a
  `state.json` sidecar. Each session-note folder gains
  `state.json` (classification, evaluator, code, frequency-count,
  status, promoted_as) and `learning.md` becomes pure prose body.
  Update `bin/griot capture` to write the new shape. Update
  `/griot-compact` SKILL body's routing logic to read `state.json`.
  Include a migration script for in-flight unprocessed notes:
  detect YAML frontmatter, extract to `state.json`, strip from
  `learning.md`. Migration runs once at PR-merge time. Migration
  script lives in `.claude/scripts/` with sibling vitest (per
  whiteboard performance recommendation — not promoted to
  `bin/griot migrate` to avoid accreting one-off migration verbs).
  Per whiteboard skeptic Finding 1: `bin/griot capture` and
  `/griot-compact` reader detect old-format files (YAML frontmatter
  on `learning.md`) and error loudly with a "restart session to pick
  up new skill body" message rather than silently mis-parsing.
  Archived session-notes scope: PLAN says "only live rollup migrates"
  but session-notes archived migration is a real cohesion question
  (whiteboard design-systems). Decision: migrate archived
  session-notes too (option (a) — preserves one-shape-per-tree
  cohesion at the small cost of touching archived data).

**Branch:** `substrate-cli/phase-4`.

**Verification:** `npm run lint` + `npm test` clean. End-to-end:
write a session-note via `bin/griot capture`, verify `state.json`
sidecar + pure-prose `learning.md`. Run `/griot-compact` over the
new-shape note and verify routing reads `state.json` successfully.
Migration: run migration script on a fixture of old-format
session-notes; verify state.json appears, frontmatter is stripped
from learning.md, prose body is preserved. Format-detection error
path: invoke `bin/griot capture` against a fixture old-format note
and verify the loud-error message.

**One PR.**

### Phase 4 rollup: rollup format change + /griot-load + /ev-run loader

The rollup half of the original Phase 4 bundle, deferred per the
Phase 4 whiteboard split (skeptic Finding 3). Depends on Phase 4
(session-notes) having merged so `/griot-compact` already reads from
`state.json` when its promotion logic switches its write target to
`rollup.json`.

Two deliverables in one PR:

- **rollup format change**: replace `learnings/rollup.md` with
  `learnings/rollup.json` (machine format: array of `{id, title,
  classification, promoted, origin, body, rubric}` entries —
  `body` stays a markdown string for faithful round-trip per
  whiteboard skeptic Finding 2 + design-systems; `rubric` is a
  typed array of strings; `classification` lifts to its own field
  from the id prefix). Add `bin/griot use --as=llm` flag that
  renders JSON to LLM-friendly prose at injection time (string-
  concatenation template; no markdown-AST library per whiteboard
  performance). Migrate existing `rollup.md` to the new format
  (one-time conversion script in `.claude/scripts/` with sibling
  vitest; not promoted to `bin/griot migrate`). Update `config.yaml`
  `paths.rollup` from `learnings/rollup.md` to `learnings/rollup.json`
  in the same commit. Repo-wide grep sweep for `rollup.md` / `paths.
  rollup` / `learnings/rollup` references; update all atomically.
  `/griot-compact` SKILL body's IMPROVED-promotion logic writes to
  `rollup.json` instead of `rollup.md`. Per skeptic Finding 1:
  `/griot-compact` reader/writer detects old-format `rollup.md`
  presence and errors loudly with the restart-session message.
- **/griot-load skill + /ev-run loader update**: new `/griot-load`
  skill (`disable-model-invocation: true` + `user-invocable: true`)
  as the addressable user surface for manual rollup loads. Per
  whiteboard skeptic Finding 4 + performance: skill body is **pure
  pass-through** (invoke `bin/griot use --as=llm rollup`, return
  output) — L-004 means the skill is untestable in the authoring
  session, so synthesis goes in the CLI where it CAN be bash-tested.
  Update `/ev-run`'s rollup-loading step to call `bin/griot use
  --as=llm` directly (Bash, not Skill). Resolve the
  `/learnings-use` vs `/griot-load` naming question before this
  ships — current vocabulary has `learnings-*` (capture, use,
  report) and `griot-*` (compact); adding `/griot-load` without
  resolving the family-coherence question grows parallel
  vocabularies (whiteboard design-systems). Recommended resolution:
  rename `/learnings-use` → `/griot-load` (consolidate under
  `griot-*` orchestration tier) and update README skill table in
  the same PR. Final naming negotiated in the D2 unit contract.

**Branch:** `substrate-cli/phase-4-rollup`. No new manifest phase
row is added (loom lacks `phase add`); Phase 4 in the manifest
stays in-progress until this PR merges, then completes the
"griot internal restructure" bucket.

**Verification:** `npm run lint` + `npm test` clean. End-to-end:
run `bin/griot use --as=llm rollup` and verify output matches the
current `rollup.md` content faithfully (round-trip test against
the migrated rollup.json). Verify `/griot-load` skill body is a
trivial wrapper (single bash invocation, no synthesis logic). New
session `/ev-run` invocation reads `rollup.json` via the loader
step (smoke verifiable next session after L-004 boundary).
Citation grep verification: confirm Stop hook is transcript-only
(does not read rollup.md) OR update it to read rollup.json.
Migration verified by separate test on a fixture old-format
rollup.md.

**One PR.**

### Phase 5: New agent families

Author 4 new agent files under `.claude/agents/`:

- `evaluator-playwright.md`: integration-test antipattern catalog
  (auth assertions, fixture leakage, page-level a11y, retry policy,
  screenshot drift). CLI signal: `npm run test:e2e` (if it exists)
  or axe-core / playwright catalogs.
- `evaluator-vitest.md`: unit-test antipattern catalog (mock-vs-real
  fixtures, assertion shapes, test-isolation patterns, naming).
  CLI signal: `npm test` + targeted greps for mock antipatterns.
- `whiteboard-testing-strategy.md`: design-phase voice for
  test-architecture decisions (unit vs integration vs e2e, fixture
  vs factory, mock vs real DB, parallel-test safety). Sibling to
  react-architect + performance.
- `whiteboard-substrate-engineer.md`: design-phase voice for
  substrate-design decisions specifically — CRUD-vs-orchestration
  boundaries, parallel-safety, family-shape consistency. Useful for
  self-substrate work like this project itself.

Each agent inherits from its base (`evaluator-base.md`,
`whiteboard-base.md`). Each declares `role:` frontmatter per
substrate convention.

**Verification:** Lint + build + test clean. New agents register —
visible in the skills registry. One smoke test per agent: spawn it via
`/guild-validate` (for evaluators) or `/guild-whiteboard` (for
whiteboarders) and verify its rubric/perspective fires.

**One PR.**

**L-004 note**: the 4 new agents authored in Phase 5 will NOT be in
the session that authored them. Any panel that uses them must run
in a fresh Claude Code process. Document explicitly in the P5
contract; reference the agent-guilds project's 3 prior observations.

### Phase 6: § extraction + extension + integration sweep

Four sweeps shipped in order within the same PR:

- **§ Substrate compositions extraction**: extract the duplicated
  "Substrate compositions" section currently sitting in both
  `ev-loop-confidence` and `ev-loop-interactive` SKILL.md files into
  a shared reference (target: a `LOOM-CONVENTIONS.md` appendix OR a
  new `projects/SUBSTRATE-COMPOSITIONS.md` — bikeshed decided in the
  phase contract). ev-loop bodies cite recipes by section name from
  the shared reference; recipe prose lives in one place.
- **§ extension**: add named recipes for griot + guild operations to
  the shared reference. Likely additions: § Load rollup (`bin/griot
  use --as=llm`), § Capture finding (`bin/griot capture
  --evaluator-finding=...`), § Append finding (`bin/guild findings
  append ...`), § Derive panel (`bin/guild derive-panel ...`).
  Replace any remaining `.claude/scripts/<griot,guild>/*` references
  in ev-loop bodies with § citations.
- **CONVENTIONS.md sweep**: re-articulate the "skills as interfaces
  vs workers" framing against `bin/<family>`. Add a new section
  documenting the four-family taxonomy (loom, draft, griot, guild)
  and the surviving-skill count constraint. Document the two-axis
  frontmatter rubric for future skill authors. Document the parallel-
  work invariant: "no shared mutable hotspots — all CRUD verbs are
  append-only or branch-partitioned."
- **Parallel-work hardening codification**: add the invariant section
  to CONVENTIONS.md. Add a small test under `bin/<family>` tests
  verifying append-only behavior of mutating verbs (`findings append`,
  `event log`, etc.). Surface any remaining shared-mutable-state
  hotspots as advisory findings.

**Verification:** lint + build + test clean. ev-loop-* bodies have
zero `.claude/scripts/<family>` references; griot + guild operations
fit into the shared § Substrate compositions reference. The new
CONVENTIONS.md sections render correctly. Any remaining shared-
mutable-state hotspots are documented in the sweep's checkin Notes.

**One PR.**

## Dependencies

- **Phase 1, Phase 2, Phase 3, Phase 5 are independent** — can ship
  in parallel branches (different scopes; minimal file overlap).
  This is 4 parallel-eligible phases at the start — a strong
  demonstration of the substrate's parallel-work goal.
- **Phase 4 depends on Phase 1** — needs `bin/griot capture` and
  `bin/griot use` already in place to add the new session-note
  shape and the migration script.
- **Phase 4 rollup depends on Phase 1 + Phase 4** — needs
  `bin/griot use` already in place for the `--as=llm` flag, AND
  needs Phase 4 (session-notes) merged so `/griot-compact` already
  reads `state.json` when its promotion logic switches its write
  target to `rollup.json`. The split-line is at the
  `/griot-compact` body, which absorbs an edit from Phase 4
  (routing-reader) and an edit from Phase 4 rollup (promotion-
  writer); ordering ensures the two edits don't conflict.
- **Phase 6 depends on Phases 1 + 2** — sweeps ev-loop bodies to
  point at `bin/griot` + `bin/guild` verbs that need to exist first.
  Independent of Phase 3's audit timing (the § work is orthogonal to
  the frontmatter audit).

- **Phase 3 followup precedes Phase 4** — the followup unblocks
  `/ev-run` → `/ev-loop-*` Skill composition; Phase 4 (and every
  later phase) expects to be dispatched via that composition path.
  The frontmatter edit propagates at session boundary (registry
  reload), same shape as L-004.

- **Phase 3 followup 2 precedes Phase 4** — extends the followup's
  fix to the guild-* family. Phase 4's whiteboard pre-step and
  per-unit evaluator panel compose `/guild-whiteboard` and
  `/guild-validate` via the Skill tool, blocked by the same
  flag-pinning the Phase 3 audit applied. Same session-boundary
  registry-reload caveat applies; smoke-test from the next session.

Recommended execution order: cut P1+P2+P3+P5 parallel branches → P4
starts when P1 lands → Phase 4 rollup starts when P4 lands → P6
starts when P1+P2 land.

`trout-sunset` is complete (#91, #92, #93, #95). The substrate
prerequisites this project depended on are in place; no external
blocker remains.

## Verification

- `npm run lint` clean (Biome).
- `npm run build` clean.
- `npm test` clean — substrate test count grows with each phase
  (new bin/griot tests in P1; bin/guild tests in P2; audit doesn't
  add test count materially; migration tests in P4 + Phase 4 rollup;
  agent smoke tests in P5).
- `bin/griot --help` lists all subcommands; same for `bin/guild`.
- Every skill in `.claude/skills/` has its two-axis classification
  + justification documented in P3's audit checkin.
- `/loom-archive` SKILL.md body uses AskUserQuestion for interview
  steps (grill-me pace adopted).
- Substrate-skill count after all phases: target ~12. Specifics
  emerge from the audit (which may surface more kills than just
  the obvious 2).
- E2E migration verified in P4 + Phase 4 rollup: existing
  unprocessed session-notes + existing rollup.md migrate without
  data loss.
- Parallel-safety: P6's audit produces zero remaining shared-
  mutable-state hotspots.
- `/griot-load` skill is `disable-model-invocation: true` +
  `user-invocable: true` and is a pure pass-through wrapper around
  `bin/griot use --as=llm rollup` (no synthesis logic — synthesis
  lives in the CLI per whiteboard skeptic Finding 4).
- § Substrate compositions reference exists at the agreed location;
  ev-loop bodies cite recipes by section name; no recipe prose is
  duplicated between the two ev-loop files.

## Risks

- **Breaking `/griot-compact` read path during session-notes
  restructure (P4)**. `/griot-compact` reads YAML frontmatter today.
  Migration must update the SKILL body + migrate in-flight notes
  atomically with the same PR. Mitigation: phase-local test that
  `/griot-compact` processes a state.json note end-to-end; ship the
  SKILL body + migration script + format change in one commit so no
  intermediate state exists. Per whiteboard skeptic Finding 1, also
  add a format-detection error path: if `/griot-compact` reader
  sees old-format YAML frontmatter on `learning.md`, it errors
  loudly ("session predates Phase 4 cutover; restart session to
  pick up new skill body") rather than silently mis-parsing.
- **Breaking active `/griot-use` injections during rollup
  restructure (Phase 4 rollup)**. `rollup.md` → `rollup.json` +
  render-via-CLI changes the contract `/ev-run` depends on.
  Mitigation: ship the CLI render step + the new `/griot-load`
  skill in the same PR as the format change; one-time `rollup.md`
  → `rollup.json` conversion also in the same PR. Same
  format-detection-and-loud-error pattern as P4: if `/griot-compact`
  promotion-writer sees `rollup.md` on disk after the cutover, it
  errors with the restart-session message.
- **L-004 surfacing during Phase 5 (newly authored agents not in
  same-session registry)**. The 4 new agent files won't be in the
  session that authored them; any panel that uses them must run in
  a fresh Claude Code process. 4th+ observed instance of L-004;
  load-bearing substrate behavior, not edge case. Mitigation:
  explicit note in P5 contract; restart-required step documented in
  the unit's Notes-for-the-PR.
- **Skill registry cache after wrapper-skill kills (P1 + P3)**.
  Killing any skill mid-session may not propagate cleanly; subsequent
  agent spawns might still try to invoke it. Mitigation: rely on next
  session-start to pick up the registry change (same L-004-shape
  pattern, opposite direction); document in each affected unit's Notes.
- **§ extraction location bikeshed (P6)**. The shared reference could
  live as a `LOOM-CONVENTIONS.md` appendix OR a new file like
  `projects/SUBSTRATE-COMPOSITIONS.md`. The decision affects whether
  ev-loop bodies cite as `LOOM-CONVENTIONS.md § Compose PR` or
  `SUBSTRATE-COMPOSITIONS.md § Compose PR`. Mitigation: decide in
  the P6 contract drafting via AskUserQuestion; no in-flight risk
  before then.

## Open questions

- After this project lands, can `.claude/scripts/` be deleted
  entirely? Or do any scripts (Stop hooks, settings hooks) live
  there permanently? Survey during P6. Note that Phase 4 + Phase 4
  rollup both add new `.claude/scripts/` migration scripts, so the
  directory survives at least until those one-time migrations are
  considered safe to delete (which is "never" in practice — the
  scripts are documentation of what the migration did).
- Does the Stop hook for citation-contract greps (looks for
  `Applied: L-NNN` / `Applied: AP-NNN`) need to know about the new
  rollup.json location, or does it operate purely on the
  transcript text? Likely transcript-only, but verify in Phase 4
  rollup before that PR lands.
- Should the parallel-work invariant get a CONVENTIONS.md test
  (lint rule) that flags new CRUD verbs without append-only or
  branch-partitioned semantics? Decided in P6.
- Where does the shared § Substrate compositions reference live —
  `LOOM-CONVENTIONS.md` appendix or new `SUBSTRATE-COMPOSITIONS.md`?
  Decided in P6's contract.
- The trout-sunset retro flagged `bin/loom phase update` may need a
  way to fix the placeholder URL on already-set rows (the verb is
  monotonic by default). Should this fold into the parallel-work
  hardening (P6) audit or punt to #4 substrate-gaps sibling project?
- `/learnings-use` vs `/griot-load` naming resolution (raised by
  whiteboard design-systems): rename `/learnings-use` →
  `/griot-load` (consolidate under griot-*) or keep as peers with
  documented difference? Decided in Phase 4 rollup's D2 contract.

## Decisions

These are load-bearing choices baked into the implementation; pin
them so future revisions preserve them.

- **CLI:JSON :: Skill:MD as the operating mode**. Structured state
  goes in JSON, edited by family CLIs. LLM-shaped prose stays MD,
  authored by skills. JSON can reference MD by path when an
  artifact needs both. (Inherited from `trout-sunset`; reaffirmed
  here.)
- **rollup is LLM-only output**. `rollup.json` is machine format
  (not human-prose-readable); `bin/griot use --as=llm` renders to
  prose at injection. `/griot-load` is the user-facing skill that
  wraps the render step. The human-readability constraint that
  forced `rollup.md`'s prose shape is gone. Whiteboard
  design-systems nudged this with a "the schema doesn't preclude a
  `--as=human` render later" caveat — accepted as a future-
  optionality note: `--as=llm` is the only render mode shipped in
  Phase 4 rollup; future render modes (e.g. `--as=human`) can be
  added without re-shaping the schema.
- **session-notes folder shape**: `state.json` sidecar +
  `learning.md` + 4 body MD files. No more YAML-frontmatter-on-MD.
  Per whiteboard design-systems: the prose files remain the
  *source of truth*; `state.json` is the *routing label* that
  describes where this note sits in the griot pipeline. Resist
  any future framing that treats `state.json` as the canonical
  source.
- **rollup.json schema shape** (pinned per Phase 4 rollup whiteboard
  round 1 — skeptic Finding 2 + design-systems): array of objects
  with structured-handle fields (`id`, `title`, `classification`,
  `promoted`, `origin`, `rubric`) plus a `body` field that holds
  the multi-paragraph learning prose as a markdown string. `body`
  stays a markdown string for faithful round-trip — do NOT split
  it into sub-fields (`summary`, `details`, `example`, etc.).
  Further structuring of body content is out of scope for Phase 4
  rollup and would require its own design pass. `rubric` is a
  typed array of strings (optional; not all entries have rubric
  criteria). `classification` lifts from the id prefix to its own
  field so downstream consumers stop string-parsing the id.
- **Migration scripts live in `.claude/scripts/`** (not promoted to
  `bin/griot migrate` verbs). Per whiteboard performance: throwaway-
  ness is structural; `bin/griot migrate` would invite future
  one-off "migrate from N to N+1" verbs accreting permanently in
  the CLI surface. `.claude/scripts/` is where one-time-but-
  committed-and-tested migration scripts belong.
- **Format-detection error path for cutover safety** (per Phase 4
  whiteboard skeptic Finding 1): both Phase 4 (session-notes) and
  Phase 4 rollup add a small format-detection-and-loud-error branch
  to their reader/writer entry points. If `bin/griot capture` sees
  old-format YAML frontmatter on `learning.md`, or if `/griot-
  compact` sees `rollup.md` after the cutover, errors loudly with
  "session predates Phase X cutover; restart session to pick up
  new skill body." Cost: one branch per entry point. Benefit:
  silent corruption becomes a clear error message when the user
  forgets to `/clear` across a merge boundary. Dual-read tolerance
  was considered and rejected (whiteboard skeptic + performance +
  design-systems all agreed) — dual-read introduces permanent
  code-path complexity for a one-time migration.
- **Two-axis frontmatter rubric for skill classification**. Every
  skill in `.claude/skills/` lives on a 2x2 of `disable-model-
  invocation` × `user-invocable`. The "no useless ambient skills"
  rule applies ONLY to the ambient-routing axis; user-invocable +
  non-ambient skills with any synthesis coverage over raw CLI are
  legitimate. **Skills composed via the Skill tool from any caller
  — top-level slash command or another skill — MUST be
  `disable-model-invocation: false`. The flag's actual semantics
  block ALL model-driven Skill invocation, including legitimate
  composition from another skill; the audit's original "pin
  internal substrate primitives to `disable-model-invocation: true`"
  rule was wrong and is the source of both the Phase 3 followup
  (#102, ev-loop-*) and Phase 3 followup 2 (guild-*) corrections.
  `disable-model-invocation: true` is correct only when no
  Skill-composition path exists (the skill is invoked exclusively
  by humans via `/<name>` or by Bash via `bin/<family>` directly).**
  This rubric is the audit frame for P3 and the convention for all
  future skill authors.
- **`/griot-load` is `disable-model-invocation: true` +
  `user-invocable: true`**. Pattern-matches the two-axis rubric.
  Composition from `/ev-run` and similar goes through
  `bin/griot use --as=llm` directly (Bash), not through the skill.
- **`/griot-load` skill body is pure pass-through** (per Phase 4
  rollup whiteboard skeptic Finding 4 + performance). The skill
  invokes `bin/griot use --as=llm rollup` and returns the output,
  with no additional synthesis logic in the SKILL.md body. L-004
  means the authoring session can't invoke the skill, so any
  synthesis logic in the skill body would ship untested.
  Synthesis lives in the CLI verb (`bin/griot use --as=llm`),
  where it can be bash-tested in the authoring session. The skill
  exists as an addressable user surface; not as a place where
  logic lives.
- **Phase 4 split into Phase 4 (session-notes) + Phase 4 rollup**
  (pinned per Phase 4 whiteboard round 1 — skeptic Finding 3 + the
  CLAUDE.md "one conceptual change per PR" convention). The
  original Phase 4 framing bundled three coupled changes into one
  PR; whiteboard pressure-testing surfaced that D1 (session-notes)
  and D2 (rollup) are independent at the coupling level, meeting
  only at the `/griot-compact` body which can take edits from two
  separate PRs. Splitting also de-risks D2's schema decisions by
  letting D1 ship first. The Phase 4 manifest row remains a single
  bucket for the entire "griot internal restructure" work; the row
  stays in-progress across both PRs and completes when Phase 4
  rollup merges.
- **No family has more than ~4 substrate skills**. The four-family
  taxonomy with this constraint is the consistency target; if a
  family grows past 4, audit for CRUD-masquerading-as-orchestration.
- **Append-only or branch-partitioned for any CRUD verb that
  touches shared state**. No shared mutable hotspots. Parallel-
  work safety is a substrate-wide invariant codified in
  CONVENTIONS.md.
- **Skill-vs-CLI test**: if a skill's first substantive step is
  "shell out to a Node script via Bash and then return," it's a
  CLI verb, not a skill. If the body is "spawn N agents, parse
  outputs, branch on results," it stays a skill. This is the
  audit test for the surviving registry.
- **Extract the "Substrate compositions" § pattern from trout-sunset
  Phase 2 into a shared reference BEFORE extending it**. The
  duplicated catalog in both ev-loop bodies grows past the threshold
  where "duplication is cheap" was the right call; extract first
  (Phase 6), then extend with griot + guild recipes. ev-loop bodies
  cite the shared reference by section name.
- **Grill-me multi-choice pace is the default for interview-style
  skills**. `/draft-plan` established the pattern; `/loom-archive`
  adopts it in P3. Any future interview-shaped skill defaults to
  AskUserQuestion-with-recommendations + walk-the-tree pacing.
- **`/ev-run`, `/ev-loop-confidence`, and `/ev-loop-interactive`
  are all top-level user-invocable slash commands**. The two loops
  are `user-invocable: true` and NOT `disable-model-invocation`.
  Composition shape: `/ev-run` dispatches to the loops via the
  Skill tool; users can also invoke a loop directly for a single-
  phase escape hatch. This pins against Phase 3's original audit
  intent ("composed via /ev-run, never ambient") — the
  `disable-model-invocation` flag's actual semantics are stricter
  than the "no ambient routing" intent and block legitimate
  composition from another slash command. The
  meaningful-synthesis-with-routing-needs shape is
  `disable-model-invocation: false` + `user-invocable: true`, not
  the substrate-internal-primitive shape
  (`disable-model-invocation: true`).
- **`/guild-spawn`, `/guild-validate`, `/guild-whiteboard` are
  internal substrate primitives composed by `/ev-loop-*` via the
  Skill tool**. All three are `user-invocable: false` AND
  `disable-model-invocation: false`. They do not surface as ambient
  slash commands (user-invocable: false), but ev-loop composes them
  via the Skill tool, so the disable-model-invocation flag must NOT
  be set. This is the canonical shape for an internal substrate
  primitive composed via Skill: `user-invocable: false` +
  `disable-model-invocation: false`. Pins against the Phase 3
  audit's original "pin internal substrate primitives to
  disable-model-invocation: true" rule (the source of the followup
  2 correction).

## Revision log





- 2026-05-16 — apply intended Phase 4 split (prior revision cea7c1e committed with the correct rationale but a stale revision-file from a prior session — the file at /tmp/loom-revision-substrate-cli.md predated this session; Write tool refused to overwrite without Read-first, bin/draft revise applied the stale file unchanged); this revision actually splits Phase 4 into Phase 4 (session-notes) + Phase 4 rollup, pins the new Decisions, and adds the Open question

- 2026-05-16 — split Phase 4 into Phase 4 (session-notes only) + Phase 4 rollup (rollup format + /griot-load + /ev-run loader) per Phase 4 whiteboard skeptic Finding 3; pin rollup.json schema + format-detection error path + .claude/scripts/ migration home + /griot-load pure pass-through as new Decisions; add /learnings-use vs /griot-load resolution as Open question to settle in Phase 4 rollup's D2 contract

- 2026-05-16 — add Phase 3 followup 2: extend ev-loop-* frontmatter fix to guild-* family (guild-spawn/guild-validate/guild-whiteboard had disable-model-invocation: true that blocks Skill composition from ev-loop); amend audit-rubric Decision to correct the source-of-the-trap rule; pin new Decision for guild-* canonical shape; add Phase 3 followup 2 → Phase 4 dependency

- 2026-05-16 — add Phase 3 followup: flip ev-loop-* to top-level user-invocable (remove disable-model-invocation that blocks /ev-run Skill composition); reconcile PR #101 manifest drift; pin new Decision for top-level loops + add Phase 3 followup → Phase 4 dependency

- 2026-05-16 — restore revision-1 log entry that was lost when revision-2 replaced PLAN.md wholesale; substrate finding: bin/draft revise REPLACES PLAN.md with the revision file then appends one log entry — revision-file authors must carry forward prior ## Revision log entries explicitly to preserve history; flagged for the revisions-folder-substrate sibling project

- 2026-05-16 — post-trout-sunset close: drop the hard-dependency on trout-sunset (#91-#95 all merged), extend the Substrate compositions § pattern that #92 established for P5 ev-loop body updates, add one new Decision pinning the § extension pattern
- 2026-05-16 — absorb trout-sunset retro themes #2 (grill-me pace audit for /loom-archive) + #3 (full skill frontmatter audit per two-axis rubric) into substrate-cli scope as new Phase 3 (skill surface cleanup); restructure phases (old P3-P5 → P4-P6); P6 extracts § Substrate compositions to shared reference BEFORE extending; add two-axis-rubric + grill-me-pace + extract-before-extend as new Decision pins; defer themes #1 (revisions folder substrate) and #4 (loom-side substrate gaps) to sibling projects
