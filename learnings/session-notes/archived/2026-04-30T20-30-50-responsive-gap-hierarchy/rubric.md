# Rubric

_Immutable. Written by griot-rubric-author with fresh context. Any
attempt to modify this file is a hard violation._

- The inner row Stack's `gap` prop is a responsive object (e.g. `{ xs: ..., sm: ... }`) rather than a single fixed token value like `tokens.space.x16`
- On the `xs` breakpoint, the inner row Stack's gap resolves to a value strictly smaller than the outer column gap of `tokens.space.x6` (so the date visually pairs with its own title, not the next one)
- On the `sm` breakpoint (or larger), the inner row Stack's gap remains a comfortable horizontal spacing value (e.g. `tokens.space.x16` or similar), not collapsed to the tighter `xs` value
