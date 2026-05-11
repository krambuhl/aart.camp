Claude Code loads the `.claude/agents/` registry at session start. Agent files added during a session — new `evaluator-*.md`, `generator-*.md`, or `whiteboard-*.md` — are not callable as `subagent_type` until the session restarts. The file exists on disk and is structurally correct; the runtime registry is just session-cached.

When authoring a unit that introduces a new agent file AND uses that agent (smoke test, runtime verification, replacement of an existing agent), split the unit at the session boundary:

- **Unit N** (current session): create the agent file. Optionally use the existing/bridge agent for whatever work needs an agent in this session.
- **Unit N+1** (next session, first action): the registry has reloaded; spawn the new agent as a smoke test, then proceed with whatever depends on it (deletion of bridge file, swapping the loop's spawn target, etc.).

Do NOT delete a bridge file in the same session that introduces its replacement. The bridge keeps the existing path functional through the rest of the current session and gives the next session a known-good fallback.

Concrete pattern: when phase 2-4 of the agent-guilds project introduces new evaluators (`evaluator-a11y`, `evaluator-tokens`, etc.), generators (`generator-css-codemod`, etc.), or whiteboard engineers, contracts that author these agents should NOT also bundle "use this agent" steps. Use-steps are a follow-up unit's responsibility.
