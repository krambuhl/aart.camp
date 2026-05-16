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
(learnings) and `guild` (agent panels) — and finishes the consistency
pass.** It also kills the ambient wrapper skills that the new CLI verbs
make obsolete, restructures griot's internal artifacts to match the
JSON/MD split, ships new evaluator + whiteboard agent families for
testing concerns (playwright, vitest, testing-strategy, substrate-
engineering), and codifies the parallel-work invariant across the
substrate.

The substrate's surviving-skill count target is **~12** across the
four families (`loom`, `draft`, `griot`, `guild`) plus 2 `ev-loop-*`
loops. Today's count is ~13 substrate-core (15 total in .claude/skills/
including global meta like `frontend-design` and `vercel-react-best-
practices`). The cleanup removes ~2 wrapper skills (`/griot-capture`,
`/griot-report`) plus folds CRUD-shaped logic into peer CLIs.

## Scope

**In:**

- `bin/griot` CLI: `capture`, `use`, `mediate-panel`, `operator-checks`,
  `report` verbs. Replaces `.claude/scripts/griot/*.ts` directly.
- `bin/guild` CLI: `findings`, `derive-panel`, `parse-and-aggregate`,
  `whiteboard` verbs. Replaces `.claude/scripts/guild/*.ts` directly.
- Kill wrapper skills: `/griot-capture`, `/griot-report` (CRUD
  wrappers around CLI behavior). Survey for other audit-surfaced
  wrappers during execution.
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
  addressable user surface for manual rollup loads.
- 4 new agent files: `evaluator-playwright`, `evaluator-vitest`,
  `whiteboard-testing-strategy`, `whiteboard-substrate-engineer`.
  Now that the project has playwright + vitest as real tools and
  substrate-design is its own recurring concern, the families
  earn dedicated panel/design voices.
- ev-loop-* body updates: extend the established "Substrate compositions"
  § pattern with new named recipes for griot + guild operations
  (e.g. § Load rollup, § Capture finding, § Append finding,
  § Derive panel). Replace any remaining `.claude/scripts/<griot,guild>/*`
  references in ev-loop bodies with named § citations.
- Parallel-work hardening pass: audit all CRUD verbs for append-only
  or branch-partitioned writes; codify the invariant in
  CONVENTIONS.md ("no shared mutable hotspots"); add explicit tests
  for any verb that touches shared state.
- CONVENTIONS.md sweep: re-articulate the "skills as interfaces vs
  workers" framing against `bin/<family>` and the four-family
  taxonomy. trout-sunset touched some of this prose; this project
  finishes the sweep for griot + guild conventions.

**Out:**

