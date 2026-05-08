# Checkin 01 — ev.adopt-test-harnesses.playwright-harness

**Created**: 2026-05-07
**Phase**: 3 — Playwright harness
**Unit**: D1 — Install + configure Playwright + route smoke test for `/`

## Contract

- **Goal**: Install Playwright and ship the first end-to-end test against
  the running app: a route smoke for `/` (the sketch index) that verifies
  the page loads, has no console errors, and renders expected content.
  This deliverable proves the Playwright harness works against `next start`
  in the way Phase 4 CI will eventually drive it. Storybook screenshot VRT
  is D2's job; this one is route-only.

- **Acceptance criteria**:
  - `@playwright/test` installed as a dev dependency (current latest from
    npm registry)
  - Chromium browser binary installed locally via `npx playwright install
    chromium` (no other browsers — Firefox/WebKit deferred per PLAN until
    a real cross-browser bug appears)
  - `playwright.config.ts` at repo root with:
    - `testDir: './tests/e2e'`
    - One project: chromium-only, using `devices['Desktop Chrome']`
    - `webServer` block that runs `npm run build && npm run start`
      against `http://localhost:3000`, with
      `reuseExistingServer: !process.env.CI` and `timeout: 120_000`.
      Combining build + start in `webServer.command` makes
      `npm run test:e2e` work from cold without separate build steps,
      which is the right ergonomic for local iteration; CI is free to
      pre-build and reuse if it wants to avoid the double build.
    - Need `"start": "next start"` in `package.json` if not already
      present — verify and add if missing as part of this deliverable
      (small enough to roll in)
    - `snapshotPathTemplate: '{testDir}/__screenshots__/{testFilePath}/{arg}{ext}'`
      so baselines live under `tests/e2e/__screenshots__/` per PLAN
    - `forbidOnly: !!process.env.CI`
    - `fullyParallel: true`
    - `reporter: 'list'` (terse local output; CI reporter chosen in Phase 4)
  - `tests/e2e/index.spec.ts` (route smoke):
    - Single `test('index page loads cleanly', ...)`
    - Listens for `console.error` events and any uncaught page errors;
      asserts none fired during navigation + initial render
    - Asserts the page contains `aart.camp`-identifying content
      (use whatever PageHeader text is on `/` — verify by reading
      `app/page.tsx` first; do not invent)
    - Uses Playwright's auto-waiting (no manual `waitForTimeout`)
  - `package.json` script: `"test:e2e": "playwright test"` (no
    `--pass-with-no-tests` equivalent needed — D1 ships an actual test)
  - `package.json` has a `start` script (`next start`) — add if missing
  - `.gitignore` updated to exclude Playwright runtime artifacts:
    - `/playwright-report/`
    - `/test-results/`
    - `/blob-report/`
    - `/playwright/.cache/`
    - (do **not** ignore `tests/e2e/__screenshots__/` — baselines are
      committed per PLAN)
  - `npm run test:e2e` runs locally and the route smoke passes (1 test, 1
    pass)
  - `npm run lint` (Biome) clean — config + spec file conform
  - `npm run build` clean — `playwright.config.ts` and `tests/e2e/` are
    not picked up by Next.js page collection
  - **Naming convention split**: `.test.*` for vitest, `.spec.*` for
    Playwright. Narrow vitest's `include` to
    `**/*.test.?(c|m)[jt]s?(x)` (drops the default `.spec` half) so
    Playwright's `*.spec.ts` files never get pulled into vitest. This is
    a per-project convention worth keeping consistent going forward.
  - `npm test` (vitest) still passes after the include narrowing —
    existing tests use `.test.tsx` / `.test.ts` (verify with
    `git ls-files '*.test.*' '*.spec.*'`); if any existing files use
    `.spec.*`, rename them to `.test.*` as part of D1
  - `npm run test:agentic` still passes (substrate filter unchanged)
  - `npm run build-storybook` clean (Storybook's stories glob does not
    match `*.spec.ts`, but verify)

- **Rules applied**:
  - Project CLAUDE.md: simple, no over-engineering, basic. Default config
    over custom anywhere we can.
  - Project CLAUDE.md: stack is intentionally simple, keep it that way —
    no orchestration libraries, no test helpers, vanilla `@playwright/test`
  - PLAN.md: Chromium only; baselines committed; webServer uses `next
    start` (faster, more representative than `next dev`)
  - User CLAUDE.md: tests prove real user functionality, not rote
    fundamentals — route smoke checking "page loads + no console errors +
    expected content present" is the right level of "real" for a smoke
    screen
  - User CLAUDE.md: prefer Cypress when possible, but Playwright is the
    chosen tool for this project per PLAN
  - Verification: `npm run lint`, `npm run build`, `npm test`,
    `npm run test:agentic`, `npm run test:e2e`, `npm run build-storybook`

