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
- Phases 2, 3, and 4 each only depend on Phase 1 — they can land in any order or in parallel.
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
