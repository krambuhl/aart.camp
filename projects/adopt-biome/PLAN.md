# Adopt Biome, Drop ESLint

## Context

The project uses ESLint 8 with a fairly standard setup: TypeScript parser,
React plugin, Next.js config, Prettier compat, and import ordering. Stylelint
handles CSS separately. The ESLint config is old (eslint-config-next@13,
typescript-eslint@5) and would need significant upgrades to stay current.
Biome covers linting + formatting in one tool, is faster, and is simpler to
configure.

Stylelint stays — Biome doesn't lint CSS, and stylelint handles property
ordering and CSS Modules conventions that matter here.

## What we're replacing

**ESLint packages to remove (8 packages):**
- `eslint`
- `@types/eslint`
- `@typescript-eslint/eslint-plugin`
- `@typescript-eslint/parser`
- `eslint-config-next`
- `eslint-config-prettier`
- `eslint-plugin-import`
- `eslint-plugin-react`

**Config files to delete:**
- `.eslintrc.js`

## Rule mapping

Current ESLint rules → Biome equivalents:

| ESLint rule | Biome equivalent | Notes |
|---|---|---|
| `semi` | `javascript.formatter.semicolons: "always"` | Formatter |
| `quotes` | `javascript.formatter.quoteStyle: "single"` | Formatter |
| `indent` | `formatter.indentStyle: "space"`, `indentWidth: 2` | Formatter |
| `comma-dangle` | `javascript.formatter.trailingCommas: "all"` | Formatter |
| `no-trailing-spaces` | Handled by formatter | Automatic |
| `no-multi-spaces` | Handled by formatter | Automatic |
| `padded-blocks` | Handled by formatter | Automatic |
| `block-spacing` | Handled by formatter | Automatic |
| `brace-style` | Handled by formatter | Automatic |
| `no-multiple-empty-lines` | Handled by formatter | Automatic |
| `curly` | `style.noUselessElse` + formatter | Partial |
| `func-style` | No direct equivalent | Drop — not critical |
| `default-case` | `nursery.useDefaultSwitchClause` | Available |
| `import/order` | `organizeImports` | Built-in, auto-fixable |
| `import/first` | Covered by organizeImports | |
| `import/newline-after-import` | Covered by organizeImports | |
| `import/no-duplicates` | `noRedundantImports` (upcoming) | |
| `@typescript-eslint/recommended` | `recommended: true` | Built-in |
| `react/recommended` | Built-in JSX support | |

Most ESLint rules are either formatter concerns (Biome handles automatically)
or part of Biome's recommended ruleset. We lose `func-style` and
`import/no-anonymous-default-export` — neither is critical for this project.

## Existing eslint-disable comments

16 occurrences across 9 files. Most are legitimate exceptions for p5.js
sketch code (`no-explicit-any`, `no-non-null-assertion`, `prefer-const`,
`no-constant-condition`). These will need to be converted to Biome's
suppression format or the underlying issues addressed.

Biome uses inline comments: `// biome-ignore lint/suspicious/noExplicitAny: reason`

## Phases

### Phase 1: Setup — Add Biome alongside ESLint

**PR 1: Add biome.json and format the codebase**

1. `npm install --save-dev --exact @biomejs/biome`
2. Create `biome.json` with equivalent rules:
   ```json
   {
     "$schema": "https://biomejs.dev/schemas/latest/schema.json",
     "vcs": { "enabled": true, "clientKind": "git", "useIgnoreFile": true },
     "formatter": {
       "indentStyle": "space",
       "indentWidth": 2,
       "lineWidth": 120
     },
     "javascript": {
       "formatter": {
         "semicolons": "always",
         "quoteStyle": "single",
         "trailingCommas": "all"
       }
     },
     "organizeImports": { "enabled": true },
     "linter": {
       "enabled": true,
       "rules": { "recommended": true }
     },
     "files": {
       "ignore": [
         "node_modules",
         ".next",
         "styles/tokens.css",
         "tokens/tokens.ts",
         "tokens/breakpoints.ts",
         "utilities/postcss-functions"
       ]
     }
   }
   ```
3. Run `npx biome format --write .` to format the entire codebase
4. Run `npx biome check --fix .` to apply safe lint fixes
5. Convert eslint-disable comments to biome-ignore where needed
6. Add scripts to package.json:
   - `"lint": "biome check ."`
   - `"format": "biome format --write ."`
   - `"check": "biome check --write ."`

### Phase 2: Remove ESLint

**PR 2: Remove ESLint and related config**

1. `npm uninstall eslint @types/eslint @typescript-eslint/eslint-plugin @typescript-eslint/parser eslint-config-next eslint-config-prettier eslint-plugin-import eslint-plugin-react`
2. Delete `.eslintrc.js`
3. Verify `npm run lint` (now Biome) passes clean
4. Verify `npm run build` still works

### Phase 3: Cleanup

**PR 3: Optional — tighten Biome config**

1. Review Biome diagnostics and decide which rules to enable/disable
   beyond `recommended`
2. Consider enabling `noExplicitAny` for non-sketch code (sketches can
   use biome-ignore)
3. Update CLAUDE.md to reference Biome instead of ESLint

## Files touched

- Create: `biome.json`
- Delete: `.eslintrc.js`
- Modify: `package.json` (deps + scripts)
- Modify: 9 files with eslint-disable → biome-ignore conversions
- Modify: potentially all `.ts`/`.tsx` files (formatter pass)

## Verification

- `npx biome check .` passes clean
- `npm run build` succeeds
- `npm run lint` runs Biome
- Stylelint still works independently (`npx stylelint "**/*.css"`)

## Open questions

- **Line width**: Current ESLint has no max line width. Biome defaults to 80.
  120 is a reasonable middle ground — or we can go wider. Worth deciding
  before the format pass since it touches every file.
- **Stylelint future**: Biome is adding CSS support. Once it lands, stylelint
  could be replaced too — but that's a separate project.
