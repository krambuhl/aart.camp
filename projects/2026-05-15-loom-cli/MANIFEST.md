# Project: Loom: JSON-first project-substrate CLI

**Slug**: 2026-05-15-loom-cli
**Started**: 2026-05-15
**Status**: active
**Current branch**: loom-cli/phase-4-pr
**Latest checkin**: checkins/loom-cli/phase-4-pr/01.md

## Strategy

Build loom, a project-memory CLI designed for orchestration loops as first-class consumers. JSON-only storage (PLAN.md is the sole markdown), TDD throughout, plus a four-skill family (loom-session, loom-pr, loom-pr-respond, loom-archive) that wraps the CLI for narrative composition. Planning is explicitly out of scope; retros are temporary tenants designed to lift out to a future griot CLI.

## Phases

| # | Name | Status | Branch | Latest checkin | PR |
|---|------|--------|--------|----------------|----|
| 1 | Schemas + fixtures | completed | loom-cli/phase-1-schemas | 03 | #57 (merged) |
| 2 | Foundations + read API | completed | loom-cli/phase-2-foundations | 04 | #62 (open) |
| 3 | Lifecycle write API + lifecycle skills | completed | loom-cli/phase-3-lifecycle | 04 | #67 (open) |
| 4 | PR write API + PR skills | in-progress | loom-cli/phase-4-pr | 01 | #68 (open) |

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
| 2026-05-15 10:15 | checkin-created | 04 on loom-cli/phase-2-foundations |
| 2026-05-15 10:16 | pr-opened | #62 |
| 2026-05-15 10:16 | phase-completed | 2 |
| 2026-05-15 10:22 | checkin-created | 01 on loom-cli/phase-3-lifecycle |
| 2026-05-15 10:23 | pr-opened | #63 |
| 2026-05-15 10:29 | checkin-created | 02 on loom-cli/phase-3-lifecycle |
| 2026-05-15 10:29 | pr-opened | #65 |
| 2026-05-15 10:35 | checkin-created | 03 on loom-cli/phase-3-lifecycle |
| 2026-05-15 10:36 | pr-opened | #66 |
| 2026-05-15 10:43 | checkin-created | 04 on loom-cli/phase-3-lifecycle |
| 2026-05-15 10:43 | pr-opened | #67 |
| 2026-05-15 10:43 | phase-completed | 3 |
| 2026-05-15 10:50 | checkin-created | 01 on loom-cli/phase-4-pr |
| 2026-05-15 10:50 | pr-opened | #68 |
