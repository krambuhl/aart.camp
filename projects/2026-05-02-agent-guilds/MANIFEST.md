# Project: Agent guilds as composable substrate

**Slug**: 2026-05-02-agent-guilds
**Started**: 2026-05-02
**Status**: active
**Current branch**: ev.agent-guilds.substrate-foundations
**Latest checkin**: checkins/ev.agent-guilds.substrate-foundations/01.md

## Strategy

Extract `guild-*` agent-panel substrate alongside trout/griot, thin ev-loop into a clean composition example, ship aart.camp's specific agent roster (whiteboard engineers + antagonist evaluators with antipattern catalogs and CLI validators + domain-pair generators including stubs), and wire griot integration so antagonist findings flow into rollup and back into future generators. Five sequential-ish phases; substrate first, then evaluators / whiteboard / domain-pairs in any order, griot integration last.

## Phases

| # | Name | Status | Branch | Latest checkin | PR |
|---|------|--------|--------|----------------|----|
| 1 | Substrate foundations | in-progress | ev.agent-guilds.substrate-foundations | 01 | — |
| 2 | Antagonist evaluator panel | not-started | — | — | — |
| 3 | Whiteboard mechanism + engineers | not-started | — | — | — |
| 4 | Domain pairs | not-started | — | — | — |
| 5 | Griot integration + composability proof | not-started | — | — | — |

## Dependencies

- Phase 1 must merge before any others.
- Phases 2, 3, and 4 each only depend on Phase 1 — they can land in any order or in parallel.
- Phase 5 depends on Phase 2 (real evaluators with catalogs to capture from). Can start work earlier but should land last.

## Current state

Phase 1 unit 1 of 4 complete: evaluator-base.md and evaluator-contract-fit.md introduced; evaluator.md preserved as bridge. Evaluator approved verdict. Awaiting decision: commit per-deliverable or batch at phase close, then proceed to unit 2 (author guild-spawn).

## Events

| When | Event | Detail |
|------|-------|--------|
| 2026-05-02 18:08 | project-initialized | — |
| 2026-05-02 19:31 | checkin-created | 01 on ev.agent-guilds.substrate-foundations |
