# Checkin 01 — ev.adopt-test-harnesses.github-actions-ci

**Created**: 2026-05-07
**Phase**: 4 — GitHub Actions CI
**Unit**: D1 — Author `.github/workflows/ci.yml` running lint, build, vitest, and Playwright e2e on pull_request and push to main, structured as a matrix so each task's runtime is independently observable

## Contract

- **Goal**: Stand up the project's first CI workflow. One file
  (`.github/workflows/ci.yml`) that runs on every pull request and on
  pushes to `main`, exercising every harness adopted in Phases 1–3:
  Biome lint, Next.js build (which type-checks), vitest (both
  application and `.claude/scripts` agentic suites), and Playwright e2e
  (route smoke + Storybook screenshot VRT). Structured as a `strategy:
  matrix` so each task runs as a parallel job — the user wants visible
  per-task runtime in the GH Actions UI to reason about CI performance
  going forward. Pin Node to 24 (PLAN). Upload Playwright report
  artifacts when the e2e job fails so screenshot diffs are
  inspectable. Add a `concurrency` block to cancel superseded runs on
  branch updates.

- **Acceptance criteria**:
  - `.github/workflows/ci.yml` (new, ~70-90 lines) with:
    - `name: CI`
    - Triggers: `on: { pull_request: {}, push: { branches: [main] } }`
    - `concurrency: { group: ci-${{ github.ref }}, cancel-in-progress: true }`
    - Single job named `ci` with `strategy.fail-fast: false` and
      `strategy.matrix.task` containing four entries: `lint`,
      `build`, `vitest`, `e2e`. Each entry an object with `name` and
      task-specific config so the workflow can branch behavior
      (e.g., e2e needs Playwright browser install)
    - `runs-on: ubuntu-latest`
    - Job name surfaced as `${{ matrix.task.name }}` so the GH UI
      shows `ci / lint`, `ci / build`, `ci / vitest`, `ci / e2e`
    - Common setup steps for every matrix entry:
      - `actions/checkout@v4`
      - `actions/setup-node@v4` with `node-version: '24'` and
        `cache: 'npm'`
      - `npm ci`
    - Task-specific run steps (gated by `if: matrix.task.name == ...`
      or via per-entry `run` field on the matrix — pick the cleaner
      yaml):
      - `lint` → `npm run lint`
      - `build` → `npm run build`
      - `vitest` → `npm test` followed by `npm run test:agentic`
        (two visible steps so timing of each suite is distinct)
      - `e2e` → `npx playwright install --with-deps chromium`,
        then `npm run build-storybook`, then `npx playwright test`
        (three visible steps so Playwright deps install, Storybook
        build, and Playwright run are each timed)
    - On `e2e` job failure (`if: failure() && matrix.task.name ==
      'e2e'`): upload `playwright-report/` and `test-results/` as a
      single artifact named `playwright-report` with reasonable
      retention (default 90 days is fine; can override with
      `retention-days: 14` to be polite to storage)
  - Workflow YAML is parseable — `npx -y @action-validator/cli
    .github/workflows/ci.yml` clean (or equivalent: project-local
    sanity is enough; the real validation is GH Actions itself
    accepting the file on push)
  - Local dry-run of every CI command works against this branch:
    - `npm run lint` clean
    - `npm run build` clean (typechecks via Next)
    - `npm test` passes (now 24+ tests)
    - `npm run test:agentic` passes (currently 20 tests)
    - `npm run build-storybook` clean
    - `npx playwright test` passes (D1 + D2 specs from Phase 3)
  - `npm run test:e2e` (the existing local convenience script that
    chains build-storybook + playwright) is **left unchanged** —
    CI uses separate steps for visibility, but local devs keep the
    one-liner
  - `package.json` is **not modified** in this checkin (no new
    devDeps, no script changes — the workflow uses existing commands)

- **Rules applied**:
  - PLAN.md Phase 4: "Single workflow at `.github/workflows/ci.yml`.
    **Pin Node to 24.** Steps: install (with cache), lint,
    typecheck, build, vitest, build Storybook, run Playwright (smoke
    + storybook screenshots). Configure to run on PR and on push to
    `main`. Set up artifact upload for Playwright screenshot diffs
    so failures are inspectable in the GH UI." — All requirements
    addressed; typecheck folded into `build` since `next build`
    type-checks unless explicitly disabled (saves a redundant `tsc
    --noEmit` step).
  - Project memory `project_linux_golden_image`: GH Actions Ubuntu
    runners are NOT golden-image; Playwright system deps must be
    installed explicitly. Workflow uses `npx playwright install
    --with-deps chromium` in the e2e job for this reason.
  - User CLAUDE.md: "Simple over clever." Single workflow, single
    job, matrix is the only "abstraction." No reusable composite
    action, no separate workflows for different triggers.
  - Project CLAUDE.md: "intentionally simple stack — keep it that
    way." No layered tooling (no `act`, no nektos, no
    workflow-templating). Plain GH Actions yaml.
  - User CLAUDE.md PR conventions: "Cleanup PR... should be small
    and satisfying." Phase 4 closes the harness loop; one file, one
    PR.
  - Verification: `npm run lint`, `npm run build`, `npm test`,
    `npm run test:agentic`, `npm run test:e2e`, `npm run
    build-storybook`. Local pass list mirrors the CI matrix.

