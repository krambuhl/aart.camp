# Migrate griot-compact to subagents

## Context

`/griot-compact` currently runs as a Node orchestrator
(`scripts/learnings-compact/`) that calls the Anthropic SDK directly.
This forces API pricing and requires `ANTHROPIC_API_KEY` in the
environment. The judge panel is seven version-pinned models including
three previous-generation slots used for drift-detection calibration.

We're moving it to a subagent-driven pipeline orchestrated inside the
`/griot-compact` skill itself. The Agent tool only runs inside Claude
Code, so the orchestrator dissolves into the skill — most of
`scripts/learnings-compact/` goes away, replaced by parallel subagent
calls and two small deterministic helpers under
`.claude/scripts/griot/`. The split follows the agent-guilds rule:
LLM work lives in subagents, deterministic work lives in scripts.

The judge panel is reframed as tier-based (current Opus / Sonnet /
Haiku) rather than version-pinned. We accept losing the previous-gen
calibration signal as the cost of getting onto pooled subscription
tokens.

griot stays its own system. We do not compose `guild-validate` or
`guild-spawn` — the patterns rhyme but the code does not. The compact
pipeline is the only consumer of the griot panel today; if a second
consumer appears later, we extract primitives then.

## Scope

**In:**
- Five new griot-specific subagent types under `.claude/agents/`:
  `griot-judge`, `griot-rubric-author`, `griot-rewriter`,
  `griot-debate-summarizer`, `griot-operator`. (`debate-summarizer`
  is the LLM slice of the old mediator role; the rest of mediator's
  work moves to a deterministic script.)
- Tier-based panel config in `learnings/config.yaml`
- Two deterministic helpers under `.claude/scripts/griot/`:
  `mediate-panel.ts` (parse verdicts, tally, threshold, tier-split,
  consensus picking) and `operator-checks.ts` (rubric-tampering
  detection, attempt counting, JSONL logging)
- `/griot-compact` SKILL.md rewritten to inline-orchestrate the
  pipeline directly (parallel Agent calls + helper scripts)
- Removing `ANTHROPIC_API_KEY` prereq from skill docs
- Deleting `scripts/learnings-compact/` and its npm script
- Bench-history schema adjusted (sparser rows, no per-call token
  granularity from subagents)

**Out:**
- `/griot-capture` and `/griot-use` (untouched)
- Composing or sharing code with the `guild-*` substrate
- Adding new pipeline behaviors (escalation, rubric editing, etc.)
- Rewriting the regression suite logic (just port it)

**Deferred:**
- End-to-end verification against the legacy SDK path. User does not
  have an API key to A/B against. The new pipeline is verified by
  running it directly once standing up.

## Phases

### Phase 1: Substrate
Four deliverables, sequential:
1. **Subagent types** — five files under `.claude/agents/`:
   `griot-judge`, `griot-rubric-author`, `griot-rewriter`,
   `griot-debate-summarizer`, `griot-operator`.
2. **Tier-based panel config** — restructure `learnings/config.yaml`
   judges section from version-pinned to tier-based.
3. **`mediate-panel.ts`** — deterministic helper at
   `.claude/scripts/griot/mediate-panel.ts` plus tests. Absorbs the
   old mediator's procedural logic: parse verdicts, tally, threshold
   check, tier-split detection, consensus picking.
4. **`operator-checks.ts`** — deterministic helper at
   `.claude/scripts/griot/operator-checks.ts` plus tests. Absorbs the
   operator's invariant work: rubric-tampering detection, JSONL
   logging.

Skill still calls the Node script — old path keeps working, no
behavior change. Verified by `npm run lint` + `npm run build`.

### Phase 2: Migration
Rewrite `/griot-compact` SKILL.md to drive the pipeline directly. The
skill becomes the orchestrator: reads session-notes, dispatches the
judge panel via parallel Agent tool calls in one message, runs
rubric-author / rewriter / mediator as individual subagent
invocations, calls the aggregate-verdicts helper to parse, writes
rollup, archives notes, appends bench-history. Verified by running the
new pipeline against real session-notes and reviewing the rollup diff.

### Phase 3: Cleanup
Delete `scripts/learnings-compact/`. Drop the `learnings:compact` npm
script. Remove API-key prereq from skill docs. Verified by `npm run
lint` + `npm run build` and the Phase 2 run already having proven the
new path works.

## Dependencies

- Phase 1 must merge before Phase 2 (subagent types and config schema
  must exist before the skill can reference them).
- Phase 2 must merge before Phase 3 (can't delete the old path until
  the new path is proven and shipped).

## Verification

- Phase 1, 3: `npm run lint`, `npm run build`
- Phase 2: real subagent run on a small batch of session-notes, with
  the rollup diff reviewed manually

## Risks

- **Subagent token granularity loss.** Per-judge token counts in
  `bench-history.jsonl` go away. If you ever want them back you'd need
  to instrument differently or accept aggregate-only.
- **Calibration signal loss.** Previous-gen judges are gone; the panel
  no longer detects "current-model-knows-but-previous-doesn't" cases.
  Accepted upfront as the cost of pooled tokens.
- **Concurrency at scale.** 14+ session-notes × multiple subagents per
  note. Harness limits or rate-limiting could surface; if so, we
  serialize across notes and keep the per-note panel parallel.
- **Structured output brittleness.** Subagents return text, not
  tool-use JSON. The aggregate-verdicts helper carries the parsing
  load; it needs to be lenient about formatting variation.

## Open questions

- None blocking. Bench-history sparser-row schema decided during
  Phase 2 implementation.
