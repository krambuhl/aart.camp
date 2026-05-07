# Project: Adopt Test Harnesses

**Slug**: 2026-05-06-adopt-test-harnesses
**Started**: 2026-05-06
**Status**: active
**Current branch**: ev.adopt-test-harnesses.vitest-harness
**Latest checkin**: checkins/ev.adopt-test-harnesses.storybook-harness/03.md

## Strategy

Stand up vitest, Storybook, Playwright, and GitHub Actions CI as testing
infrastructure for the aart.camp portfolio. Each phase ships a single
example test as a smoke screen — actual test coverage is explicitly
deferred. Four phases, four PRs, mostly linear dependency chain (Phases 1
and 2 independent; Phase 3 needs Phase 2 for stories; Phase 4 wires
everything into CI).

## Phases

| # | Name | Status | Branch | Latest checkin | PR |
|---|------|--------|--------|----------------|----|
| 1 | Vitest harness | completed | ev.adopt-test-harnesses.vitest-harness | 03 | #11 |
| 2 | Storybook harness | completed | ev.adopt-test-harnesses.storybook-harness | 03 | #14 (open) |
| 3 | Playwright harness | not-started | — | — | — |
| 4 | GitHub Actions CI | not-started | — | — | — |

## Dependencies
- Phase 3 requires Phase 2 merged
- Phase 4 requires Phases 1–3 merged
- Phases 1 and 2 are independent

## Current state

Phase 1 complete (post-rebase). Three checkins on the branch: 01 install + configure vitest, 02 example test for wrapResponsive, 03 consolidate substrate tests under vitest after rebasing on main. npm test runs both surfaces (23 tests across 2 files), npm run test:agentic filters to substrate (20 tests). Lint + build green. PR #11 still open; ready to push the rebased history and re-author the body via /trout-pull-request using the new multi-checkin template.

## Events

| When | Event | Detail |
|------|-------|--------|
| 2026-05-06 01:56 | project-initialized | — |
| 2026-05-06 02:41 | checkin-created | 01 on ev.adopt-test-harnesses.vitest-harness |
| 2026-05-06 03:26 | checkin-created | 02 on ev.adopt-test-harnesses.vitest-harness |
| 2026-05-06 04:05 | pr-opened | #11 |
| 2026-05-06 04:05 | phase-completed | 1 |
| 2026-05-06 07:47 | checkin-created | 03 on ev.adopt-test-harnesses.vitest-harness |
| 2026-05-06 15:50 | pr-updated | #11 |
| 2026-05-06 15:56 | session-saved | 2026-05-06-a |
| 2026-05-06 16:48 | checkin-created | 01 on ev.adopt-test-harnesses.storybook-harness |
| 2026-05-06 17:34 | checkin-created | 02 on ev.adopt-test-harnesses.storybook-harness |
| 2026-05-06 18:40 | checkin-created | 03 on ev.adopt-test-harnesses.storybook-harness |
| 2026-05-06 18:44 | pr-opened | #14 |
| 2026-05-06 18:44 | phase-completed | 2 |
