# Panel composition

This file is the panel-assembly spec for the `evaluator-*` family. It
documents how an antagonist panel is composed from an artifact's file
list (auto-derivation), the precedence order used for overlap
resolution, and the boundary between the two most-likely-overlapping
domain evaluators (tokens and naming).

It is **not** a callable agent. There is no frontmatter — the agent
loader skips files without a `name:` field, so spawning
`subagent_type: PANEL-COMPOSITION` is not a thing. Sibling docs that
follow the same pattern: `evaluator-base.md` (which DOES have a `name:`
field but explicitly disclaims being normally callable) and the future
`griot-base.md` family doc.

Three audiences read this file:

- `/ev-loop-interactive` and `/ev-loop-confidence` skills, at the
  auto-derivation step where a panel is assembled from the unit's
  changed/created files. The skill body's prose (or a helper script
  it shells out to) follows the algorithm in § "How auto-derivation
  reads this spec".
- `/guild-validate`, when it aggregates findings from a multi-
  evaluator panel and needs an ordering to dedup overlapping
  findings. The precedence list in § "Precedence" is the source of
  truth.
- Humans authoring panels manually (custom one-off invocations,
  whiteboard-style "let me get a second lens on this") who want to
  know which evaluators to include for a given file set.

## File-type → evaluator mapping

The composer walks every changed or created file in the unit's
artifact and, for each, adds the evaluators below to the panel set.
The set is a `Set` — adding the same evaluator twice from two
different files is a no-op.

