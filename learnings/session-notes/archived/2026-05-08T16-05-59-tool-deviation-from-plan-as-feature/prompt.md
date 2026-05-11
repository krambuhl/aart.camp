# Triggering prompt (distilled)

## Unit

D2 — Auto-screenshot every Storybook story via Playwright + `storybook-static/index.json` iteration

## Goal

Wire up the second use case of the Playwright harness:
  visual regression screenshots for every Storybook story. Pure
  Playwright — no `@storybook/test-runner`, no `jest-image-snapshot`.
  The Playwright spec reads `storybook-static/index.json` (Storybook's
  build manifest), iterates entries of type `'story'`, navigates to
  each via `/iframe.html?id=<id>&viewMode=story` against a static
  Storybook server on `:6006`, and asserts `toHaveScreenshot()`. New
  stories added to `components/shared/*` in future phases will be
  picked up automatically — no test code changes required. Today's
  only story (Stack default) gets one committed baseline. Play-function
  execution and interaction testing are deferred (would be a future
  layer-on of `@storybook/test-runner` if needed).

- **Acceptance criteria**:
  - `tests/e2e/storybook.spec.ts` (new, ~25-35 lines):
    - Imports `storybook-static/index.json` (use static JSON import
      with import attribute if TypeScript permits, else
      `JSON.parse(readFileSync(...))` — pick whichever the project's
      TS config + Playwright's bundler accept; verify by running)
    - Iterates `Object.values(index.entries)`, filters `entry.type ===
      'story'`, emits one `test()` per story
    - Each test: `await page.goto('http://localhost:6006/iframe.html?id=' + entry.id + '&viewMode=story')`,
      then `await page.waitForLoadState('networkidle')` for safety,
      then `await expect(page).toHaveScreenshot(entry.id + '.png')`
    - The `entry.id` slug for Stack default is
      `shared-stack--default` (verified via `storybook-static/index.json`
      after `npm run build-storybook`)
  - `playwright.config.ts` updated: `webServer` becomes an array with
    two entries:
    - Existing Next.js entry (unchanged)
    - New Storybook entry: `command: 'npm run build-storybook && npx
      http-server storybook-static -p 6006 --silent'`,
      `url: 'http://localhost:6006'`, `reuseExistingServer:
      !process.env.CI`, `timeout: 180_000` (longer than Next.js because
      build-storybook + http-server cold start is slower)
  - `http-server` installed as a devDep (predictable, avoids `npx -y`
    surprise download on first run; small package, no transitive
    bloat). Or — if `npx -y http-server` is judged acceptable — skip
    the install and use `npx -y` in the webServer command. Preference:
    install as devDep.
  - `storybook-static/__screenshots__/` is NOT used; baselines live
    under `tests/e2e/__screenshots__/storybook.spec.ts/` per the
    `snapshotPathTemplate` set up in D1
  - Baseline file `tests/e2e/__screenshots__/storybook.spec.ts/shared-stack--default.png`
    committed to the repo (generated via
    `npx playwright test --update-snapshots` then committed)
  - `npm run test:e2e` runs both D1 (route smoke) and D2 (storybook
    screenshot) tests, all pass green
  - Re-running `npm run test:e2e` without `--update-snapshots` diffs
    cleanly against the committed baseline (proves determinism on this
    machine; CI determinism is Phase 4's concern, with the caveat
    that the GH Actions runner is also Linux x64/ARM64 matching this
    dev container)
  - `npm run lint` (Biome) clean — new spec + updated config conform
  - `npm run build` (Next.js) clean — `playwright.config.ts` and
    `tests/e2e/` excluded from page collection by convention
  - `npm test` (vitest) still passes (24 tests) — vitest's narrowed
    `include` continues to exclude the new `.spec.ts`
  - `npm run test:agentic` still passes (20 tests, unchanged)
  - `npm run build-storybook` still clean — no story changes

- **Rules applied**:
  - Project CLAUDE.md: simple, no over-engineering; intentionally
    simple stack — keep it that way. Reusing D1's Playwright +
    `toHaveScreenshot` infra rather than adding `@storybook/test-runner`
    + `jest-image-snapshot` honors this.
  - Project CLAUDE.md: don't over-engineer; speculative features. The
    `@storybook/test-runner` machinery's value is in features not
    needed today (play functions, story-aware setup); deferring it
    until that need is real follows the rule.
  - User CLAUDE.md: tests prove real user functionality. A committed
    screenshot baseline IS the user-facing rendering — exactly the
    "real" level of test for visual primitives.
  - PLAN.md: "Story screenshot — wire up `@storybook/test-runner`
    against the Stack story" — **deviation from PLAN's named tool**,
    pivoted to vanilla Playwright + Storybook index.json iteration to
    satisfy the underlying intent (per-story committed baselines, auto
    expansion as stories accumulate) with less tooling. Decision
    captured in checkin notes; future scaling toward play-function
    execution can layer in `@storybook/test-runner` then.
  - PLAN.md Risks: "Storybook test-runner determinism — animations,
    fonts, or async rendering can cause flaky screenshots. Stack is
    static enough to avoid this in Phase 3." Use
    `waitForLoadState('networkidle')` before screenshot as a
    belt-and-suspenders for any future story that's borderline.
  - Verification: `npm run lint`, `npm run build`, `npm test`,
    `npm run test:agentic`, `npm run test:e2e`, `npm run build-storybook`

- **Disqualifiers**:
  - Installing `@storybook/test-runner` — explicitly rejected this
    phase
  - Installing `jest-image-snapshot` or any Jest-flavored matcher
    package
  - Adding a `.storybook/test-runner.ts` file or any storybook
    test-runner config layer
  - Multiple screenshots per story (responsive viewports, dark mode,
    etc.) — one baseline per story per the spec's intent
  - Manually listing story IDs in the test file (auto-discovery via
    `index.json` is the requirement)
  - Modifying `Stack`, `Stack.module.css`, `Stack.stories.tsx`, or any
    other component/sketch (read-only)
  - Modifying `app/page.tsx` or D1's `index.spec.ts`
  - Adding test helpers, page objects, custom fixtures, or assertion
    abstractions — vanilla `test()` and `expect()` only
  - Setting up CI / GitHub Actions — Phase 4
  - Hosted VRT services (Argos, Chromatic) — explicitly deferred per
    PLAN

- **Inputs**:
  - `components/shared/Stack/Stack.stories.tsx` (read-only — to
    confirm the story id format Storybook generates)
  - `storybook-static/index.json` (generated by `npm run
    build-storybook`; will exist locally after first build, used by
    the spec at runtime)
  - `playwright.config.ts` (modify — webServer becomes array)
  - `package.json` (modify — add `http-server` devDep)
  - `package-lock.json` (regenerated)
  - `tests/e2e/index.spec.ts` (read-only — D1's deliverable, unchanged)

- **Outputs**:
  - `tests/e2e/storybook.spec.ts` (new)
  - `tests/e2e/__screenshots__/storybook.spec.ts/shared-stack--default.png`
    (new — committed baseline)
  - `playwright.config.ts` (modified)
  - `package.json` (modified — http-server devDep + nothing else)
  - `package-lock.json` (modified)
  - No application-code changes

## Acceptance criteria

- `tests/e2e/storybook.spec.ts` (new, ~25-35 lines):
    - Imports `storybook-static/index.json` (use static JSON import
      with import attribute if TypeScript permits, else
      `JSON.parse(readFileSync(...))` — pick whichever the project's
      TS config + Playwright's bundler accept; verify by running)
    - Iterates `Object.values(index.entries)`, filters `entry.type ===
      'story'`, emits one `test()` per story
    - Each test: `await page.goto('http://localhost:6006/iframe.html?id=' + entry.id + '&viewMode=story')`,
      then `await page.waitForLoadState('networkidle')` for safety,
      then `await expect(page).toHaveScreenshot(entry.id + '.png')`
    - The `entry.id` slug for Stack default is
      `shared-stack--default` (verified via `storybook-static/index.json`
      after `npm run build-storybook`)
  - `playwright.config.ts` updated: `webServer` becomes an array with
    two entries:
    - Existing Next.js entry (unchanged)
    - New Storybook entry: `command: 'npm run build-storybook && npx
      http-server storybook-static -p 6006 --silent'`,
      `url: 'http://localhost:6006'`, `reuseExistingServer:
      !process.env.CI`, `timeout: 180_000` (longer than Next.js because
      build-storybook + http-server cold start is slower)
  - `http-server` installed as a devDep (predictable, avoids `npx -y`
    surprise download on first run; small package, no transitive
    bloat). Or — if `npx -y http-server` is judged acceptable — skip
    the install and use `npx -y` in the webServer command. Preference:
    install as devDep.
  - `storybook-static/__screenshots__/` is NOT used; baselines live
    under `tests/e2e/__screenshots__/storybook.spec.ts/` per the
    `snapshotPathTemplate` set up in D1
  - Baseline file `tests/e2e/__screenshots__/storybook.spec.ts/shared-stack--default.png`
    committed to the repo (generated via
    `npx playwright test --update-snapshots` then committed)
  - `npm run test:e2e` runs both D1 (route smoke) and D2 (storybook
    screenshot) tests, all pass green
  - Re-running `npm run test:e2e` without `--update-snapshots` diffs
    cleanly against the committed baseline (proves determinism on this
    machine; CI determinism is Phase 4's concern, with the caveat
    that the GH Actions runner is also Linux x64/ARM64 matching this
    dev container)
  - `npm run lint` (Biome) clean — new spec + updated config conform
  - `npm run build` (Next.js) clean — `playwright.config.ts` and
    `tests/e2e/` excluded from page collection by convention
  - `npm test` (vitest) still passes (24 tests) — vitest's narrowed
    `include` continues to exclude the new `.spec.ts`
  - `npm run test:agentic` still passes (20 tests, unchanged)
  - `npm run build-storybook` still clean — no story changes

- **Rules applied**:
  - Project CLAUDE.md: simple, no over-engineering; intentionally
    simple stack — keep it that way. Reusing D1's Playwright +
    `toHaveScreenshot` infra rather than adding `@storybook/test-runner`
    + `jest-image-snapshot` honors this.
  - Project CLAUDE.md: don't over-engineer; speculative features. The
    `@storybook/test-runner` machinery's value is in features not
    needed today (play functions, story-aware setup); deferring it
    until that need is real follows the rule.
  - User CLAUDE.md: tests prove real user functionality. A committed
    screenshot baseline IS the user-facing rendering — exactly the
    "real" level of test for visual primitives.
  - PLAN.md: "Story screenshot — wire up `@storybook/test-runner`
    against the Stack story" — **deviation from PLAN's named tool**,
    pivoted to vanilla Playwright + Storybook index.json iteration to
    satisfy the underlying intent (per-story committed baselines, auto
    expansion as stories accumulate) with less tooling. Decision
    captured in checkin notes; future scaling toward play-function
    execution can layer in `@storybook/test-runner` then.
  - PLAN.md Risks: "Storybook test-runner determinism — animations,
    fonts, or async rendering can cause flaky screenshots. Stack is
    static enough to avoid this in Phase 3." Use
    `waitForLoadState('networkidle')` before screenshot as a
    belt-and-suspenders for any future story that's borderline.
  - Verification: `npm run lint`, `npm run build`, `npm test`,
    `npm run test:agentic`, `npm run test:e2e`, `npm run build-storybook`

- **Disqualifiers**:
  - Installing `@storybook/test-runner` — explicitly rejected this
    phase
  - Installing `jest-image-snapshot` or any Jest-flavored matcher
    package
  - Adding a `.storybook/test-runner.ts` file or any storybook
    test-runner config layer
  - Multiple screenshots per story (responsive viewports, dark mode,
    etc.) — one baseline per story per the spec's intent
  - Manually listing story IDs in the test file (auto-discovery via
    `index.json` is the requirement)
  - Modifying `Stack`, `Stack.module.css`, `Stack.stories.tsx`, or any
    other component/sketch (read-only)
  - Modifying `app/page.tsx` or D1's `index.spec.ts`
  - Adding test helpers, page objects, custom fixtures, or assertion
    abstractions — vanilla `test()` and `expect()` only
  - Setting up CI / GitHub Actions — Phase 4
  - Hosted VRT services (Argos, Chromatic) — explicitly deferred per
    PLAN

- **Inputs**:
  - `components/shared/Stack/Stack.stories.tsx` (read-only — to
    confirm the story id format Storybook generates)
  - `storybook-static/index.json` (generated by `npm run
    build-storybook`; will exist locally after first build, used by
    the spec at runtime)
  - `playwright.config.ts` (modify — webServer becomes array)
  - `package.json` (modify — add `http-server` devDep)
  - `package-lock.json` (regenerated)
  - `tests/e2e/index.spec.ts` (read-only — D1's deliverable, unchanged)

- **Outputs**:
  - `tests/e2e/storybook.spec.ts` (new)
  - `tests/e2e/__screenshots__/storybook.spec.ts/shared-stack--default.png`
    (new — committed baseline)
  - `playwright.config.ts` (modified)
  - `package.json` (modified — http-server devDep + nothing else)
  - `package-lock.json` (modified)
  - No application-code changes
