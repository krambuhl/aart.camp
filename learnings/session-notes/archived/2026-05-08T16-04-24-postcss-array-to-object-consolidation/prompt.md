# Triggering prompt (distilled)

## Unit

D1 — Install Storybook 10 with Next.js (Vite) framework + configure preview to load tokens.css + enable CSF Factories

## Goal

Stand up Storybook 10.3 against this Next.js + TypeScript repo so
  that future stories can be authored with type-safe CSF Factories and render
  with the project's actual visual environment (design tokens applied via
  CSS custom properties). This is the harness install only — no application
  story and no component test ship in this checkin.

- **Acceptance criteria**:
  - Storybook 10.x installed (manual `npm install` or via `storybook init`),
    pinned to the latest `10.x` line in `package.json`/`package-lock.json`.
    Manual install is preferred when the contract already nails down framework
    + addon choices that the interactive init would re-prompt for.
  - Framework: `@storybook/nextjs-vite` (Storybook's own recommendation for
    new Next.js projects; also aligns with the Vite pipeline already pulled
    in transitively via vitest)
  - `.storybook/main.ts` uses the `defineMain` factory export from
    `@storybook/nextjs-vite/node` (CSF Factory style, type-safe)
  - `.storybook/preview.ts` uses the `definePreview` factory export and
    imports the project's global token stylesheet at the top:
    `import '../styles/tokens.css'`
  - Story glob in `main.ts` matches colocated stories:
    `'../components/**/*.stories.@(tsx|mdx)'` (mirrors how Phase 1 colocated
    `utilities/opaque-responsive.test.ts` next to its source)
  - `npm run storybook` boots cleanly on port 6006 and the Storybook UI
    loads with no console errors
  - `npm run build-storybook` produces `storybook-static/` with no errors
  - `storybook-static/` added to `.gitignore`
  - The auto-generated example `stories/` directory created by
    `storybook init` is removed (we don't want sample Button/Header
    components shipping in `main`)
  - `@storybook/addon-a11y` installed and registered (Storybook's recommended
    default; also aligns with the project's broader accessibility concern
    flagged in PLAN.md "Out (deferred)")
  - Tokens demonstrably applied: the CSS bundle produced by `npm run build-storybook`
    contains the project's custom properties (e.g. `--space-x24`, `--bg-base-default`,
    `--fg-regular-default`) and the body styles from `globals.css` (e.g. `font-family-body`).
    Verifiable via `grep` against `storybook-static/assets/iframe-*.css` — harder evidence
    than browser inspection and reproducible by the evaluator. (Browser inspection
    of a rendered element will be additionally verifiable in D2 once the Stack story
    lands; this criterion proves the wiring, that proves the visual outcome.)
  - `npm run lint` (Biome) clean — `.storybook/` files don't violate Biome
    rules
  - `npm run build` (Next.js production build) still clean — Storybook's
    install does not break the Next.js build
  - `npm test` and `npm run test:agentic` still pass — Storybook install
    does not break the vitest harness

- **Rules applied**:
  - Project CLAUDE.md: simple, no over-engineering, basic. Tokens load via
    a single CSS import, no theme decorators or fancy provider wrappers
  - User CLAUDE.md: stack is intentionally simple, "good enough for now"
    is real
  - User redirect this session: latest Storybook (10.x), CSF Factories for
    type safety
  - Verification: `npm run lint`, `npm run build`, `npm test`,
    `npm run test:agentic`, `npm run storybook`, `npm run build-storybook`

