# Agent guilds as composable substrate

## Context

Today the substrate has one shape on each side of the unit contract: the generator is the main Claude conversation, the antagonist is one generic `evaluator` subagent. This works for pairing-mode taste work but leaves capacity on the table — there's no panel of specialist evaluators, no multi-perspective design step before contract authoring, no specialized generators for mechanical bulk work, and no flow from recurring antagonist findings into durable cross-session knowledge.

This project extracts a new `guild-*` substrate family alongside existing `trout-*` (project state) and `griot-*` (learnings) primitives, defines agent file conventions and fluid composition (no roster registry), thins ev-loop into a clean composition example, ships aart.camp's specific agent roster (six whiteboard engineers, six antagonist evaluators with antipattern catalogs + CLI validators where they exist, four domain-pair generators including stubs for forward-looking domains), and wires griot integration so antagonist findings flow into rollup and back into future generators via `/griot-use`.

Design plan: `~/.claude/plans/yo-i-m-curious-what-shimmying-cook.md` (approved 2026-05-02).

## Scope

**In:**
- `guild-*` substrate (`guild-spawn`, `guild-whiteboard`, `guild-validate`)
- Agent file conventions (`role:` frontmatter, three role shapes)
- Fluid phase-config composition (inline agent lists or `auto`)
- ev-loop changes (compose `guild-*`; encode nine Evan-opinions including griot threshold heuristics)
- aart.camp agent overlay (six whiteboard, six evaluators, four domain-pair generators)
- Griot extensions for `evaluator-finding:` capture and classification-aware promotion

**Out:**
- Storybook / Playwright / unit-test infrastructure (only stubs ship; activation when their toolchains land)
- i18n / Lingui evaluator
- Visual regression (Happo) as evaluator
- Multi-team agent federation (substrate is designed assuming this comes later)

**Deferred:**
- Eval-side `griot-use` (project-specific catalog self-extension) — signal-driven, post-rollout
- Auto-promoting advisory catalog entries to blocking
- Cross-unit memory for whiteboard engineers
- A `guild-aggregate` primitive (collapsed into `guild-validate` for v1)

## Phases

### Phase 1: Substrate foundations

Extract `evaluator-base.md` from existing `evaluator.md` (read-only, no praise, verdict shape, packet-incomplete handling). Rename `evaluator.md` → `evaluator-contract-fit.md`, refactor to inherit from base. Author `guild-spawn` and `guild-validate` skills. Migrate existing ev-loop "spawn evaluator" step to call `guild-validate` with a 1-agent list. Behavior identical to today, but routed through substrate.

**Verification:** existing project work still runs end-to-end; substrate isolation test (`guild-spawn` from clean context) passes.

**One PR.**

### Phase 1.5: Substrate primitive cleanup

Inserted post-Phase-1 from the post-merge architecture audit (`sessions/2026-05-05-a.md`). Establishes the "scripts for CRUD, skills for LLM-shaped work, orchestration stays skill" convention. Pure-CRUD substrate primitives migrate to Node scripts under `.claude/scripts/<family>/<verb>.js`; LLM-shaped skills with CRUD epilogues split into a thin LLM body + a script for the deterministic tail; orchestration skills stay as skills (they compose Skill + Agent in a shared context). Per-family wildcard permissions (`Bash(node .claude/scripts/<family>/*)`) added to project-wide `.claude/settings.json` as each family's first script lands.

**Ordering:** sequential. Convention doc lands first (anchors the "why"); migrations follow; e2e verification closes.

**Deliverables:**