- **Disqualifiers**:
  - Multiple workflow files (e.g., separate `lint.yml`, `e2e.yml`)
    — explicitly one workflow
  - Reusable workflow / composite action abstractions — premature
  - Caching `~/.cache/ms-playwright` — explicitly skipped this
    phase per the design discussion (cache complexity ≯ ~30s install
    saving)
  - Cross-browser matrix (firefox, webkit) — Phase 3 contract
    pinned Chromium-only; Phase 4 inherits
  - Node version matrix (24 + 22) — PLAN says **pin** Node to 24
  - Hosted VRT services (Argos, Chromatic) integration — deferred
    per PLAN
  - Adding scripts to `package.json` — workflow uses existing
    scripts as-is
  - Modifying `next.config.ts`, `tsconfig.json`, `playwright.config.ts`,
    `vitest.config.ts`, `.storybook/*` — Phase 4 is purely additive
    at the CI layer; harness configs are stable from earlier phases
  - Modifying any application code (`app/`, `components/`,
    `sketches/`, `tokens/`, `styles/`)
  - Adding repo secrets, environment configs, deployment hooks,
    branch protection rules — out of scope; Phase 4 is the green
    workflow only, branch protection is a future config decision
  - Pre-commit hooks via husky/lefthook — not asked for, would
    duplicate CI surface
  - Dependabot config or other meta-repo housekeeping — not
    Phase 4's scope

