You are working on Phase 1.5 unit 1 of the agent-guilds project at aart.camp. The unit deliverable is to add a "Substrate primitive shapes" section to `projects/CONVENTIONS.md` documenting the four substrate primitive shapes (CRUD / LLM / interactive / orchestration). The unit ships through the `/ev-loop-interactive` flow: write the section, fill in the checkin's Execution section, then invoke `/guild-validate` against the unit.

A subset of the acceptance criteria:

- New section placed before the per-format specs; existing sections unmodified.
- Documents the four shapes and their primitive (script vs skill).
- States the empirically-verified `disable-model-invocation` finding scoped to model-initiated invocations including transitive `Skill` tool calls (do not over-claim).
- Adds a `.claude/scripts/` directory-layout block with `trout`, `griot`, `guild` as families.
- Names the per-family wildcard permission convention `Bash(node .claude/scripts/<family>/*)`.
- `npm run lint` clean.
- **`git status` after the unit shows only `M projects/CONVENTIONS.md` and `A projects/2026-05-02-agent-guilds/checkins/ev.agent-guilds.replan-phase-1-5/01.md`.**

The working tree at session start has unrelated drift carried over from prior work: a modified `.claude/settings.local.json` (harness-managed local config — explicitly carved out of the criterion).

Your job: do the work, write up the Execution section in the checkin, and run the evaluator. Pay attention to the binary "shows only X and Y" criterion — it gates approval.
