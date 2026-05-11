# Triggering prompt (distilled)

## Unit

D1 — Author `.github/workflows/ci.yml` running lint, build, vitest, and Playwright e2e on pull_request and push to main, structured as a matrix so each task's runtime is independently observable

## Goal

Stand up the project's first CI workflow. One file
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

## Acceptance criteria

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
