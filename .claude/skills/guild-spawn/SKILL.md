---
name: guild-spawn
description: >-
  Style-neutral parallel-spawn primitive for the guild-* substrate family.
  Takes a list of subagent_types and a shared brief; spawns them in
  parallel via a single Agent tool message; returns each agent's output
  attributed by name. Internal substrate skill — composed by
  guild-validate, guild-whiteboard, and custom loops. Does not aggregate,
  validate roles, or iterate.
argument-hint: "agents=<comma-separated names> brief=<text> [per_agent_context=<json-map>]"
user-invocable: false
allowed-tools: Agent
---

# /guild-spawn

The base primitive of the `guild-*` substrate family. Spawns N
subagents in parallel via a single Agent tool message and returns their
outputs attributed by agent name. Style-neutral — does one capability,
no loop opinions.

This skill is infrastructure for higher-level guild primitives
(`guild-whiteboard`, `guild-validate`) and any custom loop that wants
parallel agent invocation. It does not know about evaluators, whiteboard
engineers, panels, or any role semantics. Those are the caller's concern.

## Inputs

- `agents` — comma-separated `subagent_type` names, e.g.
  `evaluator-contract-fit,evaluator-a11y`. Order is preserved in the
  output.
- `brief` — shared task description handed to every spawned agent.
  Can be a short prompt or a multi-section packet (e.g. the evaluation
  packet shape used by `guild-validate`). Passed verbatim.
- `per_agent_context` (optional) — JSON-encoded map from agent name to
  an extra context string. When present, the named agent receives the
  shared brief followed by its context appended under a clearly
  delimited section. Agents not named in the map receive only the
  shared brief. Example:
  `{"evaluator-a11y":"Focus on form labels.","evaluator-tokens":"This artifact only touches CSS modules."}`

## Process

1. **Validate inputs.**
   - If `agents` is empty, refuse with `guild-spawn-error: empty agents list`.
   - If `brief` is missing or empty, refuse with `guild-spawn-error: missing brief`.
   - Do not validate agent names against `.claude/agents/`. Claude Code
     surfaces invalid `subagent_type` errors at spawn time; the caller
     handles them.
2. **Compose per-agent prompts.** For each agent in `agents`:
   - Start with the verbatim `brief`.
   - If `per_agent_context` was provided and contains a key matching
     the agent name, append its value to the prompt under a
     clearly-delimited section, e.g.:
     ```
     <brief>

     ## Context for <agent-name>
     <per-agent context value>
     ```
   - Agents not named in `per_agent_context` receive only the brief.
3. **Spawn in parallel.** Issue a single tool-use message containing
   one `Agent` tool call per entry in `agents`. Each call uses
   `subagent_type: <agent>` and the composed prompt from step 2.
   The parallel invocation is the whole point of this primitive —
   do not serialize.
4. **Collect outputs.** Wait for all spawned agents to return. Build
   the structured output (see Output format below) preserving the input
   order.
5. **Return.** The caller receives the structured collection. This skill
   does no further processing.

## What this skill does NOT do

Explicitly the caller's responsibility, not the substrate primitive's:

- **Aggregation.** The caller decides how to combine outputs.
  `guild-validate` aggregates verdicts; `guild-whiteboard` reads a
  shared file; a different loop might do something else.
- **Conflict resolution.** Cross-agent disagreements surface unaltered.
- **Iteration / retries.** If an agent fails or returns a flagged
  verdict, the caller decides whether to re-spawn.
- **Role validation.** Whether the spawned agent is the "right kind"
  for the caller's purpose (evaluator vs whiteboard-engineer vs
  generator) is enforced by the caller. `guild-spawn` spawns any named
  `subagent_type`.

## Output format

```
{
  "agents": ["<name1>", "<name2>", ...],
  "outputs": [
    { "agent": "<name1>", "output": "<text or error>" },
    { "agent": "<name2>", "output": "<text or error>" },
    ...
  ]
}
```

If an individual spawn fails (Claude Code surfaces a tool-use error),
the entry's `output` field carries the error text and the caller is
responsible for distinguishing failed entries.

## Rules

- **Parallel only.** This primitive's value is parallelism. If a caller
  needs sequential invocation, they call `Agent` directly N times — they
  don't need this skill.
- **No mutation of inputs.** The brief passes through verbatim.
- **No emojis.**

## Failure modes

- Empty `agents` list → `guild-spawn-error: empty agents list`. Stop.
- Missing or empty `brief` → `guild-spawn-error: missing brief`. Stop.
- One or more spawns fail individually → include the error text in the
  output collection's `output` field for that agent. Do not raise.
  The caller sees the failure pattern in aggregate.
