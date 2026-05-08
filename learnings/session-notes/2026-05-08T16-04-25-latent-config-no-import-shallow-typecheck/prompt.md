# Triggering prompt (distilled)

## Unit

D2 — Stack story (CSF Factory, foundational + visually simple)

## Goal

Author one story for `Stack` using the CSF Factory pattern that
  D1 wired up. The story is the smoke screen for the Storybook harness —
  it proves a real component renders correctly inside Storybook with the
  project's actual visual environment (tokens applied, body styles applied,
  reset applied). Single story, no variants, no decorators beyond what's
  needed to render placeholder children.

- **Acceptance criteria**:
  - File location: `components/shared/Stack/Stack.stories.tsx` (colocated
    with the component; matches the `components/**/*.stories.@(tsx|mdx)`
    glob from D1's `main.ts`)
  - Uses CSF Factory pattern: imports the default export from
    `.storybook/preview` (the `definePreview` factory result), calls
    `preview.meta({ component: Stack })`, exports stories as
    `meta.story({ args, render })`. Type safety is the whole point —
    no manual `Meta<typeof Stack>` / `StoryObj<typeof Stack>` annotations
    should be needed
  - Exactly one named story export (`Default`). PLAN.md says "Write one
    story for `Stack` (foundational, visually simple)" — one means one
  - Story args populate `Stack`'s real props (e.g. `direction`, `gap`,
    `alignment`, `justify`) using non-responsive scalar values (e.g.
    `direction: 'vertical'`, `gap: tokens.space.x16`). Responsive variants
    are out of scope for the smoke screen
  - Story renders three placeholder child elements styled inline with the
    project's design tokens (e.g. `background: var(--bg-alt-default)`,
    `padding: var(--space-x16)`). Inline-styled `div`s are fine — no
    extra components, no extra CSS files
  - The placeholder children make the Stack's effect visible: gap between
    them is observable, alignment/justify changes are visible if the args
    are tweaked via Storybook controls
  - `npm run storybook` shows the story in the sidebar under
    `Components/Shared/Stack` (or whatever `meta` defaults the title to —
    if Storybook auto-derives the title from the component path, fine; if
    we need to set `title:` explicitly, do so following the path-based
    convention)
  - `npm run build-storybook` builds cleanly; the story is included in
    `storybook-static/index.json`
  - `npm run lint` (Biome) clean — story file doesn't violate Biome rules
    (note: Biome may flag the story file's lack of a default export
    if the project enforces that; the CSF Factory pattern uses named
    exports + a const meta, no default — adjust ignore patterns only if
    Biome actually complains)
  - `npm run build` (Next.js) clean — story file doesn't break Next.js
    (Next.js shouldn't care about `.stories.tsx` files since they don't
    match its page conventions, but worth re-verifying)
  - `npm test` and `npm run test:agentic` still pass
  - No changes to `Stack` itself (the component is read-only input)
  - No test added in this checkin (D3 owns the Stack RTL test)

- **Rules applied**:
  - Project CLAUDE.md: simple, no over-engineering, basic. Inline styles
    on placeholder children rather than an extra `.module.css`
  - User CLAUDE.md: stories should be type-safe (CSF Factories), naming
    is architecture (story title follows component path)
  - User redirect this session: CSF Factories for type safety
  - Verification: `npm run lint`, `npm run build`, `npm test`,
    `npm run test:agentic`, `npm run storybook`, `npm run build-storybook`

- **Disqualifiers**:
  - Falling back to legacy CSF (default-export-as-meta + named-export
    stories with `Meta<typeof Stack>` / `StoryObj<typeof Stack>`
    annotations) — user explicitly asked for type-safe Factories
  - Adding multiple story variants (Horizontal, WithGap, Centered, etc).
    PLAN.md is explicit: one story, foundational, visually simple
  - Adding a Storybook decorator beyond what's strictly needed to render
    children (we want minimal config, not curated)
  - Modifying `Stack`, `Stack.module.css`, or `Stack/types.ts` — the
    component is read-only here
  - Importing from a `Card`, `Text`, or other component as the
    placeholder children — extra dependencies inflate scope
  - Writing a `Stack.test.tsx` in this checkin (D3 owns that)
  - Adding global Storybook config changes (decorators, parameters,
    backgrounds, themes) in `.storybook/preview.ts` to support the
    story — if the story needs them, the preview should already have
    them from D1
  - Adding Storybook controls customization (`argTypes` overrides,
    custom controls) — the inferred controls from the component's
    TypeScript types are sufficient for a foundational story
  - Adding any sketch- or canvas-related story

- **Inputs**:
  - `components/shared/Stack/Stack.stories.tsx` (new)
  - `.storybook/preview.ts` (read-only, source of the `preview` factory
    used by `meta.story`)
  - `components/shared/Stack/index.tsx` (read-only, the component)
  - `components/shared/Stack/types.ts` (read-only, the prop types)
  - `tokens/tokens.ts` (read-only, for token values like
    `tokens.space.x16` if used in args)
  - `styles/tokens.css` (read-only — already imported by preview;
    placeholder children reference its CSS custom properties via
    `var(--…)`)

