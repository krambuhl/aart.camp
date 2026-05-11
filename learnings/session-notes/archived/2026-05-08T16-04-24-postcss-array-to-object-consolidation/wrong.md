# What Claude produced

Bypassed `storybook init` in favor of a manual install — the init flow
is interactive (prompts framework choice, generates sample stories,
auto-edits config files) and would require post-cleanup of choices the
contract already nails down. Manual install gives full control over
what lands in the repo.

Three steps:

1. **Install deps**: `npm install --save-dev storybook@^10
   @storybook/nextjs-vite@^10 @storybook/addon-a11y@^10`. All three
   resolved to `10.3.6` (the current `latest` tag).

2. **Author config files**:
   - `.storybook/main.ts` uses the `defineMain` factory from
     `@storybook/nextjs-vite/node`. Story glob is
     `'../components/**/*.stories.@(tsx|mdx)'` — colocated, mirroring
     the Phase 1 pattern of putting tests next to their source.
   - `.storybook/preview.ts` uses the `definePreview` factory from
     `@storybook/nextjs-vite` with the a11y addon registered for type
     inference. Imports the **full app/layout.tsx CSS chain** in the
     same order: `the-new-css-reset/css/reset.css` → `tokens.css` →
     `globals.css`. This is a faithful interpretation of the contract's
     stated goal ("render with the project's actual visual environment")
     — token import alone leaves the body without reset + body
     background, which would mislead about the rendered environment.

3. **Wire up scripts + gitignore**: `package.json` gets
   `"storybook": "storybook dev -p 6006"` and
   `"build-storybook": "storybook build"`. `.gitignore` gets
   `storybook-static/`.

**Scope expansion (mid-flight)**: First `npm run build-storybook` failed
with `SB_FRAMEWORK_NEXTJS_0003 (IncompatiblePostCssConfigError)`. The
project's `postcss.config.js` used the array-based plugin format
(`['name', options]` tuples) which Next.js accepts but Vite — and
therefore Storybook-with-Vite — does not. Per Storybook's error
message, the **object-based format works in both Next.js and Vite**.

Converted `postcss.config.js` from array to object format
(mechanical, structure-preserving). Re-verified both
`npm run build-storybook` (now passes, 622ms) and `npm run build`
(Next.js, still passes — confirms the format is bidirectional).
Decision: one PostCSS config that both bundlers accept, vs. a
Storybook-specific `viteFinal` PostCSS override (two parallel
configs). Mirrors the Phase 1 "consolidate over coexist" pattern.

**Auto-generated stories cleanup**: Not needed — bypassing
`storybook init` means no `stories/` directory was created in the
first place. The contract criterion still applies in spirit (no sample
Button/Header in `main`), and the spirit is met.

**Token-application verification (hard evidence)**: After
`npm run build-storybook`, inspected the bundled iframe CSS at
`storybook-static/assets/iframe-CyTOrKec.css` and confirmed the
custom properties and body styles are present:

```
$ grep -o -E "\-\-space-x24|\-\-bg-base-default|\-\-fg-regular-default|font-family-body" \
    storybook-static/assets/iframe-CyTOrKec.css | sort -u
--bg-base-default
--fg-regular-default
--space-x24
font-family-body
```

This proves all three CSS files (`tokens.css`, `globals.css`, the reset)
are bundled into Storybook's preview iframe. Reproducible from the
build artifact — harder evidence than open-and-inspect, and the same
underlying claim PLAN.md flagged as risk #1 for this phase.

Additionally booted `npm run storybook` and confirmed the dev server
starts cleanly on port 6006 with no preview errors (the "EmptyIndexError"
is the expected "no stories yet" warning per D1's disqualifier list,
not a config failure).
