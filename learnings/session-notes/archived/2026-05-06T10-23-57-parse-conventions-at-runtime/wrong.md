Initial proposal — the hybrid:

> **Shared schemas:** `.claude/scripts/_shared/manifest-schema.ts` exports
> vocabularies, types; CONVENTIONS.md keeps the human table; a drift test
> in `_shared/manifest-schema.test.ts` parses CONVENTIONS.md and asserts
> set equality

The reasoning: get machine-checked correctness for scripts AND keep the
MD table readable for humans. The drift test was meant to catch
divergence in CI early, "low cost," "the hybrid gets you the best of
both worlds."

Concretely the proposed shape was a `_shared/` directory with a
`manifest-schema.ts` exporting `eventVocabulary`, `phaseStatuses`, etc.,
plus a sibling `.test.ts` that parses the MD table and asserts equality.
Three artifacts (TS const, MD table, drift test), three places to update
when the vocabulary grows.

This was offered as the "recommended" option of three (MD-only,
TS-only, hybrid).
