# Checkin 02 — ev.adopt-test-harnesses.playwright-harness

**Created**: 2026-05-07
**Phase**: 3 — Playwright harness
**Unit**: D2 — Auto-screenshot every Storybook story via Playwright + `storybook-static/index.json` iteration

## Contract

- **Goal**: Wire up the second use case of the Playwright harness:
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

## Execution

Three file changes plus one new dev dep, plus one committed baseline:

- Initially `npm install -D serve` for the static-build path.
  After the static-build pivot (see below), this dep was no longer
  needed and was removed via `npm uninstall serve`. Net result:
  no new dev dependencies introduced by D2 — the harness extends
  with config and test code only.

- `playwright.config.ts`: `webServer` flipped from object to array.
  Original Next.js entry preserved unchanged; new Storybook entry
  runs `npm run storybook -- --no-open --quiet` against
  `http://localhost:6006` with `reuseExistingServer: !process.env.CI`
  and `timeout: 120_000`. **First attempted** static serve via
  `npx serve storybook-static -l 6006`, but the iframe rendered
  Storybook's "No Preview" panel — Storybook v10 + `nextjs-vite`
  framework's static iframe code fetched `index.json` but never
  loaded the story chunk (`Stack.stories-B06IDbFs.js`) for reasons
  not investigated further. The dev server (validated in Phase 2)
  renders stories correctly. Pivoted to dev server for
  deliverable. Static-build path is debuggable in a future phase if
  CI runtime becomes a concern; for now, dev server is acceptable
  since the determinism risk is bounded by the same static-content
  Stack story PLAN flagged.

- `package.json` `test:e2e`: changed from `playwright test` to
  `npm run build-storybook && playwright test`. The chain is required
  because the spec reads `storybook-static/index.json` at module load
  for test discovery (Playwright loads spec files before starting the
  webServer, so the static build must already exist). Devs iterating
  on the route smoke alone can bypass with
  `npx playwright test tests/e2e/index.spec.ts` to skip the storybook
  rebuild.

- `tests/e2e/storybook.spec.ts` (24 lines): reads
  `storybook-static/index.json` synchronously via `fs.readFileSync`
  (NOT a static `import index from '...json'` — keeps TypeScript out
  of the gitignored-file-must-exist-at-typecheck-time bind). Casts to
  a typed `StorybookIndex` shape (entries record). Iterates entries,
  filters `entry.type === 'story'`, emits one `test()` per story.
  Each test navigates to
  `http://localhost:6006/iframe.html?id=<id>&viewMode=story`, awaits
  `networkidle`, asserts `toHaveScreenshot('<id>.png')`. Uses
  vanilla `test()` and `expect()` — no helpers, no fixtures.

- `tests/e2e/__screenshots__/storybook.spec.ts/shared-stack--default.png`
  (new, 18.7KB): captured via
  `npx playwright test --update-snapshots`, then verified by
  re-running `npx playwright test` (no flag) and confirming the
  baseline matched. Stored under the path dictated by D1's
  `snapshotPathTemplate`.

Verification:

- `storybook-static/index.json` after build contains exactly one
  story entry: `shared-stack--default` (verified with a Python json
  parse). Confirms the auto-discovery surface today, and the loop
  shape that future stories will land on.
