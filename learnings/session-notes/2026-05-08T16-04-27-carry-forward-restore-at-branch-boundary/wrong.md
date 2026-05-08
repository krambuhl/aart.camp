# What Claude produced

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
