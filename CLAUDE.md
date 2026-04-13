# aart.camp

Generative art portfolio — a collection of interactive p5.js sketches served
as a statically generated Next.js site. This is a creative coding playground,
not production software. Good enough is good enough.

## Commands

- `npm run dev` — dev server on port 3000
- `npm run build` — production build (SSG)
- `npm run lint` — ESLint
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

## Things to be careful about

- p5.js sketches must be client-rendered — the `<Sketch>` component uses
  dynamic import with SSR disabled.
- All sketch files need `'use client'` at the top.