1. **Convention doc** → add a "Skills as interfaces vs workers" section to `projects/CONVENTIONS.md`. Document the four primitive shapes (CRUD / LLM / interactive / orchestration) and the rule for each. Reference the empirically-verified `disable-model-invocation` finding (a skill cannot be both composable-from-another-skill and blocked-from-ambient-discovery — the only path to composition-only behavior is a different primitive).
2. **`trout-autosave` → script.** Author `.claude/scripts/trout/autosave.ts` (TypeScript, stdlib only — Node 24 strips types natively). Same arg surface as the skill (`--phase-update`, `--current-state`, `--detail`, `--event`, `--init`). Sibling `autosave.test.ts`. Update all call sites (`ev-loop-confidence`, `ev-loop-interactive`, `trout-plan`, `trout-pull-request`, `trout-archive`, `trout-save-session`, `ev-run`). Delete `.claude/skills/trout-autosave/`. Bootstraps the substrate-script convention (CONVENTIONS.md subsection, `npm run test`, `Bash(node .claude/scripts/trout/*)` permission, `"type": "module"` in package.json).
3. **`trout-autoload` → script.** Author `.claude/scripts/trout/autoload.ts`. Returns the briefing markdown to stdout. Sibling `autoload.test.ts`. Update call sites. Delete `.claude/skills/trout-autoload/`.
4. **`griot-capture` → script.** Author `.claude/scripts/griot/capture.ts`. Same `--from-checkin=<path>` arg surface; derives the 5 session-note files. Sibling `capture.test.ts`. Update call sites. Delete `.claude/skills/griot-capture/`. Adds `Bash(node .claude/scripts/griot/*)` permission.
5. **`guild-validate` parser extraction.** Author `.claude/scripts/guild/parse-and-aggregate.ts`. Takes an array of `{agent, output}` entries, parses each verdict, aggregates findings, returns the locked output shape. Sibling `parse-and-aggregate.test.ts`. Update `guild-validate` SKILL.md so its parse + aggregate steps shell out to the script. Skill body stays — it is the addressable orchestration handle. Adds `Bash(node .claude/scripts/guild/*)` permission.
6. **`trout-pull-request` split.** Author `.claude/scripts/trout/pr-plumbing.ts` (gh CLI calls, marker parsing, checkin parser, commit-pending-work helper). Sibling `pr-plumbing.test.ts`. Update `trout-pull-request` SKILL.md so the LLM body authoring stays as prose; the plumbing prose becomes Bash invocations of the script. Skill body stays — it is the LLM-shaped body author.
7. **`trout-archive` relocate split.** Author `.claude/scripts/trout/archive-relocate.ts` (moves `projects/<slug>/` to `projects/archive/<slug>/`, updates the manifest's `Status` field). Sibling `archive-relocate.test.ts`. Update `trout-archive` SKILL.md so the relocate step shells out. Skill body stays — interview / retro / synthesis remain LLM-shaped.
8. **`trout-save-session` finalize split.** Author `.claude/scripts/trout/save-session-finalize.ts` (writes `sessions/YYYY-MM-DD-<letter>.md`, appends `session-saved` event to manifest, optionally invokes griot capture for correction lines). Sibling `save-session-finalize.test.ts`. Update `trout-save-session` SKILL.md so narrative authoring stays as prose; the finalize tail becomes a Bash invocation. Skill body stays.
9. **`trout-pr-respond` plumbing split.** Author `.claude/scripts/trout/pr-respond-plumbing.ts` (gh CLI calls to fetch PR comments / reviews, classification scaffolding). Sibling `pr-respond-plumbing.test.ts`. Update `trout-pr-respond` SKILL.md so the LLM classification + response plan stays as prose; gh CLI plumbing becomes a Bash invocation. Skill body stays.
10. **`trout-plan` scaffold split.** Author `.claude/scripts/trout/plan-scaffold.ts` (creates `projects/<date>-<slug>/` directory tree, scaffolds initial MANIFEST.md / config.md / PLAN.md skeletons from interview output). Sibling `plan-scaffold.test.ts`. Update `trout-plan` SKILL.md so the interview stays as prose; post-interview scaffold becomes a Bash invocation. Skill body stays.
11. **`griot-use` → script.** Author `.claude/scripts/griot/use.ts` (small — reads `learnings/rollup.md`, prints content + citation contract to stdout so the Bash tool result lands the load in conversation context). Sibling `use.test.ts`. Inline the invocation into `/ev-run`'s setup step (`Step 1.5. Load learnings`) so it fires automatically at loop setup, not as a discoverable user skill. Delete `.claude/skills/griot-use/`.
12. **End-to-end verification.** Scaffold a throwaway `phase-1-5-test` project via the migrated `/trout-plan`. Take it through one unit of work via `/ev-run` → `/ev-loop-interactive`. Save session via the migrated `/trout-save-session`. Confirm everything works through the migrated path. Archive the test project via the migrated `/trout-archive`.

**Verification:**
- `npm run lint` clean (Biome handles `.ts` natively).
- `npm run build` clean.
- `npm run test` clean (the test suite covers all migrated scripts).
- `grep -rn "Skill(skill: \"trout-autosave\"" .claude/skills/` returns nothing (and the same grep for each migrated skill).
- E2E test project (deliverable 12) runs without errors.

**One PR.**

### Phase 2: Antagonist evaluator panel

Author `evaluator-a11y` and `evaluator-nextjs` with full antipattern catalogs and CLI validators (axe-core / jsx-a11y; `'use client'` regex + AST + bundle checks). Author `evaluator-react-api`, `evaluator-tokens`, `evaluator-naming` with smaller advisory-only catalogs initially. Document precedence list and tokens-vs-naming boundary. Update ev-loop auto-derivation rules so panels assemble contextually from file types.

**Verification:** real testbed phase fires expected catalog hits with CLI evidence in verdicts; advisory-only flags don't gate units.

**One PR.**

### Phase 3: Whiteboard mechanism + engineers

Author `guild-whiteboard` primitive (filesystem-as-shared-artifact, parallel engineer spawn, attributed sections). Add whiteboard step to both ev-loop loops as opt-in (`whiteboard:` field in phase config). Author the six whiteboard engineers (`whiteboard-react-architect`, `whiteboard-design-systems`, `whiteboard-performance`, `whiteboard-a11y`, `whiteboard-sketch-ideation`, `whiteboard-skeptic`). Run a real design phase end-to-end.

**Verification:** engineers append attributed sections without overwriting each other; round-2 whiteboard handles contradictions correctly.

**One PR.**

### Phase 4: Domain pairs

Author `generator-css-codemod` + `evaluator-css-architecture` (active). Author the three stub pairs: `generator-storybook-stories`, `generator-unit-tests`, `generator-playwright-e2e`, each with matching evaluator stub and documented activation criteria. Implement domain-pair sequencing in ev-loop (specialist evaluator runs solo first, panel only on its approval).

**Verification:** CSS codemod phase runs through the active pair; phase config naming a stub generator errors loudly with activation criteria.

**One PR.**

### Phase 5: Griot integration + composability proof

Extend `griot-capture` to accept `evaluator-finding:` shape (five classifications: frequency, catalog-gap, conflict, exception, generator-antipattern). Extend `griot-compact` with classification-aware promotion rules. Add ev-loop's frequency counter file (`projects/<slug>/.guild-findings.jsonl`) and classification logic. Verify feedback loop: rollup section "antipatterns observed in this project" gets injected via `/griot-use` and generators avoid known patterns. Author the 30-line composability-proof loop variant that uses substrate without ev-loop opinions.

**Verification:** all four griot integration tests in plan; composability-proof loop runs end-to-end on a unit.

**One PR.**

## Dependencies

- Phase 1 must merge before any others.
- Phase 1.5 depends on Phase 1 merged. Inserts post-Phase-1 to establish the substrate convention.
- Phases 2, 3, and 4 each depend on Phase 1.5 merged (so the convention is in place before composition layers compose against it). They can land in any order or in parallel after that.
- Phase 5 depends on Phase 2 (real evaluators with catalogs to capture from). Can start work earlier but should land last.

## Verification

- `npm run lint`, `npm run build` (existing aart.camp checks)
- Substrate isolation: invoke `guild-spawn` from a context with no ev-loop loaded
- Composability proof: 30-line alternative loop runs end-to-end
- Per-phase functional tests as listed in plan's Verification section

## Risks

- **Aggregation pathology**: many evaluators × any-flag-blocks design could escalate constantly. Mitigated: blocking/advisory split + CLI-first detection means most flags are binary truth, not skeptical opinion.
- **Catalog drift**: eval-side `griot-use` could make evaluators less skeptical over time. Mitigated: deferred (Phase 13 of plan, optional and signal-driven; not in this rollout).
- **Mid-rollout breakage**: ev-loop is itself substrate other tooling depends on; broken state mid-rollout could affect concurrent work. Mitigated: each phase is independently revertable; substrate-first ordering means broken style doesn't block substrate adoption.
- **Stub bit-rot**: pre-creating Storybook/Playwright stubs that don't activate for months could go stale. Mitigated: stubs are tiny files documenting activation criteria; phase config naming an inactive stub errors loudly.
- **Eating our own dog food**: from Phase 2 onward, the project itself can use the substrate it's authoring. Recursive feedback is fun but introduces failure modes. Mitigated: keep using ev-loop's existing single-evaluator path until Phase 1 lands; only adopt the new panel for new work after Phase 2.

## Open questions

- Should `auto` derivation be the default in phase config from day one, or should we require explicit listing during initial rollout to make composition visible? Lean explicit-first, switch to `auto` once defaults are battle-tested.
- When to activate eval-side `griot-use`? Signal-driven post-rollout — wait for evidence of catalog drift becoming a real problem before flipping it on.
- Storybook / Playwright stub fate: do they convert to real generators only after their toolchains land in aart.camp, or do we ship them speculatively for other downstream repos?

## Rules

- **Substrate/style separation**: substrate is style-neutral; ev-loop encodes opinions explicitly. A different loop style should be able to compose substrate without inheriting ev-loop's choices.
- **Fluid composition**: no roster files, no roster registry. Phase config takes inline arrays of agent names or `auto`.
- **CLI-first detection**: each catalog entry has a CLI validator if one is reasonable; judgment fallback only when CLI is impractical.
- **Role-typed frontmatter**: every agent declares `role: whiteboard-engineer | evaluator | generator`. Substrate primitives refuse to spawn role-mismatched agents.
- Repo conventions: `~/.claude/CLAUDE.md`, `aart.camp/.claude/CLAUDE.md`, `projects/CONVENTIONS.md`.
- One PR per phase. Each PR safely revertable in isolation.
