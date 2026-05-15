# Project: Loom: JSON-first project-substrate CLI

**Slug**: 2026-05-15-loom-cli
**Started**: 2026-05-15
**Status**: active
**Current branch**: loom-cli/phase-2-foundations
**Latest checkin**: checkins/loom-cli/phase-2-foundations/03.md

## Strategy

Build loom, a project-memory CLI designed for orchestration loops as first-class consumers. JSON-only storage (PLAN.md is the sole markdown), TDD throughout, plus a four-skill family (loom-session, loom-pr, loom-pr-respond, loom-archive) that wraps the CLI for narrative composition. Planning is explicitly out of scope; retros are temporary tenants designed to lift out to a future griot CLI.

## Phases

| # | Name | Status | Branch | Latest checkin | PR |
|---|------|--------|--------|----------------|----|
| 1 | Schemas + fixtures | completed | loom-cli/phase-1-schemas | 03 | #57 (merged) |
| 2 | Foundations + read API | in-progress | loom-cli/phase-2-foundations | 03 | #61 (open) |
| 3 | Lifecycle write API + lifecycle skills | not-started | — | — | — |
| 4 | PR write API + PR skills | not-started | — | — | — |

## Dependencies

- Phase 2: requires Phase 1 merged
- Phase 3: requires Phase 2 merged
- Phase 4: requires Phase 3 merged

## Current state

Project initialized. No work started yet.

## Events

| When | Event | Detail |
|------|-------|--------|
| 2026-05-15 00:24 | project-initialized | — |
| 2026-05-15 01:13 | checkin-created | 01 on loom-cli/phase-1-schemas |
| 2026-05-15 01:14 | pr-opened | #54 |
| 2026-05-15 01:32 | checkin-created | 02 on loom-cli/phase-1-schemas |
| 2026-05-15 01:34 | pr-opened | #56 |
| 2026-05-15 01:58 | checkin-created | 03 on loom-cli/phase-1-schemas |
| 2026-05-15 02:00 | pr-opened | #57 |
| 2026-05-15 02:00 | phase-completed | 1 |
| 2026-05-15 09:30 | pr-merged | #57 |
| 2026-05-15 09:35 | checkin-created | 01 on loom-cli/phase-2-foundations |
| 2026-05-15 09:36 | pr-opened | #59 |
| 2026-05-15 09:50 | checkin-created | 02 on loom-cli/phase-2-foundations |
| 2026-05-15 09:51 | pr-opened | #60 |
| 2026-05-15 10:02 | checkin-created | 03 on loom-cli/phase-2-foundations |
| 2026-05-15 10:03 | pr-opened | #61 |
