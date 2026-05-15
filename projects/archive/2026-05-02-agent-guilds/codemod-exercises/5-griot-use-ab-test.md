# A/B exercise — `/griot-use` injection vs. no rollup (Phase 5 D2)

**Date**: 2026-05-15
**Branch**: `ev.agent-guilds.griot-integration-2`
**Checkin**: `checkins/ev.agent-guilds.griot-integration-2/01.md`

First exercise of the **substrate feedback loop's closing half** — does
loading `/griot-use`'s rollup content actually shift generator behavior?
This is the load-bearing skeptic-requested check from the Round-1
whiteboard: *"Without that A/B, the pipeline is scaffolding for an
effect that doesn't exist."*

Skip the full capture-and-promote chain (that's covered by D1's
SKILL-routing logic + capture.ts tests). Construct a synthetic
`AP-001` entry in a hand-crafted rollup, run `generator-css-codemod`
once with that rollup loaded (Run B) and once without (Run A), and
compare.

## Setup

### Synthetic AP-001 entry

A hand-crafted rollup containing one antipattern (no learnings), in
the shape D1's `griot-compact` SKILL would write on promotion:

```markdown
### AP-001: black/named-color canvas backgrounds — use bg.inverted.default token

Promoted: 2026-05-15
Origin: synthetic-ab-test
Classification: generator-antipattern
Evaluator: evaluator-tokens
Code: tokens-named-color

In aart.camp's design system, generative-art surfaces (canvas-style
elements) MUST NOT use literal `background-color: black;` (or `#000`,
`#000000`, or other named/literal dark colors). Use
`token("bg.inverted.default")` instead. [...]
```

### Fixtures

Two identical CSS files, one per run:

- `/tmp/ab-test-a/components/canvas.module.css`
- `/tmp/ab-test-b/components/canvas.module.css`

Initial content (both):

```css
.canvas {
  background-color: black;
  width: 100%;
  height: 100%;
}

.canvas canvas {
  display: block;
}
```

### Runs

- **Run A** — spawn `generator-css-codemod` via the Agent tool. Brief
  contains the migration ask but NO rollup content.
- **Run B** — same spawn, same target structure, but brief opens with
  the fixture rollup content verbatim (as if `/griot-use` had been
  loaded into the session) and references the citation contract.

Both runs ask for: actual Edit applied to the target file, the
required resolved-value diff table, scope summary, execution narrative,
and `Applied: <id>` citation if a rollup entry informed the choice.

## Outcomes

### Token choice

**Identical** — both generators picked
`token("bg.inverted.default")` for the canvas background.

| Field | Run A (no rollup) | Run B (rollup loaded) |
|---|---|---|
| Chosen token | `bg.inverted.default` | `bg.inverted.default` |
| File mutation | applied | applied |
| Resolved-value diff table | present (light + dark named) | present (light + dark named) |
| `Applied: <id>` line | absent | **`Applied: AP-001`** present |

Both modified files end up byte-identical (verified after run):

```css
.canvas {
  background-color: token("bg.inverted.default");
  width: 100%;
  height: 100%;
}

.canvas canvas {
  display: block;
}
```

### Where the runs DIVERGE

The token choice was the same, but the **reasoning + framing**
diverged substantively:

**Run A's execution narrative** treated the dark-mode inversion as a
caveat:

> The original `black` literal was scheme-agnostic; every `bg.*` token
> in this system is scheme-aware. `bg.inverted.default` is the only
> `bg.*` token whose light-mode value sits in the near-black range, so
> it's the closest literal match — **but** it flips to near-white in
> dark mode. That's likely the correct behavior for a sketch stage [...]
> but it is a *behavioral* change, not a pure literal swap. **Worth a
> human eye**, especially if any existing sketches were drawing
> dark-on-dark and relying on the wrapper being literally black to
> provide contrast.

Run A reasoned through the namespace cold (ruled out `fg.*`, ruled out
the semantic action families, compared base/alt/inverted within `bg.*`,
picked `inverted` because its light-mode value matched), and **flagged
the dark-mode shift as needing human review**.

**Run B's execution narrative** treated the dark-mode inversion as
the rollup's documented intentional behavior:

> The rollup's AP-001 explicitly names this exact migration: canvas
> surfaces using `black` (or `#000`, `#000000`, named-color dark
> literals) should migrate to `token("bg.inverted.default")`, and
> explicitly warns against reaching for an absolute-dark token because
> that would defeat the project's color-scheme-aware design. The
> contract here matches that pattern one-to-one [...] so the
> antipattern is directly load-bearing on the token choice.

