# Codemod exercise — Sketch.module.css (Phase 4 D3)

**Date**: 2026-05-15
**Branch**: `ev.agent-guilds.domain-pairs-3`
**Checkin**: `checkins/ev.agent-guilds.domain-pairs-3/01.md`
**Target file**: `components/app/Sketch/Sketch.module.css`

First end-to-end exercise of the v1 active generator-evaluator
pair (`generator-css-codemod` + `evaluator-css-architecture`).
Parallels Phase 2 D8's multi-evaluator smoke test and Phase 3 D3's
whiteboard exercise as the "real-pipeline-end-to-end" closing unit
of its phase. Closes Phase 4.

## Generator invocation

Spawned via `Agent` tool with `subagent_type: generator-css-codemod`.

**Brief** (paraphrased):
- Target: `components/app/Sketch/Sketch.module.css`
- Migration: `background-color: black;` → `token(...)`
- Suggested token: `bg.inverted.default` (verified to exist in
  `tokens/tokens.ts`; `components/shared/Card/Card.module.css`
  already uses it as `border` color)
- Preserve carve-outs: `!important` on canvas width/height; `& canvas`
  descendant selector; D2-added inline comment block
- Output: file mutation via Edit + Scope summary + Execution narrative
  + resolved-value diff table
- Scope discipline: per-file only; no other CSS modules; no
  `npm run generate:tokens`; no `tokens/` edits

### Generator output

The generator successfully:
1. Read the target file and confirmed the literal was at the
   expected line.
2. Cross-referenced `Card.module.css` to confirm
   `bg.inverted.default` is established usage.
3. Verified the token exists in `tokens/tokens.ts:94` and resolves
   in `styles/tokens.css:67` (light) and `:113` (dark).
4. Applied a single Edit operation: line 17,
   `background-color: black;` → `background-color: token("bg.inverted.default");`.
5. Preserved all carve-outs verbatim (verified by post-edit Read).

### Generator's resolved-value diff table (verbatim)

| Before (literal) | After (token resolves to) | File:line |
|---|---|---|
| `black` (`#000000`, scheme-invariant) | `token("bg.inverted.default")` → light mode: `hsl(0deg 0% 8%)` (~`#141414`); **dark mode: `hsl(0deg 0% 92%)` (~`#EBEBEB`)** | `Sketch.module.css:17` |

### Generator's flagged concern (verbatim)

> This migration is not a visually-neutral substitution. In light
> mode the canvas backdrop moves from pure black to near-black —
> visually imperceptible for most sketches. In dark mode the
> canvas backdrop inverts to near-white, because
> `bg.inverted.default` is defined relative to the page background,
> not as an absolute dark stage.
>
> Two reasonable interpretations live in tension here:
> - **"Inverted = relative to page chrome"** (what the token does)
> - **"Black = absolute dark stage for generative art"** (what the
>   literal did)

### Generator's tool-denial flag

The generator's brief asked it to run `npm run build` once to verify
the token resolves; its tools allowlist excludes Bash (Read, Edit,
Write, Glob, Grep only). The generator flagged this in its narrative
as a soft tool-denial, verified token existence by direct file lookup
instead (`tokens/tokens.ts:94`, `styles/tokens.css:67,113`), and
deferred the build invocation to the orchestrator.

The loop ran `npm run build` after the codemod — exit 0; token
resolves correctly through the PostCSS pipeline. The
generator-base.md's "no Bash" tools allowlist is correct by design
(generators propose; orchestrator runs verification + commits).

## Specialist-evaluator invocation

Spawned via `Agent` tool with
`subagent_type: evaluator-css-architecture`. This is the **first
real invocation** of the specialist in a codemod-shaped panel,
validating the elevated-precedence pairing pattern from
PANEL-COMPOSITION.md.

**Packet**: full evaluation packet with the artifact, the generator's
diff table, the flagged concern, and the build-verification result.

### Specialist verdict (verbatim summary)

**Overall**: PASS with one advisory finding.

Per-rubric findings:
- **Carve-outs preserved** ✓ (all three: `!important` on width/height,
  `& canvas` descendant, D2 comment block)
- **Resolved-value diff present and complete** ✓ (the diff names both
  scheme resolutions verbatim; an advisory note recommends a future
  enhancement: tagging "delta-kind" — adjustment / drift / inversion
  — in the table itself)
- **Scope discipline respected** ✓ — sketch's sibling
  `components/app/FormulaSketch/FormulaSketch.module.css:2` has the
  same `black` literal but was NOT touched (correctly out of scope;
  flagged as a downstream precedent target for a future unit)
