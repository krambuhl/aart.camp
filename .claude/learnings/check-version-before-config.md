Before writing configuration for a newly installed tool, check its version and schema. Don't assume config syntax from memory — it may be outdated (e.g., Biome 2.x changed `files.ignore` to `files.includes` and moved `organizeImports` under `assist`).

**Why:** Wrote biome.json with v1 syntax for a v2 install, required two config rewrites before it worked.

**How to apply:** After `npm install`, run `--version` and check the tool's current config schema before writing any config file.