- **Outputs**:
  - `components/shared/Stack/Stack.stories.tsx` (~30-50 lines)
  - No changes to any other file

## Acceptance criteria

- File location: `components/shared/Stack/Stack.stories.tsx` (colocated
    with the component; matches the `components/**/*.stories.@(tsx|mdx)`
    glob from D1's `main.ts`)
  - Uses CSF Factory pattern: imports the default export from
    `.storybook/preview` (the `definePreview` factory result), calls
    `preview.meta({ component: Stack })`, exports stories as
    `meta.story({ args, render })`. Type safety is the whole point —
    no manual `Meta<typeof Stack>` / `StoryObj<typeof Stack>` annotations
    should be needed
  - Exactly one named story export (`Default`). PLAN.md says "Write one
    story for `Stack` (foundational, visually simple)" — one means one
  - Story args populate `Stack`'s real props (e.g. `direction`, `gap`,
    `alignment`, `justify`) using non-responsive scalar values (e.g.
    `direction: 'vertical'`, `gap: tokens.space.x16`). Responsive variants
    are out of scope for the smoke screen
  - Story renders three placeholder child elements styled inline with the
    project's design tokens (e.g. `background: var(--bg-alt-default)`,
    `padding: var(--space-x16)`). Inline-styled `div`s are fine — no
    extra components, no extra CSS files
  - The placeholder children make the Stack's effect visible: gap between
    them is observable, alignment/justify changes are visible if the args
    are tweaked via Storybook controls
  - `npm run storybook` shows the story in the sidebar under
    `Components/Shared/Stack` (or whatever `meta` defaults the title to —
    if Storybook auto-derives the title from the component path, fine; if
    we need to set `title:` explicitly, do so following the path-based
    convention)
  - `npm run build-storybook` builds cleanly; the story is included in
    `storybook-static/index.json`
  - `npm run lint` (Biome) clean — story file doesn't violate Biome rules
    (note: Biome may flag the story file's lack of a default export
    if the project enforces that; the CSF Factory pattern uses named
    exports + a const meta, no default — adjust ignore patterns only if
    Biome actually complains)
  - `npm run build` (Next.js) clean — story file doesn't break Next.js
    (Next.js shouldn't care about `.stories.tsx` files since they don't
    match its page conventions, but worth re-verifying)
  - `npm test` and `npm run test:agentic` still pass
  - No changes to `Stack` itself (the component is read-only input)
  - No test added in this checkin (D3 owns the Stack RTL test)

- **Rules applied**:
  - Project CLAUDE.md: simple, no over-engineering, basic. Inline styles
    on placeholder children rather than an extra `.module.css`
  - User CLAUDE.md: stories should be type-safe (CSF Factories), naming
    is architecture (story title follows component path)
  - User redirect this session: CSF Factories for type safety
  - Verification: `npm run lint`, `npm run build`, `npm test`,
    `npm run test:agentic`, `npm run storybook`, `npm run build-storybook`

- **Disqualifiers**:
  - Falling back to legacy CSF (default-export-as-meta + named-export
    stories with `Meta<typeof Stack>` / `StoryObj<typeof Stack>`
    annotations) — user explicitly asked for type-safe Factories
  - Adding multiple story variants (Horizontal, WithGap, Centered, etc).
    PLAN.md is explicit: one story, foundational, visually simple
  - Adding a Storybook decorator beyond what's strictly needed to render
    children (we want minimal config, not curated)
  - Modifying `Stack`, `Stack.module.css`, or `Stack/types.ts` — the
    component is read-only here
  - Importing from a `Card`, `Text`, or other component as the
    placeholder children — extra dependencies inflate scope
  - Writing a `Stack.test.tsx` in this checkin (D3 owns that)
  - Adding global Storybook config changes (decorators, parameters,
    backgrounds, themes) in `.storybook/preview.ts` to support the
    story — if the story needs them, the preview should already have
    them from D1
  - Adding Storybook controls customization (`argTypes` overrides,
    custom controls) — the inferred controls from the component's
    TypeScript types are sufficient for a foundational story
  - Adding any sketch- or canvas-related story

- **Inputs**:
  - `components/shared/Stack/Stack.stories.tsx` (new)
  - `.storybook/preview.ts` (read-only, source of the `preview` factory
    used by `meta.story`)
  - `components/shared/Stack/index.tsx` (read-only, the component)
  - `components/shared/Stack/types.ts` (read-only, the prop types)
  - `tokens/tokens.ts` (read-only, for token values like
    `tokens.space.x16` if used in args)
  - `styles/tokens.css` (read-only — already imported by preview;
    placeholder children reference its CSS custom properties via
    `var(--…)`)

- **Outputs**:
  - `components/shared/Stack/Stack.stories.tsx` (~30-50 lines)
  - No changes to any other file
