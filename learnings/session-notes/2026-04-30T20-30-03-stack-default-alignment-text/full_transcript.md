# Turn — user

> Then the directory listing should also be left aligned. But I want to put a 720 pix limit on the width by default so left aligned inside of a center aligned c[ontainer]

# Turn — Claude (proposes plan)

Discussion of options for the 720px width constraint, choice of `tokens.size.x768` (no `x720` token in the scale).

# Turn — Claude (applies width and removes inner Area)

Removed `<Area width={tokens.size.x384}>` from FileListing. Set `width={tokens.size.x768}` on AppLayout for the home page. Added `alignment="start"` to the outer Stack in FileListing.

# Turn — user

> A lot of pages scroll when they don't need to. The file listing should be left aligned

# Turn — Claude

Diagnosed: `justify-content: space-between` on `.fileStack` was pushing date to right edge — read as edge-aligned, not left-aligned. Removed it. Also dropped `min-height: 100vh` from AppLayout for the scroll issue.

# Turn — user

> The file listings are still center aligning text it should pull to the left

# Turn — Claude

Identified the actual bug: `Stack` defaults to `alignment="center"`. Inner Stack with `direction={{ xs: 'vertical', sm: 'horizontal' }}` had no explicit alignment, so `align-items: center` was centering text horizontally on `xs` (vertical direction → cross-axis is horizontal).

Fix:

```tsx
<Stack
  alignment={{ xs: 'start', sm: 'baseline' }}
  gap={tokens.space.x16}
  direction={{ xs: 'vertical', sm: 'horizontal' }}
  className={styles.fileStack}
>
```

`start` on `xs` left-aligns text. `baseline` on `sm` keeps title and date on the same baseline horizontally.
