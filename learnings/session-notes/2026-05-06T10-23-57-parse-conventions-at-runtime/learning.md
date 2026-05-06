When a substrate script needs a closed vocabulary or schema that's
already documented in a project markdown file (e.g. `CONVENTIONS.md`),
parse the markdown at runtime. Do not propose a shared TypeScript const
file plus a drift-detection test as the recommended approach — that
introduces three artifacts (const, MD, drift test), three places to
update on every vocabulary change, and a whole class of synchronization
bugs that disappear if the script just reads the source of truth
directly.

Parsing a small markdown table is sub-millisecond (single-digit
microseconds per parse for files under a few hundred lines), so
performance is not a concern for the kind of substrate work this
applies to. Provide a hardcoded fallback only as a defensive measure
for the unreadable-file case, with a comment noting the file is the
authority. Resist the instinct to "type-safe everything by extracting
to a const" — when there's already one source of truth in human-
readable form, keep it that way.
