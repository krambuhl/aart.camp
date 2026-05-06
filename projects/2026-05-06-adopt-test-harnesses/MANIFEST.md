# Project: Adopt Test Harnesses

**Slug**: 2026-05-06-adopt-test-harnesses
**Started**: 2026-05-06
**Status**: active
**Current branch**: ev.adopt-test-harnesses.vitest-harness
**Latest checkin**: checkins/ev.adopt-test-harnesses.vitest-harness/01.md

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
| 1 | Vitest harness | in-progress | ev.adopt-test-harnesses.vitest-harness | 01 | — |
| 2 | Storybook harness | not-started | — | — | — |
| 3 | Playwright harness | not-started | — | — | — |
| 4 | GitHub Actions CI | not-started | — | — | — |

## Dependencies
- Phase 3 requires Phase 2 merged
- Phase 4 requires Phases 1–3 merged
- Phases 1 and 2 are independent

## Current state

Phase 1, D1 complete: vitest + RTL + jest-dom + jsdom installed and
configured. vitest.config.ts and vitest.setup.ts in place. npm test
passes (with --passWithNoTests until D2). Build and lint clean. Next:
D2 — write the example test against wrapResponsive (or similar) and
remove the --passWithNoTests crutch if appropriate.

## Events

| When | Event | Detail |
|------|-------|--------|
| 2026-05-06 01:56 | project-initialized | — |
| 2026-05-06 02:41 | checkin-created | 01 on ev.adopt-test-harnesses.vitest-harness |
