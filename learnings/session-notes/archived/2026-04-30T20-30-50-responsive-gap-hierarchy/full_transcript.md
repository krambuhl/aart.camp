# Turn — Claude (post alignment fix)

Inner row Stack uses fixed `gap={tokens.space.x16}` and responsive direction. Reported as fixed.

# Turn — user

> The gap between title and date is larger than the composite gap. It looks like date is attached to the next title

# Turn — Claude (diagnosis)

The inner gap (`x16`) is bigger than the outer row-to-row gap (`x6` on xs, `x12` on sm). On vertical layout, both gaps live on the same axis so the date ends up visually closer to the next title than to its own.

# Turn — Claude (fix)

```tsx
<Stack
  alignment={{ xs: 'start', sm: 'baseline' }}
  gap={{ xs: tokens.space.x2, sm: tokens.space.x16 }}
  direction={{ xs: 'vertical', sm: 'horizontal' }}
>
```

Tight `x2` inner gap on `xs` (well below the `x6` row-to-row gap) so each title-date pair reads as a unit. Original `x16` retained on `sm+` for horizontal breathing room.