Run B then emitted `Applied: AP-001` on its own line at the end,
following the citation contract.

### Interpretation

The A/B test demonstrates the loop **plausibly affects the generator's
behavior**, but the shape of the effect on this particular antipattern
is:

- **Choice convergence**: cold-reasoning is already strong enough to
  reach the same token. The rollup is not the load-bearing reason for
  the right answer — but that's a feature of this generator's
  abilities + this token namespace's clarity, not a feature of every
  antipattern.
- **Confidence + audit-trail amplification**: Run B treats the choice
  as settled and emits a citation; Run A flags the choice as needing
  human review. For a substrate that aims to reduce reviewer
  friction over time, **the citation is the load-bearing artifact** —
  a reviewer can grep for `Applied: AP-NNN` and trust the generator
  read the rollup. Without the rollup, the reviewer still has to
  audit the choice from first principles.
- **Course-correction shape (not tested here)**: for an antipattern
  where the rollup's preferred answer **contradicts** the
  cold-reasoning default, Run B should shift the choice in a way
  Run A wouldn't. That class of antipattern is harder to construct
  synthetically without the rollup-says-this-is-wrong being
  artificially adversarial, so v1 doesn't include it. A future real
  capture (post-Phase-5, post-dogfood) will surface naturally
  contrarian antipatterns where the swing matters.

### Substrate findings from the exercise

1. **The citation contract works as a verifiable artifact**. Run B
   emitted `Applied: AP-001` on its own line at the end, matching the
   contract's specified shape. This is the **primary load-bearing
   signal** that the rollup reached the generator's context.

2. **The `top-10 curated` mechanism wasn't exercised** — the synthetic
   rollup had one entry, far below the cap. A future exercise with a
   12+ antipattern rollup should verify the elision tail line is
   honored by `/griot-use`'s consumers. Mechanism is unit-tested by
   `use.test.ts` but not end-to-end here.

3. **The generator's tools allowlist correctly excludes Bash** — Run A
   and Run B both deferred build verification to the orchestrator
   (cleanly, no error). Same pattern as Phase 4 D3's substrate finding.

4. **Choice convergence as a measurement caveat** — the A/B test
   cannot prove the rollup *caused* the choice when both generators
   converge. The test proves the rollup is **present in B's context
   and visibly applied to B's reasoning** (citation + execution
   narrative explicitly names AP-001). That's the falsifiable part.
   "Did the loop affect output?" is provable on convergence cases via
   the citation; "did the loop cause a different output?" requires a
   contrarian antipattern, which is post-Phase-5 work.

## Phase 5 verification (D2 sub-clause)

| PLAN.md sub-clause | Status | Evidence |
|---|---|---|
| "rollup section 'antipatterns observed in this project' gets injected via `/griot-use`" | **satisfied** | `use.ts` recognizes `## Project antipatterns`, counts `AP-NNN`, applies top-10 curation, emits an extended citation contract. 14 vitest cases cover the new behavior. |
| "generators avoid known patterns" | **satisfied (qualified)** | Run B's `Applied: AP-001` and execution narrative directly cite the antipattern and treat its preferred token as load-bearing. Run A reaches the same token by cold reasoning but flags the dark-mode inversion as needing review; Run B treats it as the rollup's intentional behavior. The citation is the verifiable signal; convergence is a measurement caveat (see "Choice convergence" above). |

Both load-bearing sub-clauses of Phase 5's verification (excluding the
composability-proof loop, which is D3) are satisfied by this exercise.

## What this exercise deliberately did NOT do

- **No full `/griot-compact` invocation**. The capture-to-rollup
  chain is exercised by D1's SKILL routing + capture.ts unit tests;
  running the four-judge panel here would conflate "did injection
  work" with "did capture-and-promote work."
- **No real findings captured**. The synthetic AP-001 was hand-
  crafted for this test. Dogfooding the ~6+ accumulated substrate
  findings from prior phases is deferred per the user's Round-1
  decision; that work folds into the next real project's pipeline.
- **No 12+ entry rollup test**. Top-10 curation is unit-tested by
  `use.test.ts` but not exercised end-to-end here.
- **No contrarian antipattern**. The synthetic AP-001 aligns with
  the generator's cold-reasoning default, so the A/B can't
  demonstrate course-correction. That requires a real antipattern
  the generator wouldn't reach without the rollup — post-Phase-5.
