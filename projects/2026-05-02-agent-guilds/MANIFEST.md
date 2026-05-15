# Project: Agent guilds as composable substrate

**Slug**: 2026-05-02-agent-guilds
**Started**: 2026-05-02
**Status**: active
**Current branch**: ev.agent-guilds.whiteboard-2
**Latest checkin**: checkins/ev.agent-guilds.whiteboard-2/01.md

## Strategy

Extract `guild-*` agent-panel substrate alongside trout/griot, thin ev-loop into a clean composition example, ship aart.camp's specific agent roster (whiteboard engineers + antagonist evaluators with antipattern catalogs and CLI validators + domain-pair generators including stubs), and wire griot integration so antagonist findings flow into rollup and back into future generators. Five sequential-ish phases; substrate first, then evaluators / whiteboard / domain-pairs in any order, griot integration last.

## Phases

| # | Name | Status | Branch | Latest checkin | PR |
|---|------|--------|--------|----------------|----|
| 1 | Substrate foundations | completed | ev.agent-guilds.substrate-foundations | 05 | #8 (merged) |
| 1.5 | Substrate primitive cleanup | completed | ev.agent-guilds.phase-1-5-carryover-3 | 01 | #42 (merged) |
| 2 | Antagonist evaluator panel | completed | ev.agent-guilds.antagonist-evaluator-panel-8 | 01 | #52 (merged) |
| 3 | Whiteboard mechanism + engineers | in-progress | ev.agent-guilds.whiteboard-2 | 01 | #58 (open) |
| 4 | Domain pairs | not-started | — | — | — |
| 5 | Griot integration + composability proof | not-started | — | — | — |

## Dependencies

- Phase 1 must merge before any others.
- Phases 2, 3, and 4 each only depend on Phase 1 — they can land in any order or in parallel.
- Phase 5 depends on Phase 2 (real evaluators with catalogs to capture from). Can start work earlier but should land last.
- Phase 1.5 (inserted post-Phase-1) depends on Phase 1 merged. Phases 2-5 depend on Phase 1.5 merged so the substrate convention is in place before evaluator/whiteboard/domain-pair work composes against it.

## Current state