| File pattern | Evaluators added |
|--------------|------------------|
| `(any file)` | `evaluator-contract-fit` (baseline, always included) |
| `*.tsx`, `*.jsx` | `evaluator-react-api`, `evaluator-naming`, `evaluator-a11y` (when the JSX renders visible UI), `evaluator-nextjs` (when the file is Next-aware: a route file like `app/**/page.tsx`, contains `'use client'` directive, or exports `getServerSideProps` / `getStaticProps` / `generateMetadata` / `loader` / `action`) |
| `*.ts` (non-JSX) | `evaluator-react-api` (only when the file imports from `react` or `react-dom`), `evaluator-naming` |
| `*.module.css` | `evaluator-tokens`, `evaluator-naming` (class names are public API surface for the colocated component) |
| `*.css` (non-module, e.g. `globals.css`, `tokens.css`) | `evaluator-tokens` (caveat: each evaluator's own carve-outs handle source-of-truth files; the composer still adds the lens) |
| Files under `sketches/` | Same mapping as `*.tsx` based on extension; trust each evaluator's `sketches/`-specific carve-outs to suppress flags on p5 idioms (single-letter math vars, `setup`/`draw` callbacks, intentional literal colors as artistic statement) |
| `*.md` | `evaluator-contract-fit` only — domain evaluators don't apply to prose documents |
| `*.json`, `package.json`, lock files | `evaluator-contract-fit` only |
| `.claude/agents/*.md`, `.claude/skills/*/SKILL.md`, `projects/**/checkins/**/*.md` | `evaluator-contract-fit` only — this is substrate authoring; domain evaluators don't apply to agent definitions, skill bodies, or checkin files |
| `.claude/scripts/**/*.ts` (substrate scripts) | `evaluator-contract-fit`, `evaluator-naming` (script identifiers / function names are public-API surface for substrate consumers) |
| `.claude/scripts/**/*.test.ts` (substrate tests) | `evaluator-test-unit` — vitest antipattern catalog applies; the naming evaluator's `test files` carve-out still applies |
| `.claude/cli/**/*.ts` (substrate CLI) | `evaluator-contract-fit`, `evaluator-naming` — same rationale as `.claude/scripts/`; CLI verb names + exported types are public-API surface for loops and humans |
| `.claude/cli/**/*.test.ts` (substrate CLI tests) | `evaluator-test-unit` — vitest antipattern catalog applies; same rationale as substrate scripts |
| `*.test.ts`, `*.test.tsx`, `*.spec.ts`, `*.spec.tsx` (general test files; more-specific paths below override) | `evaluator-test-unit` — vitest unit-test antipattern catalog |
| `tests/e2e/**`, `tests/integration/**`, `e2e/**` | `evaluator-test-integration` — Playwright integration-test antipattern catalog; the `tests/e2e/a11y/**` subtree overrides below |
| `tests/e2e/a11y/**` | `evaluator-a11y` — a11y test specs run via `playwright.config.a11y.ts` are accessibility's lane, not test-integration's |

### Union rule

When an artifact touches multiple file types, the composed panel is
the **union** of per-file evaluator sets, plus the always-on
`evaluator-contract-fit`. Duplicates dedup to one entry per
evaluator. Order follows the precedence list below (not the order
files were encountered) so `/guild-validate`'s spawn step gets a
deterministic ordering.

Example: a unit that creates one `.tsx` and one `.module.css` and
modifies one `package.json` composes to:
`[evaluator-contract-fit, evaluator-a11y, evaluator-nextjs?,
evaluator-react-api, evaluator-tokens, evaluator-naming]` — where
`evaluator-nextjs` is conditional on the `.tsx` being Next-aware.

### When the panel reduces to just contract-fit

If every changed file falls in a "contract-fit only" bucket
(substrate authoring, project docs, lockfiles), the composed panel
is `[evaluator-contract-fit]` — the same single-agent panel
`/ev-loop-*` skills run today. The auto-derivation degrades
gracefully to the current behavior when no domain lens applies.

## Precedence

The ordered list below determines (a) the spawn order
`/guild-validate` passes to `/guild-spawn`, and (b) the dedup winner
when two evaluators flag the same `file:line` with compatible
remedies. Higher position = higher precedence.

1. **`evaluator-contract-fit`** — the baseline. Contract
   violations trump every domain concern: if the unit's acceptance
   criteria aren't met, no domain finding matters until the
   contract holds.
2. **`evaluator-a11y`** — accessibility outcomes have real user
   impact. A flag here represents harm to a real person using the
   product; that beats every aesthetic or framework concern.
3. **`evaluator-nextjs`** — framework correctness. If Next-specific
   patterns are wrong (hydration mismatch, missing `'use client'`,
   incorrect route export shapes), the artifact may not run at all
   in production. High stakes, but downstream of a11y because the
   broken artifact may still build.
4. **`evaluator-css-architecture`** (Phase 4 specialist) —
   structural CSS correctness when paired with
   `generator-css-codemod`. Selector specificity, cascade
   behavior, composition vs. duplication, `:global` leakage,
   shared-primitive bypass, sketch-CSS load-bearing-pattern
   regressions. Elevated precedence over `evaluator-react-api`
   because cascade fragility produces visual breakage; bumped
   below `evaluator-nextjs` because a build that won't ship is
   more urgent than one that ships fragile.
5. **`evaluator-react-api`** — runtime correctness within React
   itself (hooks rules, state mutation, ref-in-render). These don't
   crash the build but produce subtle runtime bugs.
6. **`evaluator-test-integration`** — integration-test correctness
   in production-shipped test code. Bad fixtures, parallel-unsafe
   state, hardcoded waits produce false confidence — a green suite
   that doesn't catch real user-facing regressions. Above tokens
   because false-confidence regressions ship to users; below
   react-api because the test harness itself doesn't run in
   production.
7. **`evaluator-test-unit`** — unit-test correctness in
   production-shipped test code. Mock-vs-real boundaries, isolation
   failures, focused/skipped tests. Lower than integration tests
   because unit-test antipatterns mask narrower failure modes (a
   single function's behavior) than integration-test antipatterns
   (a whole user flow).
8. **`evaluator-tokens`** — design-system drift. Bypassing the
   token system doesn't break the artifact at runtime, but it
   drifts the visual system over time.
9. **`evaluator-naming`** — rhetoric and readability. The lowest-
   stakes lens in the panel; flags here affect how code reads, not
   whether it works.

**Rationale for the ordering**: blast radius. Contract failures are
unit-fatal. Accessibility failures harm users. Framework breakage
prevents shipping. CSS-architecture fragility produces visual
breakage on shipped code. Runtime correctness produces hidden bugs.
Test-suite antipatterns produce false confidence (integration above
unit because broader scope masks more). Token drift degrades the
visual system. Naming affects comprehension. Each step down the
list is a smaller blast radius.

### Conflict vs overlap

These are different operations on the panel result:

- **Overlap** (compatible remedies on the same scope): the
  higher-precedence evaluator's finding wins; the lower's is
  suppressed in the consolidated list. Both evaluators ran and
  saw the same thing; the panel speaks with the higher-precedence
  voice to avoid reviewer noise.
- **Conflict** (incompatible remedies on the same scope, where
  applying both would brick the artifact): this is `flagged-
  conflict` per `/guild-validate`'s aggregation rules. v1 of
  `/guild-validate` documents this as a future-work case (real
  implementation deferred until a conflict actually shows up in
  practice). When it does, this section gets a concrete resolution
  policy — until then, precedence resolves the easy cases and
  conflicts surface for human review.

## Tokens-vs-naming-vs-architecture three-way boundary

Three evaluators can flag the same `.module.css` line:
`evaluator-tokens` (Phase 2 D4), `evaluator-naming` (Phase 2 D5),
and `evaluator-css-architecture` (Phase 4). The boundary among the
three is consolidated here.

The clean test, when a single line could match more than one
evaluator's catalog:

- **"This line should use a token instead of a literal"** →
  `evaluator-tokens`. The artifact is using `#ff0000` where a
  `token(...)` would apply.
- **"This token is the wrong name for the role"** →
  `evaluator-naming`. The artifact uses `token("color.gray.200")`
  where `token("color.background.surface")` is the semantic
  choice.
- **"This line's selector / cascade / structure will fight the
  rest of the file or codebase"** →
  `evaluator-css-architecture`. The artifact's structural shape
  is fragile, regardless of which tokens or names it uses.

The vocabulary axis (tokens) and the right-name axis (naming) are
upstream of the structure axis (architecture). Architecture
assumes vocabulary is correct and grades the *shape* of the CSS
that uses it.

When two evaluators flag the same scope with compatible remedies,
**`evaluator-css-architecture` wins overlap-resolution** when
paired with `generator-css-codemod` (its elevated-precedence
pairing); otherwise, the precedence list above resolves the tie.

### Tokens-vs-naming sub-boundary

The original two-way boundary between `evaluator-tokens` (D4) and
`evaluator-naming` (D5) — these are the two evaluators that
overlap most often on artifact lines independent of codemod work.

### D4 owns the literal-vs-token decision

Is the artifact using ANY token vs a hardcoded literal value?

| Pattern | Flag |
|---------|------|
| `color: #ff0000;` in a `.module.css` | `tokens-hex-literal` |
| `color: red;` in a `.module.css` | `tokens-named-color` |
| `padding: 16px;` where `token("space.xN")` exists | `tokens-hardcoded-spacing` |
| `font-size: 14px;` where `token("fontFamily.*")` / size tokens exist | `tokens-hardcoded-typography` |
| `@media (min-width: 588px)` instead of `map-breakpoints()` | `tokens-hardcoded-breakpoint` |
| `style={{ color: '#abc', padding: 16 }}` in JSX | `tokens-inline-literal-style` |
| Runtime `import { tokens } from '@/tokens'` for `style={}` use | `tokens-runtime-style-import` |

All seven D4 entries fire on **literals where a token would apply**.

### D5 owns the right-name decision and broader naming

Given two valid tokens (or two valid identifiers), which is
semantically correct? Plus identifier choices outside the token
system entirely.

| Pattern | Flag |
|---------|------|
| `token("color.gray.200")` where `token("color.background.surface")` is the semantic choice | `naming-visual-literal` |
| Component named `<BlueButton>` instead of `<PrimaryButton>` | `naming-visual-literal` |
| CSS Module class `.darkBar` where `.appHeader` is the semantic name | `naming-visual-literal` |
| New `<Container>` introduced when the established `<Area>` already covers the role | `naming-inconsistent-vocab` |
| `colorString`, `itemArray`, `iCount` | `naming-hungarian` |
| `<Section header>` boolean prop named as a noun instead of `<Section showHeader>` | `naming-boolean-form` |
| Exported `<Btn>` / `useMsg` / `fmt()` from a module | `naming-abbreviation-export` |
| Exported `useFormikSubmit` / `withMobxObserver` / `memoizedCache` | `naming-implementation-leak` |
| Sketch file named `mySketch.tsx` instead of `NN-slug.tsx`; component dir `pageHeader/` instead of `PageHeader/` | `naming-file-convention` |

D5 reaches well beyond the token system — component / hook / prop /
file / directory naming all live here.

### Concrete examples — which evaluator fires?

- `.module.css` rule using `color: #ff0000;` → **D4**
  (`tokens-hex-literal`). The artifact is using a literal where ANY
  token applies. D5 doesn't reach raw CSS-property values.

- `.module.css` rule using `color: token("color.gray.200");` where
  `token("color.background.surface")` is the semantic choice → **D5**
  (`naming-visual-literal`). The artifact IS using the token system;
  the name within the system is what's wrong.

- JSX `<BlueButton onClick={...}>` for a primary CTA → **D5**
  (`naming-visual-literal`). Component name describes appearance,
  not role. D4 doesn't reach JSX component names.

- New sketch file `sketches/sweepingLines.tsx` (camelCase instead
  of `NN-slug.tsx`) → **D5** (`naming-file-convention`). File
  naming. D4 has nothing to say.

- Inline `<div style={{ background: '#abc' }}>` in a `.tsx` →
  **D4** (`tokens-inline-literal-style`). Hardcoded literal where
  the design system would apply. D5 might also flag the prop
  shape (`style` on a div for design-system styling) but that's a
  composability concern, not a naming one.

## How auto-derivation reads this spec

D7 implements this; the algorithm follows directly from § "File-
type → evaluator mapping":

1. **Collect files.** Read the unit's changed and created files
   (the artifact summary's `Files` section or `git diff --name-
   only` against the base).
2. **Per-file lookup.** For each file, look up the applicable
   evaluator set from the table. Apply conditional rules (e.g.,
   `.ts` only adds `react-api` if the file imports `react`; `.tsx`
   only adds `nextjs` if Next-aware).
3. **Union.** Build the set of evaluators across all files.
4. **Always-include.** Add `evaluator-contract-fit` if not already
   present. (For unions over the table above, it always will be —
   `contract-fit` is the row-zero entry. The always-include step
   covers degenerate cases where the file list is empty.)
5. **Order.** Sort the resulting list by the precedence section
   above (highest precedence first). This is the agent list passed
   to `/guild-validate`.

The algorithm produces a single sorted list of evaluator
`subagent_type` names. `/ev-loop-*` passes it to `/guild-validate`
as the `agents=...` argument, replacing today's hardcoded
`agents: evaluator-contract-fit` line.

### Override and opt-out

Two escape hatches are available without touching this spec:

- **Per-phase override** in `PLAN.md`: a phase can name an explicit
  panel (`panel: [evaluator-contract-fit, evaluator-tokens]`) that
  overrides auto-derivation for every unit in the phase. Useful
  for phases doing focused work where auto-derivation would
  over-include lenses that consume budget without adding signal.
- **Per-unit override** in the contract: a unit's contract can
  add a `Panel:` line naming evaluators that should be added or
  removed from the auto-derived list (e.g., `Panel: +evaluator-
  css-architecture` to add a specialist, `Panel: -evaluator-
  nextjs` to suppress a lens). This is a Phase 4-shaped concern
  (domain pairs) — documented here for future reference, not
  required for D7's MVP.

## Cross-references

Each domain evaluator has its own "Boundary with adjacent
evaluators" section that covers the per-evaluator nuance:

- `.claude/agents/evaluator-a11y.md` — boundary with tokens
  (contrast vs literal-vs-token) and react-api (semantic HTML vs
  hook usage)
- `.claude/agents/evaluator-nextjs.md` — boundary with react-api
  (framework vs runtime correctness) and naming (library-imposed
  names carve-out)
- `.claude/agents/evaluator-react-api.md` — boundary with nextjs
  (runtime vs framework) and naming (API surface vs identifier
  choice)
- `.claude/agents/evaluator-test-integration.md` — boundary with
  a11y (axe-core scans defer to a11y; test shape stays here),
  test-unit (tier choice at file boundary), react-api (fixture
  components), and whiteboard-testing-strategy (design vs review
  phase)
- `.claude/agents/evaluator-test-unit.md` — boundary with
  test-integration (tier choice), naming (test-file naming
  carve-out), react-api (production code under test), and
  whiteboard-testing-strategy (design vs review phase)
- `.claude/agents/evaluator-tokens.md` — boundary with naming
  (literal-vs-token vs right-name) and a11y (contrast outcomes)
- `.claude/agents/evaluator-naming.md` — boundary with tokens
  (right-name vs literal-vs-token) and the other three lenses

The per-evaluator sections remain the source of truth for their
own boundary text. This file consolidates the cross-cutting
view and is the source of truth for **panel-level** decisions
(composition, precedence, conflict policy).