- ev-loop-* skill body updates pointing at `bin/loom` / `bin/draft` —
  those landed in `trout-sunset` Phase 2 (#92). This project only
  extends the same pattern for `bin/griot` and `bin/guild`
  operations.
- Cross-project / multi-repo griot sharing (federation). Deferred to
  a future project.
- `/griot-compact` judge panel redesign. The four-judge mechanism
  survives untouched.
- New evaluator catalogs / agents beyond the four named in scope.
- Eval-side `/griot-use` (project-specific catalog self-extension).
  Already PLAN.md-deferred in agent-guilds; stays deferred.
- `rollup.md` content semantics (L-NNN / AP-NNN ids, Project
  antipatterns section, citation contract). The format moves to
  JSON; the semantics stay.

**Deferred:**

- Cross-project / multi-repo griot federation.
- Eval-side `/griot-use` catalog self-extension.
- Migrating archived projects' learnings to the new rollup format
  (only the live `learnings/rollup.md` migrates).

## Phases

### Phase 1: `bin/griot` CLI + wrapper-skill kill

Move `.claude/scripts/griot/*.ts` (capture, use, mediate-panel,
operator-checks) into a new `bin/griot` CLI with subcommands matching
the verb names. Delete `.claude/skills/griot-capture/` and
`.claude/skills/griot-report/` (CRUD wrappers). The `/griot-compact`
skill survives (orchestrates the four-judge panel; pure LLM work).
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

### Phase 3: griot internal restructure

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

### Phase 4: New agent families

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
visible in the skills registry / `gh` of `/agent-list` (whatever the
substrate exposes). One smoke test per agent: spawn it via
`/guild-validate` (for evaluators) or `/guild-whiteboard` (for
whiteboarders) and verify its rubric/perspective fires.

**One PR.**

**L-004 note**: the 4 new agents authored in Phase 4 will NOT be in
the session that authored them. Any panel that uses them must run
in a fresh Claude Code process. Document explicitly in the P4
contract; reference the agent-guilds project's 3 prior observations.

### Phase 5: Integration sweep

Three sweeps:

- **ev-loop-* body extension**: extend the established "Substrate
  compositions" § pattern (introduced by trout-sunset Phase 2 in #92)
  with named recipes for griot + guild operations. Likely additions:
  § Load rollup (`bin/griot use --as=llm`), § Capture finding
  (`bin/griot capture --evaluator-finding=...`), § Append finding
  (`bin/guild findings append ...`), § Derive panel
  (`bin/guild derive-panel ...`). Replace any remaining inline
  references to `.claude/scripts/<griot,guild>/*` in ev-loop bodies
  with § citations. Both ev-loop bodies updated; recipes duplicated
  intentionally (each loop is self-contained).
- **CONVENTIONS.md sweep**: re-articulate the "skills as interfaces
  vs workers" framing against `bin/<family>`. Add a new section
  documenting the four-family taxonomy (loom, draft, griot, guild)
  and the surviving-skill count constraint (no family > 4 substrate
  skills). Document the parallel-work invariant: "no shared mutable
  hotspots — all CRUD verbs are append-only or branch-partitioned."
- **Parallel-work hardening codification**: add a section to
  CONVENTIONS.md naming the invariant. Add a small test under
  `bin/<family>` tests verifying append-only behavior of mutating
  verbs (`findings append`, `event log`, etc.). Surface any
  remaining shared-mutable-state hotspots as advisory findings.

**Verification:** lint + build + test clean. ev-loop-* bodies have
zero `.claude/scripts/<family>` references that should be CLI;
griot + guild operations fit into the established § Substrate
compositions structure. The new CONVENTIONS.md sections render
correctly. Any remaining shared-mutable-state hotspots are
documented in the sweep's checkin Notes.

**One PR.**

## Dependencies

- **Phase 1 and Phase 2 are independent** — can ship in parallel
  branches (different families, no shared files except
  `.claude/settings.json` which both touch but in different blocks).
- **Phase 3 depends on Phase 1** — needs `bin/griot capture` and
  `bin/griot use` already in place to add `--as=llm` etc.
- **Phase 4 is independent** — new files only, no edits to existing
  substrate. Can ship in parallel with P1/P2/P3.
- **Phase 5 depends on Phases 1 + 2** — sweeps ev-loop bodies to
  point at `bin/griot` + `bin/guild` verbs that need to exist first.

Recommended execution order: cut P1+P2+P4 parallel branches → P3
starts when P1 lands → P5 starts when P1+P2 land.

`trout-sunset` is complete (#91, #92, #93, #95). The substrate
prerequisites this project depended on are in place; no external
blocker remains.

## Verification

- `npm run lint` clean (Biome).
- `npm run build` clean.
- `npm test` clean — substrate test count grows with each phase
  (new bin/griot tests in P1; bin/guild tests in P2; migration
  tests in P3; agent smoke tests in P4).
- `bin/griot --help` lists all subcommands; same for `bin/guild`.
- Substrate-skill count after P1 + P5 lands: target ~12 (loom 1,
  draft 1, griot 2 — /griot-compact + /griot-load, guild 3, ev-loop
  2, a11y-review-file 1, ev-run 1, plus optional meta-skills).
- E2E migration verified in P3: existing unprocessed session-notes
  + existing rollup.md migrate without data loss.
- Parallel-safety: P5's audit produces zero remaining shared-
  mutable-state hotspots in the audit.
- `/griot-load` skill is `disable-model-invocation: true` +
  `user-invocable: true` and renders rollup.json to LLM prose
  correctly.

## Risks

- **Breaking `/griot-compact` read path during session-notes
  restructure (P3)**. `/griot-compact` reads YAML frontmatter today.
  Migration must update the SKILL body + migrate any in-flight notes
  atomically with the same PR. Mitigation: phase-local test that
  `/griot-compact` processes a state.json note end-to-end; ship the
  SKILL body + migration script + format change in one commit so
  no intermediate state exists.
- **Breaking active `/griot-use` injections during rollup
  restructure (P3)**. `rollup.md` → `rollup.json` + render-via-CLI
  changes the contract `/ev-run` depends on. Mitigation: ship the
  CLI render step + the new `/griot-load` skill in the same PR as
  the format change; one-time `rollup.md` → `rollup.json` conversion
  also in the same PR.
- **L-004 surfacing during Phase 4 (newly authored agents not in
  same-session registry)**. The 4 new agent files won't be in the
  session that authored them; any panel that uses them must run in
  a fresh Claude Code process. This is the 4th+ observed instance
  of L-004; treat it as load-bearing substrate behavior, not edge
  case. Mitigation: explicit note in P4 contract; document the
  restart-required step in the unit's Notes-for-the-PR.
- **Skill registry cache after wrapper-skill kills (P1)**. Killing
  `/griot-capture` and `/griot-report` mid-session may not propagate
  cleanly; subsequent agent spawns might still try to invoke them.
  Mitigation: rely on next session-start to pick up the registry
  change (same L-004-shape pattern, opposite direction); document
  in P1 Notes.

## Open questions

- After this project lands, can `.claude/scripts/` be deleted
  entirely? Or do any scripts (Stop hooks, settings hooks) live
  there permanently? Survey during P5.
- Does the Stop hook for citation-contract greps (looks for
  `Applied: L-NNN` / `Applied: AP-NNN`) need to know about the new
  rollup.json location, or does it operate purely on the
  transcript text? Likely transcript-only, but verify in P3.
- Should the parallel-work invariant get a CONVENTIONS.md test
  (lint rule) that flags new CRUD verbs without append-only or
  branch-partitioned semantics? Decided in P5.

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
- **`/griot-load` is `disable-model-invocation: true` +
  `user-invocable: true`**. Auto-discovery blocked; user-explicit
  invocation only. Composition from `/ev-run` and similar goes
  through `bin/griot use --as=llm` directly (Bash), not through
  the skill.
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
- **Extend the "Substrate compositions" § pattern from trout-sunset
  Phase 2**. Substrate operations referenced from ev-loop bodies
  cite named § recipes (§ Save session, § Compose PR, etc.) rather
  than inlining or composing wrapper skills. This project extends
  the catalog with griot + guild recipes; recipes are duplicated
  between ev-loop-confidence and ev-loop-interactive intentionally
  (self-contained per loop).

## Revision log

- 2026-05-16 — post-trout-sunset close: drop the hard-dependency on trout-sunset (#91-#95 all merged), extend the Substrate compositions § pattern that #92 established for P5 ev-loop body updates, add one new Decision pinning the § extension pattern
