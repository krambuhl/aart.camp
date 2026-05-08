# What Claude produced

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