- **Disqualifiers**:
  - Configuring browsers other than Chromium (Firefox, WebKit, Edge) —
    PLAN says Chromium only until a cross-browser bug shows up
  - Adding the Storybook test-runner / `@storybook/test-runner` — that's
    D2's deliverable
  - Capturing or committing any screenshot baselines — D2's job
  - Adding multiple route tests (sketch routes, etc.) — out of scope per
    PLAN ("Sketch route smoke tests beyond the index page" is in the Out
    list)
  - Asserting on visual layout, computed styles, or pixel-perfect output
    in this test — that's VRT's job (D2)
  - Adding test helpers, page objects, custom fixtures, or any
    abstraction layer — vanilla `test()` and `expect()` only
  - Modifying any application code (`app/`, `components/`, `sketches/`,
    `tokens/`, `styles/`)
  - Setting up CI / GitHub Actions — that's Phase 4
  - Hosted VRT services (Argos, Chromatic) — explicitly deferred per PLAN
  - Adding a `--pass-with-no-tests` flag or no-op placeholder test — D1
    ships an actual test

- **Inputs**:
  - `app/page.tsx` (read-only — to identify the expected content the test
    should assert on)
  - `package.json` (modify — add `test:e2e` script, add devDep, possibly
    add `start` script if missing)
  - `package-lock.json` (regenerated by `npm install`)
  - `.gitignore` (modify — add Playwright artifact paths)
  - `vitest.config.ts` (read-only first; modify only if vitest collects
    `tests/e2e/*.spec.ts`)

- **Outputs**:
  - `playwright.config.ts` (new, ~25-35 lines)
  - `tests/e2e/index.spec.ts` (new, ~15-20 lines)
  - `package.json` (modified)
  - `package-lock.json` (modified)
  - `.gitignore` (modified)
  - Possibly `vitest.config.ts` (modified) if collision detected
  - No changes to any application code

## Execution

Six file changes plus one new dev dep:

- `npm install -D @playwright/test` → `^1.59.1`
- `npx playwright install chromium` → binaries land in
  `~/.cache/ms-playwright/chromium-1217`. First attempt failed host
  validation on this Linux container (15 missing system libraries —
  libnspr4, libnss3, libatk*, libcups2t64, libxkbcommon0, libasound2t64,
  libgbm1, libcairo2, libpango-1.0-0, libxcomposite1, libxdamage1,
  libxfixes3, libxrandr2, libatspi2.0-0t64). User ran
  `sudo npx playwright install-deps chromium` to resolve. **Phase 4 CI
  needs to handle this** — either the `microsoft/playwright-github-action`
  or `npx playwright install --with-deps chromium` as a workflow step.

- `playwright.config.ts` (25 lines): `testDir: './tests/e2e'`,
  chromium-only project, `webServer: { command: 'npm run build && npm
  run start', url: 'http://localhost:3000', reuseExistingServer:
  !process.env.CI, timeout: 120_000 }`, `snapshotPathTemplate` pointed
  at committed baselines, `baseURL` set so test files can use relative
  paths, `forbidOnly: !!process.env.CI`, `fullyParallel: true`,
  `reporter: 'list'`. No multi-browser config.

- `tests/e2e/index.spec.ts` (22 lines): single test that listens for
  `console` error events and `pageerror` (uncaught) events during
  navigation, then asserts `<h1>Sketches</h1>` is visible (verified
  against `app/page.tsx:20-22`) and both error arrays are empty. Uses
  Playwright's auto-waiting via `expect().toBeVisible()` — no manual
  `waitForTimeout`.

- `vitest.config.ts`: added `include: ['**/*.test.?(c|m)[jt]s?(x)']` to
  drop the default `.spec` half of vitest's glob. Locks in the
  convention: `.test.*` for vitest, `.spec.*` for Playwright. Existing
  test files (`autosave.test.ts`, `Stack.test.tsx`,
  `opaque-responsive.test.ts`) all already use `.test.*` — no renames
  needed.

- `package.json`: added `"test:e2e": "playwright test"`. `start` script
  was already present (`next start`). `@playwright/test` added to
  devDependencies by `npm install`.

- `.gitignore`: appended `/playwright-report/`, `/test-results/`,
  `/blob-report/`, `/playwright/.cache/` under a new `# playwright`
  section. Did not ignore `tests/e2e/__screenshots__/` — baselines are
  committed per PLAN.

Verification:

- `npm test` → 3 files, 24 tests pass (3 wrapResponsive + 1 Stack + 20
  substrate). Vitest's narrowed `include` did not regress collection.
