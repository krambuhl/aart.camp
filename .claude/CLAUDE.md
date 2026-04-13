# aart.camp

Generative art portfolio — a collection of interactive p5.js sketches served
as a statically generated Next.js site. This is a creative coding playground,
not production software. Good enough is good enough.

## Commands

- `npm run dev` — dev server on port 3000
- `npm run build` — production build (SSG)
- `npm run lint` — Biome (linting)
- `npm run check` — Biome (lint + format, auto-fix)
- `npm run format` — Biome (format only, auto-fix)
- `npm run generate:tokens` — regenerate design tokens from `tokens/design-tokens.json`

## Stack

Next.js (App Router), React, TypeScript, CSS Modules, p5.js, PostCSS.
No Tailwind, no CSS-in-JS. Deployed on Vercel.

## Adding a new sketch

1. Copy an existing sketch from `sketches/`, rename with the next number
   prefix (e.g., `53-name.tsx`). Each sketch is a `'use client'` component
   that exports `meta` (title, date) and a default component wrapping
   `<Area>` + `<Sketch setup={...} draw={...} />`.
2. Add an entry to `sketches/registry.ts` — this is the single source of
   truth for all sketches. The page shell (`app/sketch/[slug]/page.tsx`)
   handles layout, metadata, and `PageHeader` automatically.

## Design tokens

Source of truth is `tokens/design-tokens.json`. After editing it, run
`npm run generate:tokens` to regenerate `tokens/tokens.ts`,
`tokens/breakpoints.ts`, `styles/tokens.css`, and the PostCSS function data.

## CSS conventions

- CSS Modules (`.module.css`) for all component styles
- PostCSS functions: `token("space.x24")` resolves to CSS custom properties
- `@each` + `map-breakpoints()` generates responsive class variants
- Responsive props use the `Responsive<T>` type and `wrapResponsive()` utility

## Shared components

`Stack`, `Grid`, `Spacer`, `Area`, `Text`, `Card`, `PageHeader`, `AppLayout`
live in `components/shared/`. These are stable infrastructure — don't
over-engineer or refactor them unless there's a reason. Pattern exploration
is welcome but keep it proportional.

## Skills

This project has a skill system in `.claude/skills/`. Skills are reusable
workflows that can be invoked directly or composed by the orchestrator.

### The core loop

`/project-loop [name] [goal]` orchestrates the full lifecycle:

```
plan → generate → validate → skeptic → commit + learn → checkpoint
                                                 ↓
                                          more tasks? loop back
```

### Individual skills

| Skill | Role | When |
|---|---|---|
| `/create-plan` | Turn fuzzy goals into structured plans | Start of a project |
| `/generate` | Create high-quality, consistent work | Each task in the plan |
| `/validate` | Verify work is complete and correct | After generation |
| `/natural-skeptic` | Find holes, challenge assumptions | Before every commit |
| `/self-improvement` | Capture learnings, improve the system | Before every commit |
| `/manifest` | Scope projects, track progress | Start + after each commit |

### The generator / antagonist pattern

Two ambient behaviors form a pair that runs before every commit:

- The **generator** produces — plans, code, improvements. It moves forward.
- The **antagonist** pressure-tests — "is this needed?", "what did we
  skip?". It finds holes, not solutions.

`/natural-skeptic` and `/self-improvement` are not ceremonies — they're
habits. Lightweight and silent when there's nothing to say. Sharp when
there is.

### Learnings

Lessons from past sessions live in `.claude/learnings/` — version
controlled, not ephemeral. Read them at the start of a session. When
self-improvement produces a new learning, write it there as a short
markdown file (what happened, why it matters, how to apply it).

## Things to be careful about

- p5.js sketches must be client-rendered — the `<Sketch>` component uses
  dynamic import with SSR disabled.
- All sketch files need `'use client'` at the top.
