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

Next.js (Pages Router), React, TypeScript, CSS Modules, p5.js, PostCSS.
No Tailwind, no CSS-in-JS. Deployed on Vercel.

## Project direction

- **App Router migration** is a planned future move, along with improving the
  loading experience for individual sketches.
- The directory listing system (`lib/directory.ts` + meta extraction from
  sketch files) is a known pain point — it's fragile and annoying.

## Adding a new sketch

Copy an existing sketch from `pages/sketch/`, rename it with the next number
prefix (e.g., `53-name.tsx`), and modify. Each sketch exports a `meta` object
and a default component that uses `<Sketch setup={...} draw={...} />`.

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
- The meta extraction in `lib/directory.ts` uses regex + dirty-json to parse
  exports from sketch files. It's brittle. Don't assume it handles edge cases.
