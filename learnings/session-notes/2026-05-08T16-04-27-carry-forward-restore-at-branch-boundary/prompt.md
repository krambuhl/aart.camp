# Triggering prompt (distilled)

## Unit

D1 — Install + configure Playwright + route smoke test for `/`

## Goal

Install Playwright and ship the first end-to-end test against
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

## Acceptance criteria

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
