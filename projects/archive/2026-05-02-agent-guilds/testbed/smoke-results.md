# Smoke-test results — Phase 2 D8

**Date**: 2026-05-15
**Branch**: `ev.agent-guilds.antagonist-evaluator-panel-8`
**Checkin**: `checkins/ev.agent-guilds.antagonist-evaluator-panel-8/01.md`

Multi-evaluator antagonist-panel smoke test exercising the full Phase 2
panel composition. Two passes: synthetic fixtures with intentional
catalog hits (Pass A) and a clean in-tree component (Pass B). Both
passes run against the precedence-ordered six-evaluator panel derived
by `node .claude/scripts/guild/derive-panel.ts`. Verdicts captured
verbatim from `parse-and-aggregate.ts`.

## Pass A — Synthetic fixtures (catalog-hit verification)

### Derive-panel invocation

```
$ node .claude/scripts/guild/derive-panel.ts \
    --files=.claude/scripts/guild/__smoke-fixtures__/BadImage.tsx,\
.claude/scripts/guild/__smoke-fixtures__/bad-tokens.module.css,\
.claude/scripts/guild/__smoke-fixtures__/BadNaming.tsx

evaluator-contract-fit,evaluator-a11y,evaluator-nextjs,evaluator-react-api,evaluator-tokens,evaluator-naming
```

Precedence order matches `PANEL-COMPOSITION.md`. All six expected
evaluators present in the panel. `evaluator-contract-fit` baseline
first.

### /guild-validate invocation

Skill: `guild-validate`, composing `guild-spawn`.

- `agents`: the comma-separated stdout of `derive-panel.ts` above.
- `packet`: dense packet per **L-009**, structured as
  `## How to evaluate efficiently` (budget instruction + smoke-test
  framing) → `## Contract (paraphrased)` (six ACs for the
  hypothetical "author intentionally-flawed fixtures" unit) →
  `## Artifact` (file list + pre-computed `npm run lint`,
  `npm run build`, `npm run lint:nextjs`, `derive-panel.ts` outputs +
  per-AC file:line mappings) → `## Original ask` (PLAN.md Phase 2
  verification clause) → `## Suggested spot-check` (one
  `Read BadImage.tsx`).

### Per-evaluator verdicts (verbatim final lines)

| Evaluator | Verdict | Catalog hits |
|-----------|---------|--------------|
| `evaluator-contract-fit` | `approved` | none — six ACs met by fixture set |
| `evaluator-a11y` | `flagged` | `a11y-missing-alt` (BadImage.tsx:25), `a11y-icon-button-no-name` (BadImage.tsx:26-28) — **both blocking** |
| `evaluator-nextjs` | `approved` (with advisory) | `nextjs-use-client-vacuous` (BadImage.tsx:1) — **advisory** |
| `evaluator-react-api` | `approved` | not applicable: fixtures are stateless functional components with no hooks/state/effects/lists/context/refs |
| `evaluator-tokens` | `flagged` | `tokens-hex-literal` (bad-tokens.module.css:15, :16), `tokens-hardcoded-spacing` (:17, :18), `tokens-hardcoded-typography` (:22, :23) — **all advisory** |
| `evaluator-naming` | `flagged` | `naming-abbreviation-export` (BadNaming.tsx:19), `naming-boolean-form` (:15), `naming-hungarian` (:20) — **all advisory** |

### Aggregator output (parse-and-aggregate.ts)

```json
{
  "verdict": "flagged",
  "blocking_findings": [
    {
      "evaluator": "evaluator-a11y",
      "code": "a11y-missing-alt",
      "evidence": "BadImage.tsx:25 — <img src={src} /> lacks alt",
      "remedy": "Add alt=\"\" (decorative) or alt={caption} or alt={descriptive-text} to the <img>"
    },
    {
      "evaluator": "evaluator-a11y",
      "code": "a11y-icon-button-no-name",
      "evidence": "BadImage.tsx:26-28 — <button> whose only child is <span aria-hidden=\"true\">×</span>, no aria-label",
      "remedy": "Add aria-label=\"Close\" (or similar) to the <button>, or replace aria-hidden span with visible text"
    },
    {
      "evaluator": "evaluator-react-api",
      "code": "parse-failure",
      "evidence": "no VERDICT: line found in output (expected `VERDICT: approved` or `VERDICT: flagged`)",
      "remedy": ""
    }
  ],
  "advisory_findings": [
    { "evaluator": "evaluator-tokens", "code": "tokens-hex-literal", "evidence": "bad-tokens.module.css:15 — color: #ff0000", "remedy": "Replace #ff0000 with token(\"fg.*\")" },
    { "evaluator": "evaluator-tokens", "code": "tokens-hex-literal", "evidence": "bad-tokens.module.css:16 — background: #00ff00", "remedy": "Replace #00ff00 with token(\"bg.*\")" },
    { "evaluator": "evaluator-tokens", "code": "tokens-hardcoded-spacing", "evidence": "bad-tokens.module.css:17 — padding: 16px", "remedy": "Replace 16px with token(\"space.x16\")" },
    { "evaluator": "evaluator-tokens", "code": "tokens-hardcoded-spacing", "evidence": "bad-tokens.module.css:18 — margin-bottom: 24px", "remedy": "Replace 24px with token(\"space.x24\")" },
    { "evaluator": "evaluator-tokens", "code": "tokens-hardcoded-typography", "evidence": "bad-tokens.module.css:22 — font-size: 14px", "remedy": "Replace 14px with token(\"fontSize.*\")" },
    { "evaluator": "evaluator-tokens", "code": "tokens-hardcoded-typography", "evidence": "bad-tokens.module.css:23 — line-height: 1.5", "remedy": "Replace 1.5 with token(\"lineHeight.*\")" },
    { "evaluator": "evaluator-naming", "code": "naming-abbreviation-export", "evidence": "BadNaming.tsx:19 — default export named Btn (abbreviation)", "remedy": "Rename default export to Button (full word)" },
    { "evaluator": "evaluator-naming", "code": "naming-boolean-form", "evidence": "BadNaming.tsx:15 — header: boolean is noun-as-boolean", "remedy": "Rename prop to showHeader / hasHeader (predicate form)" },
    { "evaluator": "evaluator-naming", "code": "naming-hungarian", "evidence": "BadNaming.tsx:20 — colorString carries type in identifier", "remedy": "Rename colorString to color (or textColor / buttonColor for disambiguation)" }
  ],
  "cli_runs": [],
  "conflicts": []
}
```

