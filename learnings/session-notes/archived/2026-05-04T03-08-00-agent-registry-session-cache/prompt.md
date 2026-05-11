Phase 1 of the agent-guilds project: migrate `ev-loop-confidence` and `ev-loop-interactive` to invoke `/guild-validate` via the `Skill` tool with a 1-agent panel `[evaluator-contract-fit]` instead of spawning `subagent_type: evaluator` directly via the `Agent` tool. Then retire `.claude/agents/evaluator.md` (the bridge file).

Earlier in this same session (units 1-3), the substrate was authored:

- Unit 1 created `.claude/agents/evaluator-base.md` and `.claude/agents/evaluator-contract-fit.md`. The original `.claude/agents/evaluator.md` was preserved as a bridge.
- Units 2-3 created `.claude/skills/guild-spawn/SKILL.md` and `.claude/skills/guild-validate/SKILL.md`.

Unit 4 contract bundles three sub-steps:

1. Edit both ev-loop SKILL.md files to invoke `/guild-validate` instead of spawning the evaluator subagent.
2. Runtime-verify the substrate path by spawning `evaluator-contract-fit` (or invoking `/guild-validate` with `agents=evaluator-contract-fit`) against a synthetic packet and confirming a structured verdict returns.
3. Delete `.claude/agents/evaluator.md` (the bridge file) once verification passes.

Acceptance criteria explicitly require the runtime verification to complete and `evaluator.md` to be deleted in this unit. Disqualifier: deleting evaluator.md before verification.

Edit the ev-loop skills, then run the verification and delete the bridge.
