# Project: Adopt Test Harnesses

**Slug**: 2026-05-06-adopt-test-harnesses
**Started**: 2026-05-06
**Status**: active
**Current branch**: ev.adopt-test-harnesses.playwright-harness
**Latest checkin**: checkins/ev.adopt-test-harnesses.github-actions-ci/01.md

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
| 2 | Storybook harness | completed | ev.adopt-test-harnesses.storybook-harness | 03 | #14 |
| 3 | Playwright harness | completed | ev.adopt-test-harnesses.playwright-harness | 02 | #15 (merged) |
| 4 | GitHub Actions CI | in-progress | ev.adopt-test-harnesses.github-actions-ci | 01 | #17 (open) |

## Dependencies
- Phase 3 requires Phase 2 merged
- Phase 4 requires Phases 1–3 merged
- Phases 1 and 2 are independent

## Current state

Phase 3 complete on `ev.adopt-test-harnesses.playwright-harness`.
Playwright installed (Chromium-only); `playwright.config.ts` with
`webServer` array (Next.js prod build for D1 route smoke; Storybook
dev server for D2 screenshots). Two e2e tests: D1 route smoke for
`/` asserting `<h1>Sketches</h1>` visible + no console/page errors;
D2 auto-screenshots every Storybook story by iterating
`storybook-static/index.json`, with one committed baseline
(`shared-stack--default.png`). Vitest narrowed to `.test.*` glob,
Playwright owns `.spec.*`. `.claude/settings.local.json` gitignored
to stop testing-artifact churn. All verification green: 24 vitest
tests, 2 e2e tests, lint clean, both builds clean. Ready to open
phase 3 PR.

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
| 2026-05-06 22:59 | pr-merged | #11 |
| 2026-05-06 18:44 | pr-opened | #14 |
| 2026-05-06 18:44 | phase-completed | 2 |
| 2026-05-07 04:00 | pr-merged | #14 |
| 2026-05-07 07:09 | checkin-created | 01 on ev.adopt-test-harnesses.playwright-harness |
| 2026-05-07 09:05 | checkin-created | 02 on ev.adopt-test-harnesses.playwright-harness |
| 2026-05-07 09:05 | phase-completed | 3 |
| 2026-05-07 09:09 | pr-opened | #15 |
| 2026-05-07 22:06 | pr-merged | #15 |
| 2026-05-07 23:06 | checkin-created | 01 on ev.adopt-test-harnesses.github-actions-ci |
| 2026-05-08 07:13 | pr-opened | #17 |