- `npm test` → 3 files, 24 tests pass (no regression from the new
  spec — vitest's narrowed `include` excludes `*.spec.ts`)
- `npm run test:agentic` → 20 tests pass (substrate unchanged)
- `npm run lint` → 2 pre-existing symlink warnings, no D2-related
  issues
- `npm run build` → clean, 55 SSG routes prerendered
- `npm run build-storybook` → clean
- `npm run test:e2e` → 2 tests pass in 2.1s after build chain (D1
  route smoke + D2 stack screenshot). Storybook on `:6006` and
  Next.js on `:3000` both reused the user's existing servers via
  `reuseExistingServer: !process.env.CI`.
- Re-run determinism: `npx playwright test` (no
  `--update-snapshots`) passes against the committed baseline,
  proving on-machine determinism. CI determinism is Phase 4's
  concern, with the favorable note that the GH Actions runner is
  also Linux matching this dev container's OS / arch.

## Scope

Files added (3):
- `tests/e2e/storybook.spec.ts`
- `tests/e2e/__screenshots__/storybook.spec.ts/shared-stack--default.png`
  (committed baseline)
- `projects/2026-05-06-adopt-test-harnesses/checkins/ev.adopt-test-harnesses.playwright-harness/02.md`
  (this file)

Files modified (5):
- `playwright.config.ts` (webServer: object → array; storybook
  entry uses dev server)
- `package.json` (test:e2e chains build-storybook; no net devDep
  changes after the serve add/remove cycle)
- `package-lock.json` (regenerated by the install/uninstall cycle —
  may show small noise relative to main)
- `.gitignore` (added `.claude/settings.local.json` — per-machine
  Claude Code local state, was creating constant churn between
  branches; matches Claude Code convention. `git rm --cached`
  also run to untrack the existing file. Local file remains on
  disk for the user.)
- `projects/2026-05-06-adopt-test-harnesses/MANIFEST.md` (carry-
  forward and per-checkin events from autosave; not D2 work)

Files deleted from tracking (1):
- `.claude/settings.local.json` (now gitignored; local file
  preserved on disk via `git rm --cached`)

Out of scope (intentionally not touched):
- `app/`, `components/`, `sketches/`, `tokens/`, `styles/` — no
  application-code changes
- `tests/e2e/index.spec.ts` — D1's route smoke unchanged
- `vitest.config.ts` — D1 already narrowed `include`
- `.gitignore` — D1 already added Playwright artifact paths;
  `tests/e2e/__screenshots__/` correctly NOT ignored (baselines
  committed per PLAN)
- `@storybook/test-runner`, `jest-image-snapshot`,
  `.storybook/test-runner.ts` — explicitly rejected for this phase
  per the contract
- CI workflow / GitHub Actions — Phase 4
- Hosted VRT services — deferred per PLAN

## Changes since previous checkin

D1 (01.md) installed Playwright + `playwright.config.ts` + the route
smoke test for `/`. D2 extends the harness with the second of PLAN's
two named tests: per-story screenshot VRT. No additional Playwright
features are introduced — this entirely reuses the harness D1 paid for.

## Evaluator verdict

approved (third pass; via standalone evaluator agent because the
panel skill's contract-fit name didn't match the available
`evaluator` subagent type on this machine).

First pass approved structurally but flagged that the baseline
image was Storybook's "No Preview" error panel rather than real
Stack rendering. Root cause: Storybook v10 + `nextjs-vite` static
iframe didn't load story chunks. Pivoted webServer from
`serve storybook-static` to `npm run storybook -- --no-open
--quiet` (dev server), captured fresh baseline showing three
placeholder boxes ("One", "Two", "Three"), re-verified
determinism. Second pass flagged on `.claude/settings.local.json`
showing modified in `git status` (testing-artifact race). Resolved
by gitignoring the file (Claude Code convention) and `git rm
--cached` to untrack. Third pass: all eight checks confirmed
against disk — config shape, dynamic iteration, no forbidden deps,
no `.storybook/test-runner.ts`, gitignore line present, baseline
shows real Stack rendering, debug spec cleaned up.

## Notes for the PR

D2 closes Phase 3 by adding the second of PLAN's two named tests:
per-story Storybook screenshot VRT.

**Tool deviation from PLAN, intentional**: PLAN named
`@storybook/test-runner` for this test. After discussion, we picked
vanilla Playwright + iteration over `storybook-static/index.json`
instead. Same delivered capability (auto-discovery of all stories,
per-story committed baseline, future stories pick up automatically),
but with: zero new test-runner deps, no `jest-image-snapshot`, no
`.storybook/test-runner.ts` config layer. Reuses D1's
`toHaveScreenshot` matcher infra. If interaction testing (story
`play` functions) becomes a need later, layering
`@storybook/test-runner` on top is a future-phase decision and
wouldn't unwind this work.

**Auto-discovery shape**: The spec reads
`storybook-static/index.json` synchronously and emits one Playwright
`test()` per entry of `type: 'story'` at module load time. Adding a
new `Foo.stories.tsx` to `components/shared/Foo/` will produce a
new story id at next `npm run build-storybook`, the test discovery
will pick it up, and on first `--update-snapshots` run a baseline
will be captured. No test code changes required as the story
catalog grows.

**Two webServer entries**: Next.js on `:3000` for D1's route smoke,
Storybook **dev** server on `:6006` for D2's screenshots. Both
honor `reuseExistingServer: !process.env.CI` for local iteration
speed. Dev server (rather than serving the static build) was
chosen after the static iframe failed to render stories — see
the static-build pivot note in the Execution section.

**`test:e2e` script chains `build-storybook`**: required because
the spec reads `storybook-static/index.json` at module load
(before webServer starts). The build is used purely for the
manifest file — actual rendering happens against the dev server.
A future optimization could generate just the manifest without
the full static build. Local devs iterating on a single route
smoke can bypass the storybook rebuild via `npx playwright test
tests/e2e/index.spec.ts`.

**Determinism caveat for Phase 4 / future stories**: PLAN's Risks
section flagged Storybook test-runner determinism. The Stack story
is a static layout primitive — animations, fonts, async behavior all
absent — so the baseline is stable. As stories accumulate, a
borderline-flaky one will need either a `play` function pause or a
custom timeout in the spec. The `waitForLoadState('networkidle')`
already in the spec is a belt-and-suspenders default.

correction: user redirected the tool choice from PLAN's literal
`@storybook/test-runner` to vanilla Playwright + index.json
iteration, with rationale: scope ("simple over clever",
"intentionally simple stack"), and that interaction testing via
play functions is a deferred goal. Future phases can revisit if
that goal materializes.

correction: `.claude/settings.local.json` was tracked in git but
churning constantly across branches (testing artifacts +
machine-specific permission allowlists with foreign paths like
`/Users/ekrambuhl/...`). User correctly identified it should be
gitignored — that's Claude Code convention for `*.local.json`
files. Folded into D2 because the evaluator race condition (file
dirties during checks, gets flagged) was blocking the gate.
`.gitignore` extended; `git rm --cached` untracked the existing
file. Local file preserved on disk.

correction: initial baseline captured against `serve
storybook-static` was Storybook's "No Preview" error panel rather
than a rendered Stack component — evaluator caught the visual
content during a baseline image inspection that wasn't part of
the original verification list. Root cause: Storybook v10 +
`nextjs-vite` static iframe never loaded the story chunk despite
fetching `index.json` (network request log confirmed). Rather
than block on debugging the framework's static-build behavior,
pivoted webServer to the validated `npm run storybook` dev path,
captured a baseline showing actual Stack rendering (three
placeholder boxes), reverified determinism via re-run. Future
phase can revisit static-build determinism if dev-server
overhead in CI becomes a concern.
