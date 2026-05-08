# Learning draft

D1 shipped `addons: [a11y]` in `.storybook/preview.ts`, but `@storybook/addon-a11y`'s default export is a factory function (`() => PreviewAddon<A11yTypes>`), not the addon itself. The bug was latent — no file imported `preview.ts` until this story did, so TypeScript never deep-checked it. D2's new story imports `preview.ts`, which surfaces the type error during `npm run build`. Fix is one character: `[a11y]` → `[a11y()]`. Lesson: a config file with no inbound imports gets only shallow type-checking; for harnesses, write a smoke import (or smoke story) early to flush latent type errors.

_Draft auto-generated from `projects/2026-05-06-adopt-test-harnesses/checkins/ev.adopt-test-harnesses.storybook-harness/02.md` § Notes for the PR. The compaction pipeline (`/griot-compact`) will refine this draft if the judges don't accept it as-is._
