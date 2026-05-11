A `FileListing` renders a vertical list of rows. Each row is a `Stack` whose `direction` is responsive: `vertical` on `xs`, `horizontal` on `sm+`. The outer column-Stack uses gap `{ xs: tokens.space.x6, sm: tokens.space.x12 }`. The inner row-Stack uses gap `tokens.space.x16`.

```tsx
<Stack alignment="start" gap={{ xs: tokens.space.x6, sm: tokens.space.x12 }}>
  {fileList.map(({ title, date, url }) => (
    <NextLink key={title} href={url} className={styles.fileLink}>
      <Stack
        alignment={{ xs: 'start', sm: 'baseline' }}
        gap={tokens.space.x16}
        direction={{ xs: 'vertical', sm: 'horizontal' }}
      >
        <HeadingText as="h3" size="xs">{title}</HeadingText>
        <DataText as="div" size="xs">{date}</DataText>
      </Stack>
    </NextLink>
  ))}
</Stack>
```

On `xs`, the inner Stack is vertical, so its gap (between title and date) lives on the *same axis* as the outer Stack's gap (between rows). Inner gap (`x16`) is larger than outer gap (`x6`). Visual proximity therefore puts each date closer to the *next* title than to its own.

Choose gap values so that title-date pairs read as a single unit on `xs` while preserving comfortable horizontal breathing room on `sm+`.
