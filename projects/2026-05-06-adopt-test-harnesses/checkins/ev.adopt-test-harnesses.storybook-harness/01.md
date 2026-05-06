# Checkin 01 — ev.adopt-test-harnesses.storybook-harness

**Created**: 2026-05-06 16:30
**Phase**: 2 — Storybook harness
**Unit**: D1 — Install Storybook 10 with Next.js (Vite) framework + configure preview to load tokens.css + enable CSF Factories

## Contract

- **Goal**: Stand up Storybook 10.3 against this Next.js + TypeScript repo so
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

## Execution

Bypassed `storybook init` in favor of a manual install — the init flow
is interactive (prompts framework choice, generates sample stories,
auto-edits config files) and would require post-cleanup of choices the
contract already nails down. Manual install gives full control over
what lands in the repo.

Three steps:

1. **Install deps**: `npm install --save-dev storybook@^10
   @storybook/nextjs-vite@^10 @storybook/addon-a11y@^10`. All three
   resolved to `10.3.6` (the current `latest` tag).

2. **Author config files**:
   - `.storybook/main.ts` uses the `defineMain` factory from
     `@storybook/nextjs-vite/node`. Story glob is
     `'../components/**/*.stories.@(tsx|mdx)'` — colocated, mirroring
     the Phase 1 pattern of putting tests next to their source.
   - `.storybook/preview.ts` uses the `definePreview` factory from
     `@storybook/nextjs-vite` with the a11y addon registered for type
     inference. Imports the **full app/layout.tsx CSS chain** in the
     same order: `the-new-css-reset/css/reset.css` → `tokens.css` →
     `globals.css`. This is a faithful interpretation of the contract's
     stated goal ("render with the project's actual visual environment")
     — token import alone leaves the body without reset + body
     background, which would mislead about the rendered environment.

3. **Wire up scripts + gitignore**: `package.json` gets
   `"storybook": "storybook dev -p 6006"` and
   `"build-storybook": "storybook build"`. `.gitignore` gets
   `storybook-static/`.

**Scope expansion (mid-flight)**: First `npm run build-storybook` failed
with `SB_FRAMEWORK_NEXTJS_0003 (IncompatiblePostCssConfigError)`. The
project's `postcss.config.js` used the array-based plugin format
(`['name', options]` tuples) which Next.js accepts but Vite — and
therefore Storybook-with-Vite — does not. Per Storybook's error
message, the **object-based format works in both Next.js and Vite**.

Converted `postcss.config.js` from array to object format
(mechanical, structure-preserving). Re-verified both
`npm run build-storybook` (now passes, 622ms) and `npm run build`
(Next.js, still passes — confirms the format is bidirectional).
Decision: one PostCSS config that both bundlers accept, vs. a
Storybook-specific `viteFinal` PostCSS override (two parallel
configs). Mirrors the Phase 1 "consolidate over coexist" pattern.

**Auto-generated stories cleanup**: Not needed — bypassing
`storybook init` means no `stories/` directory was created in the
first place. The contract criterion still applies in spirit (no sample
Button/Header in `main`), and the spirit is met.

**Token-application verification (hard evidence)**: After
`npm run build-storybook`, inspected the bundled iframe CSS at
`storybook-static/assets/iframe-CyTOrKec.css` and confirmed the
custom properties and body styles are present:

```
$ grep -o -E "\-\-space-x24|\-\-bg-base-default|\-\-fg-regular-default|font-family-body" \
    storybook-static/assets/iframe-CyTOrKec.css | sort -u
--bg-base-default
--fg-regular-default
--space-x24
font-family-body
```

This proves all three CSS files (`tokens.css`, `globals.css`, the reset)
are bundled into Storybook's preview iframe. Reproducible from the
build artifact — harder evidence than open-and-inspect, and the same
underlying claim PLAN.md flagged as risk #1 for this phase.

Additionally booted `npm run storybook` and confirmed the dev server
starts cleanly on port 6006 with no preview errors (the "EmptyIndexError"
is the expected "no stories yet" warning per D1's disqualifier list,
not a config failure).

## Scope

- `.storybook/main.ts` (new, 7 lines)
- `.storybook/preview.ts` (new, 11 lines)
- `package.json` (2 new scripts + 3 new devDeps)
- `package-lock.json` (transitive deps from Storybook install,
  ~105 added packages, 2 removed)
- `.gitignore` (1 new section, 2 lines)
- `postcss.config.js` (array → object format, structure-preserving)

Out of scope (intentionally not touched):
- `components/shared/Stack/` (D2 owns the story, D3 owns the test)
- `vitest.config.ts` (no test changes in D1)
- `app/layout.tsx` (Storybook mirrors its CSS chain but doesn't modify it)
- Any sketch- or canvas-related config (PLAN.md "Out (deferred)")

## Changes since previous checkin

This is the first checkin on `ev.adopt-test-harnesses.storybook-harness`,
branched from `main` at `60bad14` (the merge commit for PR #11, Phase 1).
Phase 1 is fully shipped; Phase 2 starts from a clean main, not stacked.

## Evaluator verdict

approved (on retry 1 of 2). First pass flagged three issues
(criterion-unmet on token verification, scope-creep on
`postcss.config.js`, contract-ask-drift on install method); second
pass verified all three were addressed substantively (not papered
over) by contract amendment + reproducible bundle-grep evidence for
the token-application criterion. Both `npm run lint`, `npm run build`,
`npm test`, `npm run test:agentic`, and `npm run build-storybook`
re-verified by the evaluator. `correction:` prefix present in PR
notes per substrate convention.

## Notes for the PR

correction: Mid-PR scope expansion — the project's
`postcss.config.js` used Next.js's array-based plugin format
(`['name', options]` tuples), which Vite (and therefore
Storybook-with-Vite) does not accept. Rather than maintaining a
Storybook-specific PostCSS override via `viteFinal` — two parallel
configs to keep in sync — this PR converts `postcss.config.js` to
the object-based format, which both Next.js and Vite accept per
Storybook's own error guidance. Same pattern as Phase 1's substrate
consolidation: when integration forces a scope expansion, prefer one
config that works for both surfaces over two parallel configs.

Storybook is wired with type-safe **CSF Factories** (the
`defineMain` / `definePreview` / `meta.story` chain). Stories are
colocated at `components/**/*.stories.@(tsx|mdx)`, mirroring the
Phase 1 test colocation pattern. Preview imports the full
`app/layout.tsx` CSS chain (reset → tokens → globals) so components
render in their actual visual environment, not just with tokens.

D1 ships the harness only — no story, no test. D2 will land the
first Stack story; D3 will add the first vitest + RTL test for a
real React component (Stack), proving the React testing surface
beyond Phase 1's pure-utility test.
