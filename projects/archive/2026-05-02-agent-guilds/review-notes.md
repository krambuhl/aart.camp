# Phase 1 review notes (post-merge of PR #8)

Audit run via `/review-skill` on 2026-05-04 against the four new files
and two modified files from Phase 1. Action deferred — captured here so
the fixes aren't lost.

## Verified up front

- No file has `disable-model-invocation` set today (`grep -l
  "disable-model-invocation"` returned nothing). User's primary
  concern (don't disable composition by accident) is satisfied as-is.

## Action punch list

| File | Action | Why |
|------|--------|-----|
| `.claude/skills/guild-spawn/SKILL.md` | Add `disable-model-invocation: true` to frontmatter. | Substrate primitive, only composed via `Skill` tool from `guild-validate`. Auto-discovery from a top-level prompt could spawn N subagents with malformed args. Adding the flag does NOT break composition — `Skill`-tool invocation is explicit, not auto-discovery. |
| `.claude/skills/guild-spawn/SKILL.md` | Soften the forward reference to `guild-whiteboard` (e.g. add "(planned, not yet authored)"). | The skill mentions `guild-whiteboard` as a sibling consumer; that sibling doesn't exist until Phase 3. |
| `.claude/skills/guild-validate/SKILL.md` | Add `disable-model-invocation: true` to frontmatter. | Same reasoning as `guild-spawn` — substrate, only composed by ev-loop and other style skills. |
| `.claude/agents/evaluator-base.md` | Tighten `description` so the auto-router won't pick this for a real evaluation. Lead with "SHARED BASE CONTRACT — not an evaluator. Do NOT delegate evaluations here." | Today's description says "not directly callable" but Claude Code has no agent-level `disable-model-invocation` equivalent — the description is the only signal the auto-router has. Currently routable; should not be. |
| `.claude/skills/ev-loop-confidence/SKILL.md` | Drop `Agent` from `allowed-tools`. | Body explicitly states "the loop itself never calls the `Agent` tool directly" — `Agent` in the allowlist is a contradiction and an attractive nuisance. The loop uses `Skill` (to invoke `/guild-validate`, `/trout-*`); `Agent` is unnecessary. |
| `.claude/skills/ev-loop-interactive/SKILL.md` | Drop `Agent` from `allowed-tools`. | Same reasoning as confidence loop. |

## Explicitly NOT applied (per user directive)

- **Do NOT add `disable-model-invocation: true` to `ev-loop-confidence` or `ev-loop-interactive`.** The reviewer recommended this for both. User clarified that `disable-model-invocation` should be avoided where it would prohibit the model from effectively using the skills in the Claude web harness. The ev-loop skills are exactly the kind of thing a user in the web harness might invoke conversationally ("run the next phase of agent-guilds") — auto-discovery should find them. Composition is unaffected (`/ev-run` invokes via the `Skill` tool, which doesn't go through auto-discovery).

## Deferred nice-to-haves

These are small polish items the review surfaced but that don't affect correctness or the disable-model-invocation question. Worth a separate pass at some point — most natural alongside Phase 2 work since Phase 2 will add five new evaluator-* files and several of these patterns (worked examples, code-field semantics, role: convention) will repeat.

- `guild-validate/SKILL.md`: add a worked input → output example (single-evaluator panel).
- `guild-validate/SKILL.md`: clarify how `code` field is derived from a v1 unprefixed reason line. Default to `criterion-unmet` for evaluator-contract-fit.
- `guild-validate/SKILL.md`: add `<!-- TODO Phase 2: add conflict-detection example -->` as a marker for the conflict-detection logic Phase 2 will add.
- `guild-spawn/SKILL.md`: label the JSON output block with `json` for syntax highlighting.
- `guild-spawn/SKILL.md`: clarify duplicate-agent-name behavior (allowed; output preserves input order, distinguishable by index).
- `evaluator-base.md`: document the `role:` frontmatter convention here so future evaluator authors know it's intentional (or drop the field across both base + contract-fit if it's vestigial).
- `evaluator-base.md`: prune the `evaluator-*` family list (lines ~17-19) to "currently `evaluator-contract-fit`, with [...] planned" — avoids broken-promise vibes.
- `evaluator-base.md`: add a "How domain evaluators inherit this file" subsection with the exact opener domain evaluators should include.
- `evaluator-base.md`: add a `Categories:` line to the Flagged verdict template so downstream aggregation in `guild-validate` doesn't have to parse freeform prose.
- `evaluator-contract-fit.md`: add an example of a `contract-ask-drift` verdict (most subtle flag this evaluator emits).
- `ev-loop-confidence/SKILL.md`: re-letter or rename the unit-loop steps so phase-level Step 3 vs unit-level Step 3 don't collide on skim.
- `ev-loop-confidence/SKILL.md`: render the "Output to router" section as a fenced template so the router-side parse is brittle-proof.
- `ev-loop-interactive/SKILL.md`: scope `Bash` in `allowed-tools` to specific git/lint commands actually used (or drop if substrate skills cover all shell work).
- `ev-loop-interactive/SKILL.md`: add a Failure-modes bullet for "evaluator flags 3+ consecutive deliverables → pause, ask whether the panel composition or contract template is wrong."

## Suggested staging

When ready to act:

- **Hardening PR (5 edits)**: the action punch list above. Single commit, one small PR off main. Branch suggestion: `ev.agent-guilds.harden-substrate`.
- **Phase 2 incidental cleanups**: roll the deferred nice-to-haves into Phase 2's PRs as they become natural to address (e.g. add the `evaluator-base.md` "How domain evaluators inherit" section when the first new evaluator is authored, since the new evaluator's body needs to follow the convention).
