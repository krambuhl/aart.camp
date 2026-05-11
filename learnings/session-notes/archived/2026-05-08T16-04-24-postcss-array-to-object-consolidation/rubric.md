# Rubric

_Immutable. Written by griot-rubric-author with fresh context. Any
attempt to modify this file is a hard violation._

- Output does not introduce a `viteFinal` PostCSS override or any Storybook-specific parallel PostCSS configuration in `.storybook/main.ts`
- Output converts `postcss.config.js` from array-tuple plugin format (e.g. `['plugin-name', options]`) to object-based plugin format (e.g. `{ 'plugin-name': options }`)
- Output frames the fix as a single shared config consumed by both Next.js and Vite/Storybook, rather than maintaining two parallel PostCSS configs
