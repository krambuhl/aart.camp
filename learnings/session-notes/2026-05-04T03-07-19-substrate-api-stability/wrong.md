Initial draft of `guild-spawn` SKILL.md dropped `per_agent_context` from the documented inputs on YAGNI grounds. The skill body's Inputs section listed only `agents` and `brief`. The "What this skill does NOT do" section gained a "Per-agent context variation" bullet stating: "All agents receive the same brief. Callers that need per-agent variation should either compose it into the brief with self-identifying sections, or spawn individually."

Rationale documented in the Execution section:

> Two simplifications from initial draft, both YAGNI:
>
> 1. Dropped `per_agent_context` as a structured input. All callers in the design (guild-validate, guild-whiteboard) pass identical briefs to all agents. If per-agent variation becomes needed later, callers can compose it into the brief with self-identifying sections.

The argument-hint frontmatter line read: `agents=<comma-separated names> brief=<text>` — `per_agent_context` not present.

This was a deliberate choice to narrow the substrate API to what v1 callers actually use, in the spirit of "don't pretend to support what you don't actually need." The Execution section openly acknowledged this as "a meaningful deviation from the contract's third acceptance criterion."

Evaluator (interactive loop's contract-fit lens) flagged the unit:

- `criterion-unmet` (acceptance criterion 2): contract requires the skill body to document `per_agent_context`; artifact dropped it entirely.
- `contract-ask-drift`: design plan lists three inputs; artifact ships two. Substrate is supposed to be stable; narrowing the input shape now means future callers needing per-agent variation will trigger a breaking-shape change.
