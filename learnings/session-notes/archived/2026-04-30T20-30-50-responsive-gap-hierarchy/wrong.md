After fixing the alignment issue I left the inner row Stack with a fixed gap:

```tsx
<Stack
  alignment={{ xs: 'start', sm: 'baseline' }}
  gap={tokens.space.x16}
  direction={{ xs: 'vertical', sm: 'horizontal' }}
>
```

`tokens.space.x16` is the right value for a *horizontal* row — title and date sit comfortably side-by-side. But on `xs` the row collapses to vertical, and that same `x16` becomes a vertical gap between title and date. The outer column gap on `xs` is `x6` (between rows). Result: each date is `16px` from its title but the next title is only `6px` below the date — the date visually pairs with the wrong title.

I focused on the alignment correction and didn't think about how a fixed gap behaves when the surrounding direction is responsive.
