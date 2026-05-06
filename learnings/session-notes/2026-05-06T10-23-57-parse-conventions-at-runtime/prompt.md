A repo's substrate scripts (under `.claude/scripts/`) need access to a
shared closed vocabulary — the list of valid event names that
`MANIFEST.md` events tables can carry. The vocabulary is documented as
an `## Event vocabulary` markdown table in `projects/CONVENTIONS.md`, the
project's substrate-conventions reference document.

A migrated script needs to validate that a user-supplied `--event=<name>`
is in this vocabulary. The vocabulary is small (~13 entries), changes
rarely, and is the kind of thing you might encode as a TypeScript const.

Question: how should the script and the docs stay in sync? Options:
- A. Hardcode the vocabulary in the script + duplicate in CONVENTIONS.md
  (drift risk).
- B. Single source: a shared TS file like
  `.claude/scripts/_shared/manifest-schema.ts` that the script imports;
  CONVENTIONS.md table can be regenerated or referenced.
- C. The MD table is the source. Script parses CONVENTIONS.md at runtime.
- Hybrid: TS const file is the single source of truth, plus a drift test
  that asserts CONVENTIONS.md and the const stay in sync.

What's the cleanest option for substrate plumbing where multiple scripts
will eventually consume the same shapes? Don't worry about parse
performance unless it's actually a concern.
