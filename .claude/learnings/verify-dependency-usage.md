Before upgrading or removing a dependency, grep for it across ALL file types — not just the ones you expect. A package might only be used in a build script, a PostCSS config, or a non-standard file extension.

**Why:** Removed `set-value` after grepping only `.ts`/`.tsx` files. It was used in `scripts/generate-tokens.ts` which was caught by the build but should have been caught by the search.

**How to apply:** Use `grep -r "package-name" --include='*'` or similar broad search before removing any dependency. Removal > upgrade, but verify first.
