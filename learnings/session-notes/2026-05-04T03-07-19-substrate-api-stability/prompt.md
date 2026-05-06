Author the `guild-spawn` substrate skill at `.claude/skills/guild-spawn/SKILL.md` — a style-neutral parallel-spawn primitive for the `guild-*` family. The design plan (`~/.claude/plans/yo-i-m-curious-what-shimmying-cook.md`, "guild-spawn" section) specifies three inputs:

- `agents` — list of subagent_type names
- `brief` — shared task description handed to every spawned agent
- `per_agent_context` — optional per-agent context overrides

Output: structured collection of attributed `{agent, output}` entries.

This is the base primitive that `guild-whiteboard` and `guild-validate` will compose. The substrate is meant to be stable — downstream callers (loops, future primitives) will depend on the documented input shape.

Acceptance criteria explicitly require all three inputs (`agents`, `brief`, `per_agent_context`) to be documented in the skill body.

Other constraints: `user-invocable: false`, `allowed-tools: Agent`, no loop-specific semantics in the body, no role validation, no aggregation, no retries (those are caller responsibilities).

Write the SKILL.md.
