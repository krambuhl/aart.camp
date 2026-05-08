# Checkin 02 — ev.adopt-test-harnesses.storybook-harness

**Created**: 2026-05-06 17:25
**Phase**: 2 — Storybook harness
**Unit**: D2 — Stack story (CSF Factory, foundational + visually simple)

## Contract

- **Goal**: Author one story for `Stack` using the CSF Factory pattern that
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

## Execution

Single new file: `components/shared/Stack/Stack.stories.tsx` (~25 lines).

The CSF Factory chain in action:

```ts
import preview from '@/.storybook/preview';
import { tokens } from '@/tokens';
import { Stack } from './index';

const meta = preview.meta({ component: Stack });

export const Default = meta.story({
  args: {
    direction: 'vertical',
    alignment: 'center',
    justify: 'start',
    gap: tokens.space.x16,
  },
  render: (args) => (
    <Stack {...args}>
      <div style={placeholderStyle}>One</div>
      ...
    </Stack>
  ),
});
```

Type safety from the factory chain means no `Meta<typeof Stack>` /
`StoryObj<typeof Stack>` annotations are needed — `preview.meta`
infers the component, and `meta.story` infers args from the inferred
component's props. This is the headline feature of CSF Factories.

Used the project's `@/` path alias for the preview import
(`@/.storybook/preview`) rather than a deep relative
(`../../../.storybook/preview`) — consistent with the project's
existing import style (Stack itself uses `@/types/...` and
`@/utilities/...`). TypeScript's `paths: { "@/*": ["./*"] }` resolves
the alias to a hidden directory without complaint.

**Latent D1 bug surfaced**: First `npm run build` after the new file
landed flagged a TypeScript error in `.storybook/preview.ts`:

```
Type error: Value of type '() => PreviewAddon<A11yTypes>' has no
properties in common with type 'PreviewAddon<never>'. Did you mean
to call it?
  9 |   addons: [a11y],
```

The `@storybook/addon-a11y` default export is a *factory function*
that returns the addon (`() => PreviewAddon<A11yTypes>`), not the
addon directly. D1 wrote `addons: [a11y]` instead of `addons: [a11y()]`.
The bug was latent because nothing in the project imported
`.storybook/preview.ts` until this story did — TypeScript only
deep-checks files reachable from imports, so D1's `npm run build`
was clean for the wrong reason.

Fix: one character — `[a11y]` → `[a11y()]`. Re-verified both builds
clean afterward. This is a real correction, not a contract amendment:
D1 shipped a wrong default-import shape that we missed because the
existing import graph didn't exercise it.

**Story title auto-derived**: Storybook 10's auto-titling produces
`shared/Stack/Default` from the file path `components/shared/Stack/Stack.stories.tsx`
(relative to the `./components` directory configured in `main.ts`'s
story glob). That matches the contract's "auto-derived is fine"
allowance — no `title:` override needed.

**Placeholder children**: Three inline-styled `div`s using token CSS
custom properties (`var(--bg-alt-default)`, `var(--fg-regular-default)`,
`var(--space-x16)`). Inline-style approach keeps the story
self-contained and doubly proves token loading: the fact that the
elements render with the right colors is direct visual confirmation
that tokens.css resolved into the rendered DOM. Bundle-grep evidence
from D1 plus visual proof in D2 — the PLAN.md token-application risk
is now fully retired.

## Scope

- `components/shared/Stack/Stack.stories.tsx` (new, ~25 lines)
- `.storybook/preview.ts` (D1 bug fix: `[a11y]` → `[a11y()]`, one
  character changed)

Out of scope (intentionally not touched):
- `components/shared/Stack/index.tsx` (read-only, the component
  under test)
- `components/shared/Stack/types.ts` (read-only, prop types)
- `components/shared/Stack/Stack.module.css` (read-only)
- `.storybook/main.ts` (no changes — D1's config is correct as-is)
- Any test file (D3 owns)
- Any other component's story

## Changes since previous checkin

01 (D1) installed Storybook 10.3 with the `@storybook/nextjs-vite`
framework and CSF Factories, wired the preview to load the full
`app/layout.tsx` CSS chain, and converted `postcss.config.js` to the
object format Vite requires. D2 builds on that scaffold by authoring
the first story — proving the harness produces real, visually-correct
stories (not just an empty Storybook UI).

## Evaluator verdict

approved (first pass). Evaluator verified the CSF Factory pattern,
the single Default story export, real `StackProps` args with
non-responsive scalars, three token-styled placeholder children,
story discovery in `storybook-static/index.json` as
`shared-stack--default`, and clean lint/build/test/build-storybook
runs. The `preview.ts` one-character correction (`[a11y]` → `[a11y()]`)
was explicitly accepted as a transparent upstream bug fix rather
than scope creep — it's a precondition for the build-clean
criterion, not a story-support modification. `correction:` prefix
present in PR notes per substrate convention.

## Notes for the PR

correction: D1 shipped `addons: [a11y]` in `.storybook/preview.ts`,
but `@storybook/addon-a11y`'s default export is a factory function
(`() => PreviewAddon<A11yTypes>`), not the addon itself. The bug was
latent — no file imported `preview.ts` until this story did, so
TypeScript never deep-checked it. D2's new story imports `preview.ts`,
which surfaces the type error during `npm run build`. Fix is one
character: `[a11y]` → `[a11y()]`. Lesson: a config file with no
inbound imports gets only shallow type-checking; for harnesses, write
a smoke import (or smoke story) early to flush latent type errors.

D2 lands the first real story for the Storybook harness — the smoke
screen Phase 2's PLAN.md asked for. CSF Factory pattern: `preview.meta`
infers the component, `meta.story` infers args, no manual generic
type annotations needed. Story renders three inline-styled placeholder
children using token CSS custom properties, which both visually proves
tokens load (the elements have the right colors) and complements D1's
bundle-grep evidence with direct DOM evidence.

Auto-derived title `shared/Stack/Default` is intentional — no `title:`
override since Storybook's path-based default matches the project's
naming convention.
