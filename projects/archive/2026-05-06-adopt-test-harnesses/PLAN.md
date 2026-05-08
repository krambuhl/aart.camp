# Adopt Test Harnesses

## Context

The repo has zero test infrastructure today — no vitest, no jest, no playwright,
no testing-library, nothing. There's also no CI; Vercel handles deploys but
nothing gates merges beyond Biome via local convention.

This project stands up the harnesses (vitest, Storybook, Playwright, GitHub
Actions) so the muscle memory and tooling are in place. Building actual test
coverage is **explicitly out of scope** — each phase ships with a single
example test that exercises the harness, and that's it. Coverage grows
organically as features land or in a future, separate effort.

## Scope

**In:**
- Vitest configured for this Next.js + tsx + CSS Modules setup
- Storybook with Next.js preset, configured to load tokens + CSS Modules
- Playwright for route smoke tests and Storybook screenshot VRT (via
  test-runner)
- GitHub Actions CI running everything as PR status checks
- One example test per harness as a smoke screen

**Out (deferred):**
- Broad component test coverage (`Stack`, `Grid`, `Card`, etc.)
- Stories for the rest of `components/shared/*`
- Sketch route smoke tests beyond the index page
- Sketch canvases as Storybook entries
- Visual regression on sketches themselves (determinism work)
- Hosted VRT services (Argos, Chromatic) — viable upgrade path if review
  friction shows up later
- Stylelint replacement, accessibility testing, perf testing

## Phases

### Phase 1: Vitest harness

Install vitest + RTL, configure for Next.js (tsx, path aliases, CSS Modules
mock), add `npm test` script. Write one test for `wrapResponsive` (or
equivalent — pick the smallest piece of real logic). PR ships when
`npm test` runs the example test green and the config is reusable for future
tests.

**Verification:** `npm test` passes; `npm run build` still works; Biome still
clean.

### Phase 2: Storybook harness

Install Storybook with the Next.js preset. Configure preview to load the
global token CSS so components render with the correct visual environment.
Write one story for `Stack` (foundational, visually simple). Add one
vitest + RTL test against Stack (proves the React testing harness works for
real components, not just pure utilities).

**Verification:** `npm run storybook` boots; the Stack story renders with
correct tokens applied; the vitest component test passes.

### Phase 3: Playwright harness

Install Playwright. Configure for **Chromium only** (cross-browser deferred
until a real cross-browser bug appears). Screenshot baselines are
**committed to the repo** under `tests/e2e/__screenshots__/` — matches the
"baselines as code" philosophy. Write two tests, each proving a different
use case:

1. **Route smoke** — `/` (the sketch index) loads with no console errors and
   the expected content is present.
2. **Story screenshot** — wire up `@storybook/test-runner` against the Stack
   story, capture and commit one baseline.

This is one PR because adopting Playwright once is the costly bit; using it
twice in the same PR is essentially free.

**Verification:** `npm run test:e2e` runs both tests green; the screenshot
baseline is committed; re-running locally diffs cleanly.

### Phase 4: GitHub Actions CI

Single workflow at `.github/workflows/ci.yml`. **Pin Node to 24.** Steps:
install (with cache), lint, typecheck, build, vitest, build Storybook, run
Playwright (smoke + storybook screenshots). Configure to run on PR and on
push to `main`. Set up artifact upload for Playwright screenshot diffs so
failures are inspectable in the GH UI.

**Verification:** A throwaway PR triggers the workflow and all checks pass;
intentionally breaking a test makes the PR show a failing status check;
screenshot diff artifacts are downloadable from the failed run.

## Dependencies

- Phase 3 requires Phase 2 merged (need a story to screenshot)
- Phase 4 requires Phases 1–3 merged (CI runs all of them)
- Phases 1 and 2 are independent — could ship in either order

## Verification

Per-phase verification commands above. Project-level: every phase leaves
`npm run build`, `npm run lint`, and the existing dev server in working
order.

## Risks

- **CSS Modules + tokens in Storybook** — getting the global `tokens.css`
  loaded into Storybook's preview takes a `preview.ts` import. Easy to miss;
  worth verifying the example story actually has token values applied (not
  just rendering with broken styles).
- **Playwright + Next.js dev server in CI** — Playwright needs a server to
  hit. We'll use `webServer` config to spawn `next start` against a
  pre-built app rather than `next dev` (faster, more representative).
- **Storybook test-runner determinism** — animations, fonts, or async
  rendering can cause flaky screenshots. Stack is static enough to avoid
  this in Phase 3, but it's a risk to flag for future story additions.
