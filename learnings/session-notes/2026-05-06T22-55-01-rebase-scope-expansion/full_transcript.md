# Checkin 03 — ev.adopt-test-harnesses.vitest-harness

**Created**: 2026-05-06 07:45
**Phase**: 1 — Vitest harness
**Unit**: D3 — Consolidate substrate tests under vitest (post-rebase scope expansion)

## Contract

- **Goal**: After rebasing on a main that introduced its own `node:test`-based
  test runner for `.claude/scripts/`, consolidate that surface under vitest
  so the project has a single test harness instead of two competing ones.
  Add a `test:agentic` script as a focused filter for substrate-only test
  runs.

- **Acceptance criteria**:
  - `.claude/scripts/trout/autosave.test.ts` runs under vitest with no
    behavior changes (still spawns the autosave subprocess, still asserts
    via `node:assert/strict`)
  - The conversion is mechanical: change `import { test } from 'node:test'`
    → `import { test } from 'vitest'`; add `// @vitest-environment node`
    annotation at the top of the file (overrides the global jsdom default
    for this Node-flavored test that does file I/O and spawns subprocesses)
  - `package.json` has `"test:agentic": "vitest run .claude/scripts"` as a
    filter for substrate-only runs
  - `npm test` collects and passes both the application tests
    (`utilities/opaque-responsive.test.ts`) AND the substrate tests
    (`.claude/scripts/trout/autosave.test.ts`)
  - `npm run test:agentic` runs only the substrate tests
  - The pre-existing main `"test": "node --test '.claude/scripts/**/*.test.ts'"`
    is gone (replaced by vitest at script level; the rebase resolution
    took our D1 vitest version)
  - `npm run lint` and `npm run build` still clean

- **Rules applied**:
  - Project CLAUDE.md: simple, no over-engineering, basic
  - User CLAUDE.md: composition over configuration; one harness over two
    is the cleaner abstraction
  - Verification: `npm run lint`, `npm run build`, `npm test`,
    `npm run test:agentic`

- **Disqualifiers**:
  - Substrate tests no longer pass after conversion (would be a regression
    on functionality main relied on)
  - Migration to vitest's `expect()` style — that's a stylistic rewrite,
    not a harness consolidation; node:assert keeps working under vitest
  - Adding vitest config changes (the conversion should require zero config
    edits — vitest's default glob already picks up `.test.ts` files
    anywhere in the tree)
  - Renaming the substrate test file or moving it elsewhere — out of scope

- **Inputs**:
  - `.claude/scripts/trout/autosave.test.ts` (rebased in from main)
  - `.claude/scripts/trout/autosave.ts` (subject under test, also from main)
  - `package.json` (script edit)
  - `vitest.config.ts` (no expected changes)

## Execution

Two-line edit to `.claude/scripts/trout/autosave.test.ts`:

1. Added `// @vitest-environment node` as the first line. Necessary
   because the file does Node-only work (subprocess execution via
   `execFileSync`, temp directory creation, file system reads/writes)
   that would be unnecessary overhead — and potentially confusing — under
   the global jsdom environment.
2. Changed `import { test } from 'node:test'` to
   `import { test } from 'vitest'`. Vitest's `test()` API is signature-
   compatible with `node:test`'s — same `(name, fn)` shape — so no
   call-site changes are needed across the file's 20 test blocks.

Kept `import assert from 'node:assert/strict'` unchanged. Vitest is
assertion-library-agnostic and `node:assert` works fine inside vitest
tests; rewriting to vitest's `expect()` would be ~60+ assertion-site
changes for zero functional benefit.

Added one script to `package.json`:
- `"test:agentic": "vitest run .claude/scripts"` — filters vitest's
  default glob to just the substrate test surface. Useful for focused
  substrate development without the overhead of running app tests too.

The canonical `npm test` (= `vitest run`) now naturally picks up both
surfaces because vitest's default include glob
(`**/*.{test,spec}.?(c|m)[jt]s?(x)`) already covers `.claude/scripts/`.
No `vitest.config.ts` changes were needed.

## Scope

- `.claude/scripts/trout/autosave.test.ts` (3 lines: env annotation +
  import swap)
- `package.json` (1 line: `test:agentic` script added)
- `package-lock.json` (already reconciled by `npm install` post-rebase;
  no further changes from this checkin)

Out of scope (intentionally not touched):
- `.claude/scripts/trout/autosave.ts` (no changes — it's the subject
  under test)
- `vitest.config.ts` (no changes — defaults work)
- The 20 assertion sites in the test file (no migration to `expect()`)

## Changes since previous checkin

Branch was rebased on `origin/main`. The rebase brought in main's
substrate work (PR #10: `.claude/scripts/trout/autosave.ts` +
`autosave.test.ts` + the supporting skill rewrites) and main's PR-body
convention update (PR #12: required `[!NOTE]` substrate-orientation
callout in PR body, multi-checkin marker support).

The `package.json` conflict (main's `node:test` script vs. our vitest
script) was resolved in favor of vitest at rebase time. This checkin
restores the substrate test coverage that the resolution implicitly
dropped, by porting the test file to vitest and adding `test:agentic`
as a focused filter.

## Evaluator verdict
approved — 3-line conversion (env annotation + import swap), no
substrate behavior changes, no vitest config drift. Both `npm test`
(2 files / 23 tests) and `npm run test:agentic` (1 file / 20 tests)
pass. `correction:` prefix present in PR notes per substrate
convention.

## Notes for the PR

correction: Mid-PR scope expansion — main moved while we were working
on Phase 1 and introduced its own `node:test`-based substrate test
harness. Rather than running two test harnesses indefinitely, this PR
now also consolidates the substrate tests under vitest (one harness for
both surfaces). `npm test` runs both; `test:agentic` filters to just
the substrate. This is still infra work (one harness instead of two),
not coverage expansion.

The substrate test file passes unchanged under vitest because vitest's
`test()` API is signature-compatible with `node:test`'s — the only
edits needed were the import swap and a `// @vitest-environment node`
annotation at the top.
