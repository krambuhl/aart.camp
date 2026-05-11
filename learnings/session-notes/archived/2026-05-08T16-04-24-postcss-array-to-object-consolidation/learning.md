# Learning draft

Mid-PR scope expansion — the project's `postcss.config.js` used Next.js's array-based plugin format (`['name', options]` tuples), which Vite (and therefore Storybook-with-Vite) does not accept. Rather than maintaining a Storybook-specific PostCSS override via `viteFinal` — two parallel configs to keep in sync — this PR converts `postcss.config.js` to the object-based format, which both Next.js and Vite accept per Storybook's own error guidance. Same pattern as Phase 1's substrate consolidation: when integration forces a scope expansion, prefer one config that works for both surfaces over two parallel configs.

_Draft auto-generated from `projects/2026-05-06-adopt-test-harnesses/checkins/ev.adopt-test-harnesses.storybook-harness/01.md` § Notes for the PR. The compaction pipeline (`/griot-compact`) will refine this draft if the judges don't accept it as-is._
