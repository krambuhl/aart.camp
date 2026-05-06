# Project: Agent guilds as composable substrate

**Slug**: 2026-05-02-agent-guilds
**Started**: 2026-05-02
**Status**: active
**Current branch**: ev.agent-guilds.replan-phase-1-5
**Latest checkin**: checkins/ev.agent-guilds.replan-phase-1-5/01.md

## Strategy

Extract `guild-*` agent-panel substrate alongside trout/griot, thin ev-loop into a clean composition example, ship aart.camp's specific agent roster (whiteboard engineers + antagonist evaluators with antipattern catalogs and CLI validators + domain-pair generators including stubs), and wire griot integration so antagonist findings flow into rollup and back into future generators. Five sequential-ish phases; substrate first, then evaluators / whiteboard / domain-pairs in any order, griot integration last.

## Phases

| # | Name | Status | Branch | Latest checkin | PR |
|---|------|--------|--------|----------------|----|
| 1 | Substrate foundations | completed | ev.agent-guilds.substrate-foundations | 05 | #8 (merged) |
| 1.5 | Substrate primitive cleanup | in-progress | ev.agent-guilds.replan-phase-1-5 | 01 | #9 (open) |
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

Phase 1 merged via PR #8. Phase 1.5 splits into two PRs after the post-merge audit produced both a rewritten plan (4× the original scope) and a load-bearing convention. **Replan PR** (current, on `ev.agent-guilds.replan-phase-1-5`) ships planning churn + deliverable 1 (the "Substrate primitive shapes" section in `projects/CONVENTIONS.md`). Branch state: artifact commit, MANIFEST open, PLAN.md Phase 1.5 detail, convention-doc unit (checkin 01, evaluator-approved on retry after a stray `next-env.d.ts` was reverted), this manifest update. **Cleanup PR** (next; cuts a fresh `ev.agent-guilds.phase-1-5-substrate-cleanup` from main once the replan merges) executes the remaining 11 deliverables: 3 full CRUD migrations (`trout-autosave`, `trout-autoload`, `griot-capture` → `.claude/scripts/<family>/<verb>.js`), 1 parser extraction (`guild-validate`), 5 LLM/CRUD splits (`trout-pull-request`, `trout-archive` relocate, `trout-save-session` finalize, `trout-pr-respond` plumbing, `trout-plan` scaffold), 1 inline-as-script (`griot-use`), 1 e2e verification on `phase-1-5-test`. Loop: interactive. Per-family wildcard permissions (`Bash(node .claude/scripts/<family>/*)`) added to project-wide `.claude/settings.json` as each family's first script lands.

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
| 2026-05-05 11:00 | phase-started | 1.5 on ev.agent-guilds.replan-phase-1-5 |
| 2026-05-05 11:30 | checkin-created | 01 on ev.agent-guilds.replan-phase-1-5 |
| 2026-05-05 12:00 | note | Phase 1.5 split into replan PR (this branch, ships convention doc) + cleanup PR (next, executes 11 migrations) |
| 2026-05-05 21:28 | session-saved | 2026-05-05-b.md |
| 2026-05-05 21:30 | pr-opened | #9 |
| 2026-05-05 21:31 | pr-updated | #9 |
