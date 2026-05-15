# Antagonist-panel smoke-test fixtures

Stable test infrastructure for the `evaluator-*` agent family. Each
fixture is hand-authored to intentionally trip specific catalog hits
on one or more evaluators, so that smoke tests of the multi-evaluator
panel (via `derive-panel.ts` + `/guild-validate`) can verify
end-to-end that the panel composes correctly, spawns the expected
agents, and aggregates findings with the right blocking/advisory
split.

## Why this lives in `.claude/scripts/guild/`

Co-located with the consuming scripts (`derive-panel.ts`,
`parse-and-aggregate.ts`) rather than with the agents being tested —
the test runner is the substrate scripts; the agents are the system
under test. Path is outside Biome's `files.includes` (in `biome.json`)
and outside `check-nextjs.ts`'s hardcoded `SCOPE_DIRS = ['app',
'components', 'sketches']`, so the antipatterns do not pollute
repo-wide CLI signals. The fixtures are also not imported anywhere
in the build graph — they are dead code from Next.js's perspective.

## Convention: write-once, read-many

Fixtures are intended to be authored once and read by many smoke
tests over the lifetime of the substrate. Modifying a fixture should
be deliberate (an evaluator's catalog grew, an antipattern's name
changed, a new fixture is needed for a new catalog entry) — never as
a side-effect of unrelated work.

Because fixtures are write-once, derive-panel.ts does NOT have a
carve-out for this directory. If a unit DOES touch a fixture
(intentionally or not), the file will show up in `git status` and
flow into derive-panel's input. In that case the caller should
manually exclude the fixture from the derive-panel input list,
documenting the override in the unit's checkin Notes for the PR
section with a `correction:` prefix — same shape as the L-004
session-boundary override pattern.

## Fixtures

Each fixture's header comment documents what catalog hits it targets.
Quick index:

| File | Targets |
|------|---------|
| `BadImage.tsx` | `evaluator-a11y` (a11y-img-no-alt, a11y-button-no-name), `evaluator-nextjs` (nextjs-use-client-unused) |
| `bad-tokens.module.css` | `evaluator-tokens` (tokens-hex-literal, tokens-hardcoded-spacing, tokens-hardcoded-typography) |
| `BadNaming.tsx` | `evaluator-naming` (naming-abbreviation-export, naming-hungarian, naming-boolean-form) |

## Adding a fixture

1. Identify the catalog hit(s) the fixture should trip — cite the
   relevant `evaluator-*.md`'s catalog table by code.
2. Author the fixture with a header comment naming the targets and
   the convention note (point to this README).
3. Keep the fixture small and well-formed (typechecks under the
   repo's tsconfig — no compiler errors). The antipatterns are
   semantic, not syntactic.
4. Update the index table above.
5. Verify the fixture does not leak into `npm run lint`, `npm run
   build`, or `npm run lint:nextjs` outputs.

## Use

A smoke test typically runs:

```bash
node .claude/scripts/guild/derive-panel.ts \
  --files=.claude/scripts/guild/__smoke-fixtures__/BadImage.tsx,\
.claude/scripts/guild/__smoke-fixtures__/bad-tokens.module.css,\
.claude/scripts/guild/__smoke-fixtures__/BadNaming.tsx
```

Then invokes `/guild-validate` with the derived panel and a dense
packet pointing at the fixture paths. The captured verdicts go into
the smoke test's own results document (typically a project-scoped
`smoke-results.md`), keeping the evidence tied to the smoke run
rather than the fixture set.

## Provenance

Authored in the Phase 2 D8 smoke test of the
`2026-05-02-agent-guilds` project (2026-05). See
`projects/2026-05-02-agent-guilds/testbed/smoke-results.md` for
the original captured verdicts.