### Pass A analysis

- **Blocking findings (3)**: 2 legitimate a11y catalog hits — `a11y-missing-alt` and `a11y-icon-button-no-name`. Both cite file:line and a concrete remedy. **The smoke test's first verification target — "expected catalog hits with file:line evidence" — is satisfied.** The 3rd blocking entry (`parse-failure` on `evaluator-react-api`) is a **substrate finding**, not a fixture issue: see § "Substrate findings" below.
- **Advisory findings (9)**: 6 from `evaluator-tokens` + 3 from `evaluator-naming`. All advisory-only by classification (the evaluators emitted explicit `ADVISORY:` prefixes per the **L-009** packet's instructions to Phase-2 advisory lenses). **These do NOT contribute to the aggregated `verdict: flagged` gate** — the gate is driven exclusively by `blocking_findings`. **The smoke test's second verification target — "advisory-only flags don't gate units" — is satisfied at the aggregator level.**
- **`nextjs-use-client-vacuous` (advisory)**: `evaluator-nextjs` correctly classified this catalog entry as advisory (refactor smell, not runtime bug) per its rubric. The advisory finding lives in the evaluator's verdict text and doesn't escalate through aggregation. Confirmed not in `blocking_findings`.
- **Conflicts**: empty (no `flagged-conflict` produced; v1 conflict detection is a documented no-op for non-overlapping scopes anyway).

## Pass B — In-tree artifact (`components/shared/Card/`)

### Derive-panel invocation

```
$ node .claude/scripts/guild/derive-panel.ts \
    --files=components/shared/Card/index.tsx,\
components/shared/Card/types.ts,\
components/shared/Card/Card.module.css

evaluator-contract-fit,evaluator-a11y,evaluator-nextjs,evaluator-react-api,evaluator-tokens,evaluator-naming
```

Same panel shape as Pass A — six evaluators, precedence-ordered.

### /guild-validate invocation

Same skill chain, same dense-packet shape. The packet describes Card
as stable shared infrastructure (per `.claude/CLAUDE.md`'s
"don't over-engineer or refactor" framing), lists each AC with a
file:line mapping, and the spot-check hint suggests one `Read`
covers the CSS surface.

### Per-evaluator verdicts

| Evaluator | Verdict | Findings |
|-----------|---------|----------|
| `evaluator-contract-fit` | `approved` | All 5 ACs met; one minor structural observation noted (CardPadding shares CardProps even though it doesn't use the `root` class — not a flag) |
| `evaluator-a11y` | `approved` | not applicable: Card/CardPadding are stateless `<div>` wrappers with no interactive, media, or form surface |
| `evaluator-nextjs` | `approved` | no catalog antipatterns; correctly server-component-compatible (no `'use client'` directive, no client features) |
| `evaluator-react-api` | `approved` | not applicable: stateless functional components with no hooks/state/effects/refs/context/lists |
| `evaluator-tokens` | `approved` | every design value resolves through `token(...)`; `padding: 0` correctly exempt per literal-zero carve-out |
| `evaluator-naming` | `approved` | all seven D5 catalog entries clear; PascalCase exports, semantic class names, string enum instead of boolean noun |

### Aggregator output

```json
{
  "verdict": "approved",
  "blocking_findings": [],
  "advisory_findings": [],
  "cli_runs": [],
  "conflicts": []
}
```

### Pass B analysis

- **Zero blocking findings**: the panel does NOT false-positive on
  well-formed shared infrastructure. **The smoke test's third
  verification target — "panel behaves well on real clean code" — is
  satisfied.**
- **Zero advisory findings**: the advisory lenses didn't pile on with
  marginal notes either. Card is genuinely clean against all five
  Phase 2 catalogs.
- **No parse failures** in Pass B: all six verdicts parsed
  successfully. The Pass A `parse-failure` on `evaluator-react-api`
  was format-specific (see below); when the same evaluator put its
  trailing note on a separate line in Pass B, it parsed fine.

## Phase 2 verification

| PLAN.md sub-clause | Pass | Evidence |
|--------------------|------|----------|
| "real testbed phase fires expected catalog hits" | **satisfied** | Pass A § Per-evaluator verdicts: a11y fires `a11y-missing-alt` + `a11y-icon-button-no-name`; tokens fires hex-literal + spacing + typography; naming fires abbreviation-export + boolean-form + hungarian; nextjs fires use-client-vacuous (advisory). Every fixture's intended catalog hit fired, and one bonus advisory (line-height literal) surfaced. |
| "with CLI evidence in verdicts" | **satisfied** | Pass A and Pass B verdicts each cite the relevant CLI signal in the evaluator's body: `npm run lint`, `npm run lint:nextjs`, `npm run test:a11y`, `derive-panel.ts` stdout. The fixtures are out-of-scope for the static CLI signals by design (see AC 5 of D8's contract), so each evaluator notes which CLI signal applies and why; manual `Read` is the appropriate signal for fixture paths. For Pass B's in-tree artifact, the CLI signals apply directly and exit 0 — also cited in each verdict. |
| "advisory-only flags don't gate units" | **satisfied** | Pass A aggregator output: `blocking_findings` contains only legitimate blocking hits (a11y) plus one substrate `parse-failure` (separate finding); `advisory_findings` contains 9 entries (tokens + naming + the implicit nextjs advisory in the evaluator body). The top-line `verdict` of `flagged` is driven exclusively by `blocking_findings`. If we artificially removed the 2 a11y findings, the verdict would be `approved` even with the 9 advisory findings still present — exactly the "advisory-only doesn't gate" semantic. |
| (implicit) "panel composes correctly via derive-panel" | **satisfied** | Both passes' panels are the precedence-ordered six-evaluator list emitted by `derive-panel.ts`. The stdout matches PANEL-COMPOSITION.md's spec for a `.tsx` + `.ts` + `.module.css` file set. |
| (implicit) "multi-evaluator panel spawns in parallel" | **satisfied** | `guild-validate` → `guild-spawn` issued a single tool-use message with six `Agent` calls; all six returned attributed verdicts. Pass B verified the substrate also composes cleanly. |

## Substrate findings (surfaced by the smoke test)

The smoke test produced one substrate observation that the Phase 2
retrospective should capture:

### 1. `parse-and-aggregate.ts` is strict about VERDICT line format

In Pass A, `evaluator-react-api` emitted its verdict on a single
line: `VERDICT: approved — react-api evaluation not applicable to
scope (...)`. The em-dash continuation broke the parser's expectation
of a standalone `VERDICT: <state>` line; the aggregator recorded a
spurious `parse-failure` blocking finding against the evaluator.

In Pass B, after the packet was updated to suggest "put any trailing
note on a separate line," `evaluator-react-api` emitted `VERDICT:
approved\nreact-api evaluation not applicable: ...` and the parser
handled it cleanly. Two other Pass B evaluators (`evaluator-a11y`,
`evaluator-nextjs`) emitted similar two-line forms without issue.

**Implication**: the parser regex for `VERDICT: <state>` should
accept trailing content on the same line (em-dash continuation, or
inline note) without flagging `parse-failure`. The em-dash pattern is
natural for evaluators wanting to combine the verdict with a one-line
explanation.

**Disposition**: out of scope for D8 per disqualifier "no edits to
`parse-and-aggregate.ts`." Recommend a follow-up unit (D9 carryover
on Phase 2, or a Phase 1.5-style cleanup deliverable) that adds the
leniency. Until then, evaluators should be coached via the packet's
`## How to evaluate efficiently` section to put trailing notes on a
separate line.

### 2. L-004 strengthened: `/clear` is not a session boundary

Initial Pass A attempt (before the user restarted Claude Code)
failed with `Agent type 'evaluator-X' not found` for 5 of the 6
panel agents. The agent files were all on disk; the runtime registry
only contained `evaluator-base` and `evaluator-contract-fit` —
the two evaluators that existed BEFORE the Claude Code process
started.

**Implication**: `/clear` clears message history but does NOT reload
the agent registry. A true fresh session requires restarting the
Claude Code process (binary). The panel-7 D7 closing note's "D8 in a
fresh session" was satisfied only after the user-initiated process
restart between Pass A attempts.

**Disposition**: this strengthens **L-004** — the original learning
talks about "session restart" but doesn't distinguish `/clear` from
process restart. Worth capturing as a refined learning candidate via
`/griot-capture` at end of session.

## Net Phase 2 close

All five explicit and implicit PLAN.md verification sub-clauses
satisfied. Phase 2 deliverables (D1-D8) complete. The substrate
findings above are advisory bonuses surfaced by the integration test
— they don't gate Phase 2 close.
