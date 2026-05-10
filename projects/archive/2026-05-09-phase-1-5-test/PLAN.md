# Phase 1.5 e2e verification test project

## Context

Throwaway project to verify the Phase 1.5 substrate scripts compose correctly into a real project lifecycle. This artifact is the e2e evidence for D12 of the parent `agent-guilds` project. It will be archived to `projects/archive/` immediately after the verification exercise completes.

## Scope

**In:**
- Scaffold via `plan-scaffold.ts` (D10).
- Briefing via `autoload.ts` (D3).
- Session-note write via `save-session-finalize.ts` (D8).
- Archive via `archive-relocate.ts` (D7).
- Event recording via `autosave.ts` (D2).

**Out:**
- Opening real GitHub PRs for the test project.
- Running real evaluator subagents on the test unit.
- Recursing `/ev-loop-interactive` against the test project.

## Phases

### Phase 1: Verify

Document that all migrated Phase 1.5 substrate scripts were exercised end-to-end. One deliverable: a unit checkin (01.md) describing the exercise.

## Verification

- Project artifact exists at `projects/2026-05-09-phase-1-5-test/` post-scaffold.
- Briefing renders correctly via `autoload.ts`.
- Session note exists at `sessions/2026-05-09-a.md` after `save-session-finalize.ts` invocation.
- Project moved to `projects/archive/2026-05-09-phase-1-5-test/` after archive.
- Status field flipped from `active` to `archived`.

## Risks

- None. Throwaway project; archived immediately after verification.

## Open questions

- None.