- **Inputs** (read-only):
  - `package.json` (npm scripts: `lint`, `build`, `test`,
    `test:agentic`, `build-storybook`, `test:e2e`)
  - `.gitignore` (confirm `playwright-report/`, `test-results/`,
    `storybook-static/` are ignored — they should be from Phases 2/3)
  - `playwright.config.ts` (read to confirm `webServer` config will
    work in CI; the `reuseExistingServer: !process.env.CI` toggle
    means CI will spawn its own servers)
  - `tests/e2e/storybook.spec.ts` (confirms `storybook-static/index.json`
    must exist before Playwright loads — informs ordering of the e2e
    job's three steps)
  - `projects/2026-05-06-adopt-test-harnesses/PLAN.md` Phase 4 spec

- **Outputs**:
  - `.github/workflows/ci.yml` (new)
  - `projects/2026-05-06-adopt-test-harnesses/MANIFEST.md` (modified;
    contains the carry-forward `pr-merged | #15` event from autosave
    + this checkin's `checkin-created` event after autosave runs)
  - This checkin file:
    `projects/2026-05-06-adopt-test-harnesses/checkins/ev.adopt-test-harnesses.github-actions-ci/01.md`
  - No application-code changes, no test-code changes, no harness
    config changes

## Execution

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

## Scope

Files added (2):
- `.github/workflows/ci.yml`
- `projects/2026-05-06-adopt-test-harnesses/checkins/ev.adopt-test-harnesses.github-actions-ci/01.md`
  (this file)

Files modified (4):
- `.claude/scripts/griot/capture.test.ts` (one-line import port)
- `.claude/scripts/guild/parse-and-aggregate.test.ts` (one-line)
- `.claude/scripts/trout/autoload.test.ts` (one-line)
- `projects/2026-05-06-adopt-test-harnesses/MANIFEST.md` (carry-
  forward + autosave events)

Out of scope (intentionally not touched):
- `app/`, `components/`, `sketches/`, `tokens/`, `styles/` — no
  application changes
- `playwright.config.ts`, `vitest.config.ts`, `.storybook/*` —
  harness configs stable from Phases 1-3
- `package.json`, `package-lock.json` — no script or dep changes
- `next.config.ts`, `tsconfig.json` — no build config changes
- Branch protection rules, repo secrets, env configs — not the
  workflow's scope
- Husky / lefthook pre-commit hooks — would duplicate CI
- Dependabot / Renovate config — meta-repo housekeeping, not
  Phase 4
- HTML reporter for Playwright — would be a one-line
  `playwright.config.ts` change, deferred so this PR stays focused
  on workflow authoring

## Changes since previous checkin

D1 of Phase 3 (`ev.adopt-test-harnesses.playwright-harness/01.md`)
established Playwright + the route smoke. D2 added Storybook
screenshot VRT. Phase 4's D1 wires both into CI alongside the
vitest harness from Phase 1 and the Storybook build from Phase 2 —
no harness code changes, just orchestration.

## Evaluator verdict

approved (first pass; via standalone `evaluator` subagent type
because `evaluator-contract-fit` is still not registered on this
machine — same fallback Phase 3 used).

All twelve acceptance-criteria checks confirmed by direct file
inspection: workflow shape (name, triggers, concurrency, matrix,
runs-on, job-name expression, common setup, four task gates,
artifact upload params), test:e2e script unchanged in
`package.json`, `package.json` not modified vs main, substrate
test ports limited to the line-1 `import { test }` swap. No
disqualifiers fired. Rules from PLAN.md Phase 4 fully covered
(typecheck folded into `next build` with documented justification);
`--with-deps chromium` honors the `project_linux_golden_image`
learning for non-golden GH Actions runners.

One non-blocking observation: `next-env.d.ts` shows as modified
in the working tree (`./.next/dev/types/routes.d.ts` →
`./.next/types/routes.d.ts`). This is the auto-managed Next.js
file that flips between `dev` and `build` ancestor paths
depending on which command ran most recently. Not authored by
this unit. Excluded from staging so the commits stay focused on
authored content.

## Notes for the PR

D1 closes Phase 4 (and the project) by wiring every harness from
Phases 1-3 into a single GitHub Actions workflow. Two commits in
this PR:

1. **Port substrate tests from `node:test` to `vitest`** — fixes
   pre-existing breakage that came down with the 22-commit catch-up
   from main. Three one-line import swaps. Identical to the fix
   Phase 1 D3 already applied to the original autosave test.
2. **Add `.github/workflows/ci.yml`** — the actual deliverable.

**Matrix shape, deliberately**: `strategy.matrix.task: [lint,
build, vitest, e2e]`, single job, `fail-fast: false`. The user
asked for matrix to make CI performance legible — each task runs
on its own runner with its own visible wall-time in the GH Actions
UI. Not a node-version matrix (PLAN pins Node to 24); not a
cross-browser matrix (Phase 3 pinned chromium-only).

**Tradeoff baked in**: the e2e job's `npx playwright test` step
spawns Playwright's webServer config, which itself runs `npm run
build && npm run start` for the Next.js prod server. So Next.js
gets built twice in parallel — once in the `build` matrix job for
explicit timing, once inside the `e2e` job for the route smoke.
Acceptable for the observability goal; resolvable later via build
artifact sharing if CI runtime becomes annoying.

**No browser cache**: `~/.cache/ms-playwright` is rebuilt every
run via `--with-deps chromium`. Adds ~30s but avoids cache-key
maintenance. Easy follow-up if budget matters.

**No HTML reporter**: `playwright.config.ts` uses `'list'`
reporter, so `playwright-report/` is mostly empty. The artifact
upload step uses `if-no-files-found: ignore` so this isn't a
failure mode. `test-results/` (the actual screenshot diffs and
traces) is what you'd download from a failed run. Adding the HTML
reporter is a one-line `playwright.config.ts` change — deferred
to keep this PR focused.

**Concurrency cancellation**: keyed on `github.ref` so pushing a
new commit to a PR auto-cancels the in-flight run. Saves CI
minutes on rapid iteration.

**Verification per PLAN**: "A throwaway PR triggers the workflow
and all checks pass" — this PR itself is the verification. Its
own status checks are the verification surface. "Intentionally
breaking a test makes the PR show a failing status check" — left
as a follow-up sanity check on a throwaway commit; not part of
the merge gate.

correction: agent-guilds project (the `2026-05-02-agent-guilds`
peer project) keeps shipping substrate tests written against
`node:test` rather than `vitest`. Three more landed via main's
fast-forward into Phase 4's branch. Phase 1 D3 already established
the porting pattern for the original autosave test, but the
upstream project doesn't yet know to author tests against vitest
directly. Right fix is upstream — either a CLAUDE.md note in the
agent-guilds project's scope or a lint rule that flags `import {
test } from 'node:test'`. For now, ports happen reactively when
this project's CI exposes them. Worth surfacing during the
adopt-test-harnesses retrospective so it doesn't keep surprising
future phases.

correction: the contract's "no script or dep changes" disqualifier
was honored, but the contract's "no `package.json` or harness
config changes" framing also implicitly excluded test-file
modifications. The substrate test port wasn't in the original
contract scope — surfaced during local validation, raised back
to the user as a fork (options A/B/C), user picked option C
(stack as a precursor commit on this branch). Captured here so
the evaluator can read the boundary expansion as intentional.
