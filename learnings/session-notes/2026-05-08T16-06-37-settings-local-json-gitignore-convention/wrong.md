# What Claude produced

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
