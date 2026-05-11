Initial attempts to "left-align the file listing" focused on:

1. Removing `<Area width={tokens.size.x384}>` wrapper (which was centering the column).
2. Removing `justify-content: space-between` from the row's CSS (which was pushing the date to the right edge).
3. Adding `alignment="start"` to the *outer* Stack only.

The inner row Stack was left with its default props:

```tsx
<Stack gap={tokens.space.x16} direction={{ xs: 'vertical', sm: 'horizontal' }} className={styles.fileStack}>
```

I assumed the default alignment was acceptable. I did not check `Stack`'s defaults. `Stack` defaults to `alignment="center"` (see `components/shared/Stack/index.tsx`):

```tsx
export function Stack({
  as: Component = 'div',
  direction = 'vertical',
  alignment = 'center',
  ...
})
```

On `xs`, the inner Stack is `direction="vertical"`, so `align-items: center` aligns children to the *horizontal* center — leaving title and date visually centered inside each row even though the surrounding column was now left-aligned.
