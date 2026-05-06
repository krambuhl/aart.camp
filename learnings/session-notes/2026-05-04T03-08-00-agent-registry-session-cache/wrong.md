The original unit 4 contract was written assuming all three sub-steps (loop edits + runtime-verify + delete evaluator.md) would land in one unit, in this same session.

The loop edits completed cleanly. The runtime-verification step was attempted by spawning `subagent_type: evaluator-contract-fit` directly via the `Agent` tool with a small synthetic packet. Result:

```
Agent type 'evaluator-contract-fit' not found.
Available agents: claude-code-guide, evaluator, Explore, general-purpose, Plan, statusline-setup
```

Despite `.claude/agents/evaluator-contract-fit.md` existing on disk (created in unit 1 of this same session), it was not visible as a callable `subagent_type`. Claude Code's agent registry is loaded at session start; new agent files added during the session are not registered until a future session reloads.

The first evaluator pass on unit 4 flagged this with `criterion-unmet` (runtime verification didn't complete) plus `contract-inadequate` (the contract bundled work that's structurally unfinishable in one session, because session-cached registry means agents authored mid-session can't be exercised mid-session).

The wrong move would have been to either: (a) ignore the constraint and delete evaluator.md anyway, leaving the loops potentially broken in this session if the new substrate path has any runtime issue; or (b) force the verification to "pass" via prose without an actual subagent spawn.

The right move (taken on iteration 2): amend the contract to split unit 4 into 4 (loops migrated; this session) and 4b (runtime verify + retire evaluator.md; first action next session). Preserve evaluator.md as the bridge for the rest of this session. This mirrors the pattern unit 1 used for the same architectural reason — the registry-cache constraint is real and the bridge-file pattern is the right answer.
