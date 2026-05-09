# Project: Agent guilds as composable substrate

**Slug**: 2026-05-02-agent-guilds
**Started**: 2026-05-02
**Status**: active
**Current branch**: ev.agent-guilds.phase-1-5-substrate-cleanup-7
**Latest checkin**: checkins/ev.agent-guilds.phase-1-5-substrate-cleanup-7/12.md

## Strategy

Extract `guild-*` agent-panel substrate alongside trout/griot, thin ev-loop into a clean composition example, ship aart.camp's specific agent roster (whiteboard engineers + antagonist evaluators with antipattern catalogs and CLI validators + domain-pair generators including stubs), and wire griot integration so antagonist findings flow into rollup and back into future generators. Five sequential-ish phases; substrate first, then evaluators / whiteboard / domain-pairs in any order, griot integration last.

## Phases

| # | Name | Status | Branch | Latest checkin | PR |
|---|------|--------|--------|----------------|----|
| 1 | Substrate foundations | completed | ev.agent-guilds.substrate-foundations | 05 | #8 (merged) |
| 1.5 | Substrate primitive cleanup | in-progress | ev.agent-guilds.phase-1-5-substrate-cleanup-7 | 12 | — |
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

Phase 1 merged via PR #8. Phase 1.5 split into a sequence of PRs after a post-merge audit produced both a rewritten plan (4× original scope) and a load-bearing convention. **Deliverables 1-9 shipped** across PRs #9 (replan + D1 convention doc + `/trout-pull-request` rework + project-wide `.claude/settings.json`), #10 (D2 `trout-autosave` migration + substrate-script convention bootstrap), #13 + #16 (D3-D5 full CRUD migrations: `trout-autoload`, `griot-capture`, `guild-validate` parser extraction), #18 (D6 `trout-pull-request` LLM/CRUD split), #23 (D7 `trout-archive` relocate split), #26 (D8 `trout-save-session` finalize split), and #28 (D9 `trout-pr-respond` plumbing split). Co-shipped follow-ons outside the plan: #12 (substrate-orientation `[!NOTE]` callout in PR bodies) and #20 (allowlist tightening). **Current cleanup branch** `ev.agent-guilds.phase-1-5-substrate-cleanup-7` (cut from main post-#28-merge) carries the remaining 3 deliverables: D10 (`trout-plan` scaffold split — interview stays prose, post-interview scaffold becomes `.claude/scripts/trout/plan-scaffold.ts`), D11 (`griot-use` → `.claude/scripts/griot/use.ts` + inline its invocation into `/ev-run`'s setup step, deleting the standalone skill), D12 (e2e verification on a throwaway `phase-1-5-test` project via the migrated path). Loop: interactive, sequential ordering. Next: deliverable 10 — `trout-plan` scaffold split. Per-family wildcard permissions (`Bash(node .claude/scripts/<family>/*)`) already landed for `trout` and `griot` families.

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
| 2026-05-06 16:51 | checkin-created | 02 on ev.agent-guilds.phase-1-5-substrate-cleanup-2 |
| 2026-05-06 16:53 | pr-updated | #13 (re-authored via new multi-checkin skill from checkins 01,02 with project-aware callout) |
| 2026-05-06 17:39 | checkin-created | 03 on ev.agent-guilds.phase-1-5-substrate-cleanup-2 |
| 2026-05-06 17:40 | pr-updated | #13 (re-authored multi-checkin from 01,02,03 with deliverable 4) |
| 2026-05-06 18:57 | checkin-created | 04 on ev.agent-guilds.phase-1-5-substrate-cleanup-2 |
| 2026-05-07 01:12 | checkin-created | 05 on ev.agent-guilds.phase-1-5-substrate-cleanup-2 |
| 2026-05-07 01:16 | pr-updated | #13 (re-authored multi-checkin from 01,02,03,04,05 — final shape before merge) |
| 2026-05-07 03:18 | checkin-created | 06 on ev.agent-guilds.phase-1-5-substrate-cleanup-2 |
| 2026-05-07 03:21 | pr-updated | #13 (re-authored from 01-06; final shape with dense-packet codification) |
| 2026-05-07 23:04 | checkin-created | 07 on ev.agent-guilds.phase-1-5-substrate-cleanup-2 |
| 2026-05-08 00:25 | pr-opened | #16 |
| 2026-05-08 07:05 | pr-merged | #13 |
| 2026-05-08 07:05 | note | Phase row corrected: pr=#16 (was incorrectly recorded as #13 due to typo in submit invocation) |
| 2026-05-08 07:11 | session-saved | 2026-05-08-a |
| 2026-05-08 07:17 | pr-updated | #16 (transparency note added re: stray session-notes) |
| 2026-05-08 07:24 | pr-merged | #16 (cleanup-2 deliverables D3-D5 + D6-script-half) |
| 2026-05-08 07:26 | note | Third cleanup branch ev.agent-guilds.phase-1-5-substrate-cleanup-3 cut from main post-#16-merge; deliverables D6-rest, D7-D12 begin here |
| 2026-05-08 08:24 | checkin-created | 08 on ev.agent-guilds.phase-1-5-substrate-cleanup-3 |
| 2026-05-08 08:37 | pr-opened | #18 |
| 2026-05-08 08:38 | note | correction: trout-pull-request SKILL.md prose incorrectly claimed pr-plumbing.ts submit substitutes <N> in --phase-update; it does not. Phase row now shows literal #<N> (open) — correcting to #18 (open) |
| 2026-05-08 09:03 | session-saved | 2026-05-08-b |
| 2026-05-08 15:26 | pr-updated | #18 |
| 2026-05-08 15:52 | pr-merged | #18 (cleanup-3 deliverable D6-rest: trout-pull-request SKILL.md LLM/CRUD split) |
| 2026-05-08 15:53 | note | Fourth cleanup branch ev.agent-guilds.phase-1-5-substrate-cleanup-4 cut from main post-#18-merge; deliverables D7-D12 begin here |
| 2026-05-08 19:20 | checkin-created | 09 on ev.agent-guilds.phase-1-5-substrate-cleanup-4 |
| 2026-05-08 19:28 | pr-opened | #23 |
| 2026-05-08 19:30 | note | phase-row PR field updated post-submit |
| 2026-05-08 19:40 | pr-merged | #23 (cleanup-4 deliverable D7: trout-archive relocate split) |
| 2026-05-08 19:41 | note | Fifth cleanup branch ev.agent-guilds.phase-1-5-substrate-cleanup-5 cut from main post-#23-merge; deliverables D8-D12 begin here |
| 2026-05-08 22:14 | checkin-created | 10 on ev.agent-guilds.phase-1-5-substrate-cleanup-5 |
| 2026-05-08 22:22 | pr-opened | #26 |
| 2026-05-08 22:23 | note | phase-row PR field updated post-submit |
| 2026-05-08 22:28 | pr-merged | #26 (cleanup-5 deliverable D8: trout-save-session finalize split) |
| 2026-05-08 22:29 | note | Sixth cleanup branch ev.agent-guilds.phase-1-5-substrate-cleanup-6 cut from main post-#26-merge; deliverables D9-D12 begin here |
| 2026-05-08 23:47 | checkin-created | 11 on ev.agent-guilds.phase-1-5-substrate-cleanup-6 |
| 2026-05-08 23:50 | pr-opened | #28 |
| 2026-05-08 23:50 | note | phase-row PR field updated post-submit |
| 2026-05-09 02:13 | pr-merged | #28 (cleanup-6 D9: trout-pr-respond plumbing split) |
| 2026-05-09 02:17 | session-saved | 2026-05-09-a |
| 2026-05-09 02:36 | note | Seventh cleanup branch ev.agent-guilds.phase-1-5-substrate-cleanup-7 cut from main post-#28-merge; deliverables D10-D12 begin here |
| 2026-05-09 04:23 | checkin-created | 12 on ev.agent-guilds.phase-1-5-substrate-cleanup-7 |