- **Disqualifiers**:
  - Choosing the Webpack-based `@storybook/nextjs` instead of `nextjs-vite`
    (slower; not Storybook's recommendation for new projects)
  - Falling back to legacy CSF (default-export-as-meta + named-export
    stories) — user explicitly asked for type-safe CSF Factories
  - Writing a `Stack.stories.tsx` in this checkin (D2 owns that)
  - Writing a `Stack.test.tsx` in this checkin (D3 owns that)
  - Adding addons beyond `@storybook/addon-a11y` unless required by the init
    flow (we want minimal, not curated)
  - Theme/decorator setup beyond the tokens CSS import — no provider
    wrappers, no global decorators that don't earn their keep yet
  - Leaving the auto-generated `stories/` folder in place
  - Skipping the post-install `npm run build` check (Storybook can introduce
    transitive deps that conflict with Next.js's bundler)
  - Adding any sketch- or canvas-related Storybook config (sketches are
    explicitly out of scope per PLAN.md "Out (deferred)")

- **Inputs**:
  - `package.json` (new scripts + Storybook devDeps)
  - `.storybook/main.ts` (new, factory-style)
  - `.storybook/preview.ts` (new, factory-style)
  - `.gitignore` (add `storybook-static/`)
  - `styles/tokens.css`, `styles/globals.css`, `the-new-css-reset/css/reset.css`
    (read-only, imported by preview to mirror `app/layout.tsx` CSS chain so
    components render in their actual visual environment, not just with tokens)
  - `postcss.config.js` (array → object plugin format conversion, required for
    Vite/Storybook compatibility per `SB_FRAMEWORK_NEXTJS_0003`; bidirectional
    format that both Next.js and Vite accept — verified by re-running both
    `npm run build` and `npm run build-storybook`. Listed here explicitly as
    a known integration-forced input, mirroring the Phase 1 D3 pattern of
    bringing scope-expansion changes under the same PR rather than
    maintaining two parallel configs)

- **Outputs**:
  - `.storybook/` directory with `main.ts` and `preview.ts`
  - `package.json`: `"storybook": "storybook dev -p 6006"`,
    `"build-storybook": "storybook build"` scripts
  - `package.json`/`package-lock.json`: Storybook 10.x devDeps
  - `.gitignore`: one new line for `storybook-static/`

## Acceptance criteria

- Storybook 10.x installed (manual `npm install` or via `storybook init`),
    pinned to the latest `10.x` line in `package.json`/`package-lock.json`.
    Manual install is preferred when the contract already nails down framework
    + addon choices that the interactive init would re-prompt for.
  - Framework: `@storybook/nextjs-vite` (Storybook's own recommendation for
    new Next.js projects; also aligns with the Vite pipeline already pulled
    in transitively via vitest)
  - `.storybook/main.ts` uses the `defineMain` factory export from
    `@storybook/nextjs-vite/node` (CSF Factory style, type-safe)
  - `.storybook/preview.ts` uses the `definePreview` factory export and
    imports the project's global token stylesheet at the top:
    `import '../styles/tokens.css'`
  - Story glob in `main.ts` matches colocated stories:
    `'../components/**/*.stories.@(tsx|mdx)'` (mirrors how Phase 1 colocated
    `utilities/opaque-responsive.test.ts` next to its source)
  - `npm run storybook` boots cleanly on port 6006 and the Storybook UI
    loads with no console errors
  - `npm run build-storybook` produces `storybook-static/` with no errors
  - `storybook-static/` added to `.gitignore`
  - The auto-generated example `stories/` directory created by
    `storybook init` is removed (we don't want sample Button/Header
    components shipping in `main`)
  - `@storybook/addon-a11y` installed and registered (Storybook's recommended
    default; also aligns with the project's broader accessibility concern
    flagged in PLAN.md "Out (deferred)")
  - Tokens demonstrably applied: the CSS bundle produced by `npm run build-storybook`
    contains the project's custom properties (e.g. `--space-x24`, `--bg-base-default`,
    `--fg-regular-default`) and the body styles from `globals.css` (e.g. `font-family-body`).
    Verifiable via `grep` against `storybook-static/assets/iframe-*.css` — harder evidence
    than browser inspection and reproducible by the evaluator. (Browser inspection
    of a rendered element will be additionally verifiable in D2 once the Stack story
    lands; this criterion proves the wiring, that proves the visual outcome.)
  - `npm run lint` (Biome) clean — `.storybook/` files don't violate Biome
    rules
  - `npm run build` (Next.js production build) still clean — Storybook's
    install does not break the Next.js build
  - `npm test` and `npm run test:agentic` still pass — Storybook install
    does not break the vitest harness

- **Rules applied**:
  - Project CLAUDE.md: simple, no over-engineering, basic. Tokens load via
    a single CSS import, no theme decorators or fancy provider wrappers
  - User CLAUDE.md: stack is intentionally simple, "good enough for now"
    is real
  - User redirect this session: latest Storybook (10.x), CSF Factories for
    type safety
  - Verification: `npm run lint`, `npm run build`, `npm test`,
    `npm run test:agentic`, `npm run storybook`, `npm run build-storybook`

- **Disqualifiers**:
  - Choosing the Webpack-based `@storybook/nextjs` instead of `nextjs-vite`
    (slower; not Storybook's recommendation for new projects)
  - Falling back to legacy CSF (default-export-as-meta + named-export
    stories) — user explicitly asked for type-safe CSF Factories
  - Writing a `Stack.stories.tsx` in this checkin (D2 owns that)
  - Writing a `Stack.test.tsx` in this checkin (D3 owns that)
  - Adding addons beyond `@storybook/addon-a11y` unless required by the init
    flow (we want minimal, not curated)
  - Theme/decorator setup beyond the tokens CSS import — no provider
    wrappers, no global decorators that don't earn their keep yet
  - Leaving the auto-generated `stories/` folder in place
  - Skipping the post-install `npm run build` check (Storybook can introduce
    transitive deps that conflict with Next.js's bundler)
  - Adding any sketch- or canvas-related Storybook config (sketches are
    explicitly out of scope per PLAN.md "Out (deferred)")

- **Inputs**:
  - `package.json` (new scripts + Storybook devDeps)
  - `.storybook/main.ts` (new, factory-style)
  - `.storybook/preview.ts` (new, factory-style)
  - `.gitignore` (add `storybook-static/`)
  - `styles/tokens.css`, `styles/globals.css`, `the-new-css-reset/css/reset.css`
    (read-only, imported by preview to mirror `app/layout.tsx` CSS chain so
    components render in their actual visual environment, not just with tokens)
  - `postcss.config.js` (array → object plugin format conversion, required for
    Vite/Storybook compatibility per `SB_FRAMEWORK_NEXTJS_0003`; bidirectional
    format that both Next.js and Vite accept — verified by re-running both
    `npm run build` and `npm run build-storybook`. Listed here explicitly as
    a known integration-forced input, mirroring the Phase 1 D3 pattern of
    bringing scope-expansion changes under the same PR rather than
    maintaining two parallel configs)

- **Outputs**:
  - `.storybook/` directory with `main.ts` and `preview.ts`
  - `package.json`: `"storybook": "storybook dev -p 6006"`,
    `"build-storybook": "storybook build"` scripts
  - `package.json`/`package-lock.json`: Storybook 10.x devDeps
  - `.gitignore`: one new line for `storybook-static/`