- `npm run test:agentic` → 1 file, 20 tests pass (substrate filter
  unchanged).
- `npm run lint` → 2 pre-existing symlink warnings, no D1-related
  issues.
- `npm run build` → clean. SSG prerendered all 55 routes (1 static, 54
  sketch slugs).
- `npm run build-storybook` → clean. The Storybook Vite chunk-size
  warning is pre-existing noise from Phase 2, not D1.
- `npm run test:e2e` → 1 test passes in 662ms. The dev server already
  running on :3000 (PID 1760) was reused via `reuseExistingServer:
  !process.env.CI`, so the build+start path was not exercised on this
  run. CI (`process.env.CI=1`) will exercise the cold path; verifying
  that locally would require killing the user's dev session, which is
  out of scope.

## Scope

Files added (4):
- `playwright.config.ts`
- `tests/e2e/index.spec.ts`
- `projects/2026-05-06-adopt-test-harnesses/checkins/ev.adopt-test-harnesses.playwright-harness/01.md`
  (this file)

Files modified (4):
- `package.json` (test:e2e script + @playwright/test devDep)
- `package-lock.json` (regenerated by npm install)
- `.gitignore` (Playwright runtime artifact paths)
- `vitest.config.ts` (include narrowed to `.test.*`)
- `projects/2026-05-06-adopt-test-harnesses/MANIFEST.md` (PR #11 and
  #14 merge events recorded; current branch updated to main during
  ev-run pre-flight — this is carry-forward from /ev-run, not D1's
  work)

Out of scope (intentionally not touched):
- `app/`, `components/`, `sketches/`, `tokens/`, `styles/` — no
  application-code changes
- `tests/e2e/__screenshots__/` — baseline directory will be created by
  D2 when the first screenshot test runs
- Storybook test-runner / `@storybook/test-runner` — D2's deliverable
- CI / GitHub Actions workflow — Phase 4
- Multi-browser configuration — deferred per PLAN
- Test helpers, page objects, fixtures, custom test extensions —
  vanilla `test()` and `expect()` only

## Changes since previous checkin

This is the first checkin on the playwright-harness branch. Prior phase
(Storybook, PR #14) merged at 2026-05-07 04:00. Branch was created off
main at commit 5c11180.

## Evaluator verdict

approved (first pass via `/guild-validate` panel, single
evaluator: `evaluator-contract-fit`).

Evaluator verified each contract field against disk — `playwright.config.ts`
load-bearing fields (testDir, chromium project, webServer.command,
reuseExistingServer, timeout, snapshotPathTemplate, forbidOnly,
fullyParallel, reporter) match the contract verbatim; vitest's narrowed
include actually excludes `tests/e2e/index.spec.ts` (verified via
`npx vitest list`); console.error/pageerror listeners are registered
before `page.goto('/')`; the `Sketches` h1 assertion is grounded in
`app/page.tsx:20-22` rather than invented; `.gitignore` excludes
runtime artifacts but not the screenshot baseline directory; no
disqualifiers fired (no `@storybook/test-runner`, no screenshot
baselines, no app-code edits, no CI workflow, no
`--pass-with-no-tests`); and the carry-forward `next-env.d.ts` /
`.claude/settings.local.json` items are clean per `git status`.

## Notes for the PR

D1 stands up Playwright as the project's e2e testing harness and ships
the first end-to-end test against the running app. Single test, single
deliverable: load `/`, assert `<h1>Sketches</h1>` is visible, assert no
console errors and no uncaught page errors.

**Per-project naming convention locked in**: `.test.*` for vitest,
`.spec.*` for Playwright. Vitest's glob narrowed in `vitest.config.ts`;
Playwright's default `*.spec.*` matching stays untouched.

**Dual-mode `webServer`**: Locally, Playwright reuses an existing dev
server on `:3000` if one is running (faster iteration). When no server
is running — or when `process.env.CI` is set — it runs `npm run build
&& npm run start` and waits for the prod server. Phase 4 CI gets the
representative path PLAN's Risks section called out.

**System dep note for Phase 4**: Chromium needs 15 system libraries on
Linux that Playwright validates at install time. CI workflow will need
`npx playwright install --with-deps chromium` (or the
`microsoft/playwright-github-action`) to handle this — a vanilla
`npx playwright install chromium` will fail host validation on a fresh
GH Actions runner the same way it failed on this dev container.

correction: user instructed (during /ev-run pre-flight) to throw away
the carry-forward `next-env.d.ts` and `.claude/settings.local.json`
diffs that show up between branches as "testing artifacts." Future
loops should `git restore` these auto-regenerated files at branch
boundaries rather than carrying them forward.
