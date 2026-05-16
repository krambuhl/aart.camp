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

### Phase 4: griot internal restructure

Two restructures shipped together:

- **session-notes**: replace YAML-frontmatter-on-`learning.md` with a
  `state.json` sidecar. Each session-note folder gains
  `state.json` (classification, evaluator, code, frequency-count,
  status, promoted_as) and `learning.md` becomes pure prose body.
  Update `bin/griot capture` to write the new shape. Update
  `/griot-compact` SKILL body's routing logic to read `state.json`.
  Include a migration script for in-flight unprocessed notes:
  detect YAML frontmatter, extract to `state.json`, strip from
  `learning.md`. Migration runs once at PR-merge time.
- **rollup**: replace `learnings/rollup.md` with `learnings/rollup.json`
  (machine format: array of `{id, title, body, classification, ...}`
  entries). Add `bin/griot use --as=llm` flag that renders JSON to
  LLM-friendly prose. Add new `/griot-load` skill
  (`disable-model-invocation: true`, `user-invocable: true`) that
  wraps `bin/griot use --as=llm` as the addressable user surface.
  Update `/ev-run`'s rollup-loading step to use `bin/griot use
  --as=llm` directly (Bash, not Skill). Migrate existing
  `rollup.md` to the new format (one-time conversion script).
- `/griot-compact` SKILL body's IMPROVED-promotion logic writes to
  `rollup.json` instead of `rollup.md`. Promotion renders the
  same entry shape it does today; only the storage format changes.

**Verification:** `npm run lint` + `npm test` clean. End-to-end:
write a session-note via `bin/griot capture`, process via
`/griot-compact`, verify rollup.json gets the new entry, verify
`/griot-load` (and `bin/griot use --as=llm`) emit the new entry as
LLM prose. Migration verified by a separate test on a fixture of
old-format session-notes + old-format rollup.

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
  `bin/griot use` already in place to add the `--as=llm` rendering
  + the new session-note shape.
- **Phase 6 depends on Phases 1 + 2** — sweeps ev-loop bodies to
  point at `bin/griot` + `bin/guild` verbs that need to exist first.
  Independent of Phase 3's audit timing (the § work is orthogonal to
  the frontmatter audit).

Recommended execution order: cut P1+P2+P3+P5 parallel branches → P4
starts when P1 lands → P6 starts when P1+P2 land.

`trout-sunset` is complete (#91, #92, #93, #95). The substrate
prerequisites this project depended on are in place; no external
blocker remains.

## Verification

- `npm run lint` clean (Biome).
- `npm run build` clean.
- `npm test` clean — substrate test count grows with each phase
  (new bin/griot tests in P1; bin/guild tests in P2; audit doesn't
  add test count materially; migration tests in P4; agent smoke
  tests in P5).
- `bin/griot --help` lists all subcommands; same for `bin/guild`.
- Every skill in `.claude/skills/` has its two-axis classification
  + justification documented in P3's audit checkin.
- `/loom-archive` SKILL.md body uses AskUserQuestion for interview
  steps (grill-me pace adopted).
- Substrate-skill count after all phases: target ~12. Specifics
  emerge from the audit (which may surface more kills than just
  the obvious 2).
- E2E migration verified in P4: existing unprocessed session-notes
  + existing rollup.md migrate without data loss.
- Parallel-safety: P6's audit produces zero remaining shared-
  mutable-state hotspots.
- `/griot-load` skill is `disable-model-invocation: true` +
  `user-invocable: true` and renders rollup.json to LLM prose
  correctly.
- § Substrate compositions reference exists at the agreed location;
  ev-loop bodies cite recipes by section name; no recipe prose is
  duplicated between the two ev-loop files.

## Risks

- **Breaking `/griot-compact` read path during session-notes
  restructure (P4)**. `/griot-compact` reads YAML frontmatter today.
  Migration must update the SKILL body + migrate any in-flight notes
  atomically with the same PR. Mitigation: phase-local test that
  `/griot-compact` processes a state.json note end-to-end; ship the
  SKILL body + migration script + format change in one commit so no
  intermediate state exists.
- **Breaking active `/griot-use` injections during rollup
  restructure (P4)**. `rollup.md` → `rollup.json` + render-via-CLI
  changes the contract `/ev-run` depends on. Mitigation: ship the
  CLI render step + the new `/griot-load` skill in the same PR as
  the format change; one-time `rollup.md` → `rollup.json` conversion
  also in the same PR.
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
  there permanently? Survey during P6.
- Does the Stop hook for citation-contract greps (looks for
  `Applied: L-NNN` / `Applied: AP-NNN`) need to know about the new
  rollup.json location, or does it operate purely on the
  transcript text? Likely transcript-only, but verify in P4.
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
  forced `rollup.md`'s prose shape is gone.
- **session-notes folder shape**: `state.json` sidecar +
  `learning.md` + 4 body MD files. No more YAML-frontmatter-on-MD.
- **Two-axis frontmatter rubric for skill classification**. Every
  skill in `.claude/skills/` lives on a 2x2 of `disable-model-
  invocation` × `user-invocable`. The "no useless ambient skills"
  rule applies ONLY to the ambient-routing axis; user-invocable +
  non-ambient skills with any synthesis coverage over raw CLI are
  legitimate. Substrate-internal primitives pin to
  `disable-model-invocation: true`. This rubric is the audit frame
  for P3 and the convention for all future skill authors.
- **`/griot-load` is `disable-model-invocation: true` +
  `user-invocable: true`**. Pattern-matches the two-axis rubric.
  Composition from `/ev-run` and similar goes through
  `bin/griot use --as=llm` directly (Bash), not through the skill.
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

## Revision log


- 2026-05-16 — restore revision-1 log entry that was lost when revision-2 replaced PLAN.md wholesale; substrate finding: bin/draft revise REPLACES PLAN.md with the revision file then appends one log entry — revision-file authors must carry forward prior ## Revision log entries explicitly to preserve history; flagged for the revisions-folder-substrate sibling project

- 2026-05-16 — post-trout-sunset close: drop the hard-dependency on trout-sunset (#91-#95 all merged), extend the Substrate compositions § pattern that #92 established for P5 ev-loop body updates, add one new Decision pinning the § extension pattern
- 2026-05-16 — absorb trout-sunset retro themes #2 (grill-me pace audit for /loom-archive) + #3 (full skill frontmatter audit per two-axis rubric) into substrate-cli scope as new Phase 3 (skill surface cleanup); restructure phases (old P3-P5 → P4-P6); P6 extracts § Substrate compositions to shared reference BEFORE extending; add two-axis-rubric + grill-me-pace + extract-before-extend as new Decision pins; defer themes #1 (revisions folder substrate) and #4 (loom-side substrate gaps) to sibling projects
