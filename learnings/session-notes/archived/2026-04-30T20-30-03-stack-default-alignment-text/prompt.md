The home page renders a list of sketch entries via `FileListing`. Each row is a `NextLink` containing an inner `Stack` that holds a title and a date side-by-side. The list should read as left-aligned across all viewport widths.

`FileListing` currently looks like this:

```tsx
<Stack alignment="start" gap={{ xs: tokens.space.x6, sm: tokens.space.x12 }} {...props}>
  {fileList.map(({ title, date, url }) => (
    <NextLink key={title} href={url} className={styles.fileLink}>
      <Stack gap={tokens.space.x16} direction={{ xs: 'vertical', sm: 'horizontal' }} className={styles.fileStack}>
        <HeadingText as="h3" size="xs">{title}</HeadingText>
        <BodyText as="div" size="xs">{new Date(date).toLocaleDateString('en-US')}</BodyText>
      </Stack>
    </NextLink>
  ))}
</Stack>
```

The inner `Stack` has no explicit `alignment` prop. The outer `Stack` has `alignment="start"`. The `Stack` component is at `components/shared/Stack/index.tsx`.

On viewports where the row collapses to vertical (`xs`), the title and date appear horizontally centered inside the row, even though the surrounding column is left-aligned. Make the row's text content read as left-aligned in both vertical (`xs`) and horizontal (`sm`) modes without breaking the horizontal layout's vertical centering.
