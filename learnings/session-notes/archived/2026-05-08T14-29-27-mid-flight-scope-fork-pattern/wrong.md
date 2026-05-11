# What Claude produced

Two commits' worth of work in this checkin, in this order:

1. **Port substrate tests from `node:test` to `vitest`** (precursor).
   The 22-commit fast-forward from main while we were on the merged
   Phase 3 branch brought in three new substrate tests written
   against `node:test`:
   - `.claude/scripts/griot/capture.test.ts`
   - `.claude/scripts/guild/parse-and-aggregate.test.ts`
   - `.claude/scripts/trout/autoload.test.ts`

   Vitest doesn't recognize `node:test` test functions as suites —
   `npm run test:agentic` reported "No test suite found" on each.
   Same root cause Phase 1 D3 already addressed (PR #10's autosave
   test): swap the `import { test }` source from `'node:test'` to
   `'vitest'`. One-line change per file. All other imports
   (`node:assert/strict`, `node:fs`, `node:os`, `node:path`,
   `node:child_process`) are vitest-compatible and stay as-is.

2. **Author `.github/workflows/ci.yml`** (the actual deliverable).
   Single workflow, one job named `ci`, `strategy.matrix.task` of
   `[lint, build, vitest, e2e]`, `fail-fast: false`. Common setup
   (checkout → setup-node@v4 with `node-version: '24'` and `cache:
   'npm'` → `npm ci`) followed by task-specific run steps gated by
   `if: matrix.task == '...'`. Concurrency block keyed on
   `github.ref` cancels superseded runs. Job name surfaces as
   `${{ matrix.task }}` so the GH UI shows `ci / lint`, `ci /
   build`, `ci / vitest`, `ci / e2e` — directly answering the
   "matrix to understand performance" goal.

   Vitest task runs `npm test` and `npm run test:agentic` as
   separate visible steps. E2E task runs three separate visible
   steps: `npx playwright install --with-deps chromium` (per the
   `project_linux_golden_image` learning — GH Actions runners are
   not the golden image), `npm run build-storybook` (so the
   storybook spec can read `storybook-static/index.json` at module
   load), then `npx playwright test`. Playwright auto-starts both
   webServers via `playwright.config.ts`. Artifact upload runs only
   on e2e job failure with `if-no-files-found: ignore` to handle
   the empty `playwright-report/` directory gracefully (the
   project uses Playwright's `'list'` reporter, not `'html'`).

Verification (local mirror of CI matrix):

- `npm run lint` → 2 pre-existing symlink warnings, otherwise clean
- `npm run build` → 55 SSG routes, clean
- `npm test` → 6 files, 79 tests passing (2 application files / 4
  tests + 4 substrate files / 75 tests, all picked up by vitest's
  default include glob)
- `npm run test:agentic` → 4 substrate files, 75 tests passing
  (autosave + capture + parse-and-aggregate + autoload)
- `npm run build-storybook` → 1 story built, clean
- `npx playwright test` (after build-storybook) → 2 tests passing
  in 3.9s (route smoke + Stack screenshot baseline matched)

One flaky run of `npm run test:agentic` was observed (1 test
failure that didn't reproduce on retry). Likely a temp-dir
filesystem race in one of the ported substrate tests. Worth
flagging for later but not a Phase 4 blocker — substrate tests
are not Phase 4's surface.