- **Structural CSS shape clean** ✓ (no specificity fight, no cascade
  fragility, no duplicate rules, no `:global` leakage, no
  shared-primitive-bypass — the `.sketch` flex layout is the
  substrate component's own layout shell, allowed)
- **No `css-arch-silent-value-change` blocking finding** — the
  generator was loud about the resolved-value inversion (in fact
  surfaced the philosophical question itself). The rubric's silence-
  trigger is satisfied.

### Specialist's new advisory code

The specialist introduced a new advisory code for the panel record:
**`css-arch-semantic-inversion-flagged`** (advisory, not blocking).
Definition: "the codemod surfaced a resolved-value inversion between
color schemes (not just a drift). The migration is contractually
valid but the semantic interpretation deserves a human decision
before the precedent propagates to sibling files (specifically
`FormulaSketch.module.css:2`)."

This is the first new flag code the specialist has minted (it joins
the 10-entry rubric from D1). Worth elevating into the evaluator's
body in a future cleanup so future invocations have it canonically.

### Specialist's precedent note (verbatim)

> For the panel record on this first real generator-evaluator pair
> exercise: the right disposition when a generator *correctly*
> surfaces a substantive semantic concern is to acknowledge it
> cleanly, not to escalate it to a blocking finding just because
> the underlying decision is non-trivial. Blocking should be
> reserved for *unflagged* drift, contract violations, or carve-out
> regressions. The generator did the loud work it was supposed to
> do; my role is to verify the loudness was loud enough and to
> route the remaining decision to the right humans. That's the
> partnership shape I'd like to set as precedent for future pair
> exercises.

This is the **substrate's first articulation of the
generator-specialist partnership shape in practice**. Worth
preserving as a learning candidate.

## Net codemod outcome

The codemod was applied; the build passes; the specialist approved
with one advisory; **the dark-mode semantic inversion is a real
design question awaiting human decision**. Three reasonable paths
forward (which the loop's parent context surfaces to the user as
a fork):

1. **Accept the inversion** as semantically correct (canvas is page-
   chrome-relative; sketches that draw dark on dark / light on light
   in their own logic will naturally work). Ship D3 as-is. Document
   the precedent. The specialist sibling FormulaSketch can follow
   the same path in a future unit.
2. **Revert the codemod** and pause for a token-namespace authoring
   follow-up. A new token (e.g. `bg.canvas.stage` — semantic
   "always-dark performance surface") would need authoring in
   `tokens/design-tokens.json`, regenerating the pipeline via
   `npm run generate:tokens`, and re-running the codemod against
   the new token. Larger blast radius; substantial scope expansion
   to D3.
3. **Author the new token in this PR**, keeping the codemod's
   structural changes but pointing at the new token name. Splits
   the design call from the codemod execution; the codemod's
   pipeline still ran end-to-end (as desired by Phase 4
   verification) but the resulting artifact lands at the
   semantically-correct token.

## Phase 4 verification

| PLAN.md sub-clause | Status | Evidence |
|---|---|---|
| "CSS codemod phase runs through the active pair" | **satisfied** | Generator-css-codemod spawned successfully (first real invocation since D1), produced a contractually valid artifact with required resolved-value diff, carve-outs respected. Specialist evaluator-css-architecture spawned (first real invocation since D1), applied its full rubric, produced PASS-with-advisory verdict. The pair worked end-to-end. |
| "phase config naming a stub generator errors loudly with activation criteria" | **N/A by reframe** | The Phase 4 D1 whiteboard adopted the drop-stubs decision; zero stub agent files exist in the codebase. The "loud error" path is therefore unexercised by design. The general "phase config naming a non-existent agent" error path is unrelated to stubs specifically and is not in D3's scope. |

The first sub-clause is the load-bearing one (PLAN.md's
"verification" clause leads with it). It's satisfied.

## Substrate findings surfaced

### 1. Generator tool-denial on `npm run build`

The generator's contract asked for one build verification; its tools
allowlist excludes Bash. The generator flagged this cleanly and
deferred to the orchestrator. **This is the right design** — the
orchestrator runs verification, generators propose. But the contract's
"verification budget" clause should be reworded to address-the-loop
("the loop may run one build to verify the generator's chosen token
resolves") rather than address-the-generator ("you may run one
build"). Tiny contract-language refinement; not a substrate fix.

### 2. New advisory code `css-arch-semantic-inversion-flagged`

The specialist minted this code on first real invocation. Not in the
10-entry rubric from D1. Worth adding to `evaluator-css-architecture.md`
body in a future cleanup so the canonical rubric matches what the
agent actually emits.

### 3. The partnership-shape precedent

The specialist's precedent note ("right disposition when generator
surfaces a substantive concern is to acknowledge, not escalate")
is the first articulation of the generator-specialist working pattern
in practice. Worth carrying into `evaluator-css-architecture.md`'s
body or `generator-base.md`'s pairing section as canonical guidance.

### 4. Sibling-file precedent target

`components/app/FormulaSketch/FormulaSketch.module.css:2` has the same
`black` literal. Whatever the user decides for the Sketch canvas
becomes precedent for this sibling. A future codemod unit
(post-Phase-4) should batch them — same decision, two files.

## Net Phase 4 close

PLAN.md Phase 4's load-bearing verification sub-clause is satisfied.
The four substrate findings above are bonuses surfaced by the
exercise — they're for future polish, not gates on Phase 4 closure.
The dark-mode semantic question is the one design call that needs
human attention before the PR ships; the loop's parent context
will surface it as a fork.