Phase 1 merged via PR #8. Phase 1.5 split into a sequence of PRs after a post-merge audit produced both a rewritten plan (4× original scope) and a load-bearing convention. **Deliverables 1-11 shipped** across PRs #9 (replan + D1 convention doc + `/trout-pull-request` rework + project-wide `.claude/settings.json`), #10 (D2 `trout-autosave` migration + substrate-script convention bootstrap), #13 + #16 (D3-D5 full CRUD migrations: `trout-autoload`, `griot-capture`, `guild-validate` parser extraction), #18 (D6 `trout-pull-request` LLM/CRUD split), #23 (D7 `trout-archive` relocate split), #26 (D8 `trout-save-session` finalize split), #28 (D9 `trout-pr-respond` plumbing split), #30 (D10 `trout-plan` scaffold split), and #32 (D11 `griot-use` → script + ev-run inline + skill deletion + settings cleanup). Co-shipped follow-ons outside the plan: #12 (substrate-orientation `[!NOTE]` callout in PR bodies) and #20 (allowlist tightening). **Current cleanup branch** `ev.agent-guilds.phase-1-5-substrate-cleanup-9` (cut from main post-#32-merge) carries the **final deliverable**: D12 (e2e verification on a throwaway `phase-1-5-test` project via the migrated path; also removes the now-orphaned `autosave.ts::runInit` + `--init` flag deferred from D10's AC #3; closes Phase 1.5). Loop: interactive, sequential ordering. Per-family wildcard permissions (`Bash(node .claude/scripts/<family>/*)`) already landed for `trout` and `griot` families.

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
| 2026-05-09 04:27 | pr-opened | #30 |
| 2026-05-09 05:47 | note | phase-row PR field updated post-submit |
| 2026-05-09 08:41 | pr-merged | #30 (cleanup-7 D10: trout-plan scaffold split) |
| 2026-05-09 08:41 | note | Eighth cleanup branch ev.agent-guilds.phase-1-5-substrate-cleanup-8 cut from main post-#30-merge; deliverables D11-D12 begin here |
| 2026-05-09 20:50 | checkin-created | 13 on ev.agent-guilds.phase-1-5-substrate-cleanup-8 |
| 2026-05-09 20:53 | pr-opened | #32 |
| 2026-05-09 20:53 | note | phase-row PR field updated post-submit |
| 2026-05-09 22:06 | pr-merged | #32 (cleanup-8 D11: griot-use → script + ev-run inline + skill deletion) |
| 2026-05-09 22:06 | note | Ninth cleanup branch ev.agent-guilds.phase-1-5-substrate-cleanup-9 cut from main post-#32-merge; deliverable D12 begins here (closes Phase 1.5) |
| 2026-05-10 00:13 | phase-completed | 1.5 |
| 2026-05-10 00:18 | checkin-created | 14 on ev.agent-guilds.phase-1-5-substrate-cleanup-9 |
| 2026-05-10 00:22 | pr-opened | #33 |
| 2026-05-10 00:22 | note | phase-row PR field updated post-submit |
| 2026-05-10 00:34 | session-saved | 2026-05-10-a |
| 2026-05-10 07:59 | pr-merged | #33 (cleanup-9 D12: e2e verification + autosave --init cleanup; closes Phase 1.5) |
| 2026-05-11 08:36 | note | substrate cleanup carryover shipped via #34 (non-phase): vitest convention, archive-relocate atomicity + precheck, resolveProject dedup |
| 2026-05-11 02:02 | note | Phase 1.5 reopened to ship D13-D15 carryover (autoload-gh, allowlist tightening, Item.location cleanup) |
| 2026-05-11 02:19 | checkin-created | 01 on ev.agent-guilds.phase-1-5-carryover-1 |
| 2026-05-11 02:20 | pr-updated | #39 |
| 2026-05-11 02:24 | pr-merged | #39 |
| 2026-05-11 02:24 | note | Carryover-2 branch cut from main post-#39-merge; deliverable D14 begins here |
| 2026-05-11 02:36 | checkin-created | 01 on ev.agent-guilds.phase-1-5-carryover-2 |
| 2026-05-11 02:37 | pr-updated | #41 |
| 2026-05-11 02:39 | pr-merged | #41 |
| 2026-05-11 02:40 | note | Carryover-3 branch cut from main post-#41-merge; deliverable D15 begins here |
| 2026-05-11 02:45 | checkin-created | 01 on ev.agent-guilds.phase-1-5-carryover-3 |
| 2026-05-11 02:45 | pr-updated | #42 |
| 2026-05-11 02:50 | phase-completed | 1.5 |
| 2026-05-11 02:50 | pr-merged | #42 |
| 2026-05-11 02:52 | session-saved | 2026-05-11-a.md |
| 2026-05-11 03:11 | note | Phase 2 branch cut from main post-#42-merge; D1 evaluator-a11y begins here |
| 2026-05-11 03:33 | checkin-created | 01 on ev.agent-guilds.antagonist-evaluator-panel |
| 2026-05-11 03:35 | pr-opened | #43 |
| 2026-05-11 03:38 | pr-merged | #43 |
| 2026-05-11 03:39 | note | Antagonist-evaluator-panel-2 branch cut from main post-#43-merge; D2 evaluator-nextjs begins here |
| 2026-05-11 03:58 | checkin-created | 01 on ev.agent-guilds.antagonist-evaluator-panel-2 |
| 2026-05-11 03:59 | pr-opened | #45 |
| 2026-05-14 11:59 | pr-merged | #45 |
| 2026-05-14 12:29 | note | Antagonist-evaluator-panel-3 branch cut from main post-#45-merge; D3 evaluator-react-api begins here |
| 2026-05-14 12:48 | checkin-created | 01 on ev.agent-guilds.antagonist-evaluator-panel-3 |
| 2026-05-14 12:50 | pr-opened | #46 |
| 2026-05-14 13:49 | pr-merged | #46 |
| 2026-05-14 13:50 | note | Antagonist-evaluator-panel-4 branch cut from main post-#46-merge; D4 evaluator-tokens begins here |
| 2026-05-14 15:16 | checkin-created | 01 on ev.agent-guilds.antagonist-evaluator-panel-4 |
| 2026-05-14 15:17 | pr-opened | #48 |
| 2026-05-14 21:53 | pr-merged | #48 |
| 2026-05-14 21:56 | note | Antagonist-evaluator-panel-5 branch cut from main post-#48-merge; D5 evaluator-naming begins here |
| 2026-05-14 22:22 | checkin-created | 01 on ev.agent-guilds.antagonist-evaluator-panel-5 |
| 2026-05-14 22:23 | pr-opened | #49 |
| 2026-05-14 22:26 | pr-merged | #49 |
| 2026-05-14 22:28 | note | Antagonist-evaluator-panel-6 branch cut from main post-#49-merge; D6 PANEL-COMPOSITION docs begins here |
| 2026-05-14 22:35 | checkin-created | 01 on ev.agent-guilds.antagonist-evaluator-panel-6 |
| 2026-05-14 22:36 | pr-opened | #50 |
| 2026-05-14 22:39 | pr-merged | #50 |
| 2026-05-14 22:40 | note | Antagonist-evaluator-panel-7 branch cut from main post-#50-merge; D7 derive-panel auto-derivation begins here |
| 2026-05-14 22:54 | checkin-created | 01 on ev.agent-guilds.antagonist-evaluator-panel-7 |
| 2026-05-14 22:55 | pr-opened | #51 |
| 2026-05-14 23:00 | pr-merged | #51 |
| 2026-05-14 23:02 | note | Antagonist-evaluator-panel-8 branch cut from main post-#51-merge; D8 multi-evaluator smoke test (Phase 2 close) begins here |
| 2026-05-15 00:28 | checkin-created | 01 on ev.agent-guilds.antagonist-evaluator-panel-8 |
| 2026-05-15 00:30 | pr-opened | #52 |
| 2026-05-15 00:30 | phase-completed | 2 |
| 2026-05-15 00:55 | pr-merged | #52 |
| 2026-05-15 01:04 | note | Whiteboard branch cut from main post-#52-merge; Phase 3 D1 (guild-whiteboard primitive + ev-loop integration) begins here |
| 2026-05-15 01:20 | checkin-created | 01 on ev.agent-guilds.whiteboard |
| 2026-05-15 01:21 | pr-opened | #55 |
| 2026-05-15 01:40 | checkin-created | 02 on ev.agent-guilds.whiteboard |
| 2026-05-15 01:42 | pr-updated | #55 |
| 2026-05-15 01:49 | pr-merged | #55 |
| 2026-05-15 01:50 | note | whiteboard-2 branch cut from main post-#55-merge; Phase 3 D2 (six whiteboard engineer agents) begins here |
| 2026-05-15 09:29 | checkin-created | 01 on ev.agent-guilds.whiteboard-2 |
| 2026-05-15 09:30 | pr-opened | #58 |
