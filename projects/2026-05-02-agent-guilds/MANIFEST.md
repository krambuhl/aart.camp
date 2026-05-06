# Project: Agent guilds as composable substrate

**Slug**: 2026-05-02-agent-guilds
**Started**: 2026-05-02
**Status**: active
**Current branch**: ev.agent-guilds.phase-1-5-substrate-cleanup
**Latest checkin**: checkins/ev.agent-guilds.substrate-foundations/05.md

## Strategy

Extract `guild-*` agent-panel substrate alongside trout/griot, thin ev-loop into a clean composition example, ship aart.camp's specific agent roster (whiteboard engineers + antagonist evaluators with antipattern catalogs and CLI validators + domain-pair generators including stubs), and wire griot integration so antagonist findings flow into rollup and back into future generators. Five sequential-ish phases; substrate first, then evaluators / whiteboard / domain-pairs in any order, griot integration last.

## Phases

| # | Name | Status | Branch | Latest checkin | PR |
|---|------|--------|--------|----------------|----|
| 1 | Substrate foundations | completed | ev.agent-guilds.substrate-foundations | 05 | #8 (merged) |
| 1.5 | Substrate primitive cleanup | in-progress | ev.agent-guilds.phase-1-5-substrate-cleanup | — | — |
| 2 | Antagonist evaluator panel | not-started | — | — | — |
| 3 | Whiteboard mechanism + engineers | not-started | — | — | — |
| 4 | Domain pairs | not-started | — | — | — |
| 5 | Griot integration + composability proof | not-started | — | — | — |

## Dependencies

- Phase 1 must merge before any others.
- Phases 2, 3, and 4 each only depend on Phase 1 — they can land in any order or in parallel.
- Phase 5 depends on Phase 2 (real evaluators with catalogs to capture from). Can start work earlier but should land last.
- Phase 1.5 (inserted post-Phase-1) depends on Phase 1 merged. Phases 2-5 depend on Phase 1.5 merged so the substrate convention is in place before evaluator/whiteboard/domain-pair work composes against it.

## Current state

Phase 1 merged via PR #8. Phase 1.5 cut from main on `ev.agent-guilds.phase-1-5-substrate-cleanup` to establish the "scripts for CRUD, skills for LLM-shaped work, orchestration stays skill" convention surfaced by the post-merge architecture audit (see `sessions/2026-05-05-a.md`). Scope: 1 convention doc + 3 full CRUD migrations (`trout-autosave`, `trout-autoload`, `griot-capture` → `.claude/scripts/<family>/<verb>.js`) + 1 parser extraction (`guild-validate`) + 5 LLM/CRUD splits (`trout-pull-request`, `trout-archive` relocate, `trout-save-session` finalize, `trout-pr-respond` plumbing, `trout-plan` scaffold) + 1 inline-as-script (`griot-use`) + 1 e2e verification on a throwaway `phase-1-5-test` project. One conceptually unified PR. Loop: interactive. Per-family wildcard permissions (`Bash(node .claude/scripts/<family>/*)`) added to project-wide `.claude/settings.json` as each family's first script lands. Branch state: 1 artifact commit (post-merge audit + Phase 1.5 plan + 2 captured-but-uncommitted Phase 1 griot session-notes), 1 manifest commit (this one).

## Events

| When | Event | Detail |
|------|-------|--------|
| 2026-05-02 18:08 | project-initialized | — |
| 2026-05-02 19:31 | checkin-created | 01 on ev.agent-guilds.substrate-foundations |
| 2026-05-03 09:18 | checkin-created | 02 on ev.agent-guilds.substrate-foundations |
| 2026-05-03 19:08 | checkin-created | 03 on ev.agent-guilds.substrate-foundations |
| 2026-05-03 20:06 | checkin-created | 04 on ev.agent-guilds.substrate-foundations |
| 2026-05-03 20:09 | session-saved | 2026-05-03-a |
| 2026-05-04 10:17 | checkin-created | 05 on ev.agent-guilds.substrate-foundations |
| 2026-05-04 10:17 | phase-completed | 1 |
| 2026-05-04 15:03 | pr-opened | #8 |
| 2026-05-05 00:37 | pr-merged | #8 |
| 2026-05-05 09:00 | session-saved | 2026-05-05-a |
| 2026-05-05 11:00 | phase-started | 1.5 on ev.agent-guilds.phase-1-5-substrate-cleanup |
