# Project: Agent guilds as composable substrate

**Slug**: 2026-05-02-agent-guilds
**Started**: 2026-05-02
**Status**: active
**Current branch**: ev.agent-guilds.phase-1-5-substrate-cleanup-2
**Latest checkin**: checkins/ev.agent-guilds.phase-1-5-substrate-cleanup-2/01.md

## Strategy

Extract `guild-*` agent-panel substrate alongside trout/griot, thin ev-loop into a clean composition example, ship aart.camp's specific agent roster (whiteboard engineers + antagonist evaluators with antipattern catalogs and CLI validators + domain-pair generators including stubs), and wire griot integration so antagonist findings flow into rollup and back into future generators. Five sequential-ish phases; substrate first, then evaluators / whiteboard / domain-pairs in any order, griot integration last.

## Phases

| # | Name | Status | Branch | Latest checkin | PR |
|---|------|--------|--------|----------------|----|
| 1 | Substrate foundations | completed | ev.agent-guilds.substrate-foundations | 05 | #8 (merged) |
| 1.5 | Substrate primitive cleanup | in-progress | ev.agent-guilds.phase-1-5-substrate-cleanup-2 | 01 | #13 (open) |
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

Phase 1 merged via PR #8. Phase 1.5 split into a sequence of PRs after a post-merge audit produced both a rewritten plan (4× original scope) and a load-bearing convention. **Replan PR #9 merged** (on `ev.agent-guilds.replan-phase-1-5`) — planning churn, deliverable 1 (the "Substrate primitive shapes" section in `projects/CONVENTIONS.md`), the `/trout-pull-request` rework (multi-checkin support + why-focus gate), and the project-wide `.claude/settings.json` for substrate skills. **First cleanup PR #10 merged** (on `ev.agent-guilds.phase-1-5-substrate-cleanup`) — deliverable 2 (`trout-autosave` → `.claude/scripts/trout/autosave.ts` with sibling `.test.ts`, 20 tests), the substrate-script convention bootstrap (CONVENTIONS.md "Substrate scripts: layout and conventions" section, root `npm run test`, nested `.claude/scripts/package.json` ESM stopgap, `Bash(node .claude/scripts/trout/*)` permission), a self-documenting tightening of `/trout-pull-request` so PR bodies cap at 500-600 words (Invariant 7), plus a follow-on landed outside this plan (PR #12) requiring a substrate-orientation `[!NOTE]` callout in PR bodies. **Second cleanup PR** (current, on `ev.agent-guilds.phase-1-5-substrate-cleanup-2` cut from main post-#10-merge) executes the remaining 10 deliverables: 2 full CRUD migrations (`trout-autoload`, `griot-capture` → `.claude/scripts/<family>/<verb>.ts`), 1 parser extraction (`guild-validate`), 5 LLM/CRUD splits (`trout-pull-request` LLM/CRUD split, `trout-archive` relocate, `trout-save-session` finalize, `trout-pr-respond` plumbing, `trout-plan` scaffold), 1 inline-as-script (`griot-use`), 1 e2e verification on `phase-1-5-test`. Loop: interactive, sequential ordering. Next: deliverable 3 — `trout-autoload` → `.claude/scripts/trout/autoload.ts`. Per-family wildcard permissions (`Bash(node .claude/scripts/<family>/*)`) land alongside each family's first script.

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
| 2026-05-05 22:16 | checkin-created | 02 on ev.agent-guilds.replan-phase-1-5 |
| 2026-05-05 22:41 | pr-updated | #9 (re-authored via new multi-checkin skill from checkins 01,02) |
| 2026-05-05 23:59 | pr-merged | #9 |
| 2026-05-05 23:59 | note | Phase 1.5 cleanup branch ev.agent-guilds.phase-1-5-substrate-cleanup cut from main post-#9-merge; deliverables 2-12 begin here |
| 2026-05-06 02:12 | checkin-created | 01 on ev.agent-guilds.phase-1-5-substrate-cleanup |
| 2026-05-06 02:52 | pr-opened | #10 |
| 2026-05-06 03:25 | session-saved | 2026-05-06-a |
| 2026-05-06 03:54 | pr-updated | #10 (re-authored with concise template) |
| 2026-05-06 04:05 | checkin-created | 02 on ev.agent-guilds.phase-1-5-substrate-cleanup |
| 2026-05-06 04:06 | pr-updated | #10 (multi-checkin re-author from 01,02) |
| 2026-05-06 04:07 | pr-merged | #10 |
| 2026-05-06 05:00 | note | Second cleanup branch ev.agent-guilds.phase-1-5-substrate-cleanup-2 cut from main post-#10-merge; deliverables 3-12 begin here |
| 2026-05-06 16:30 | checkin-created | 01 on ev.agent-guilds.phase-1-5-substrate-cleanup-2 |
| 2026-05-06 16:32 | pr-opened | #13 |
