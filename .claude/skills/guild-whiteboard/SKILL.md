---
name: guild-whiteboard
description: >-
  Multi-perspective design primitive for the guild-* substrate family.
  Composes guild-spawn to invoke a panel of whiteboard-* engineer agents
  in parallel against a shared filesystem artifact, then collects each
  engineer's contribution into the artifact as attributed sections.
  Supports multi-round invocations — round 2+ passes the prior
  whiteboard state into the next round's brief so engineers can address
  contradictions. Internal substrate skill — composed by ev-loop as a
  default pre-unit step (phases may override engineers/topic/rounds via
  PLAN.md `**Whiteboard**:` block). Does not iterate, does not
  auto-resolve contradictions.
argument-hint: "engineers=<comma-separated names> brief=<text> whiteboard=<path> [round=<N>]"
user-invocable: false
allowed-tools: Skill, Bash
---

# /guild-whiteboard

Multi-perspective design primitive. Spawns one or more `whiteboard-*`
engineer agents in parallel against the same brief, collects each
engineer's response, and appends them as **attributed sections** to a
shared filesystem artifact (the "whiteboard"). Supports multi-round
flows — caller invokes the skill again with the same whiteboard path
to add a new round, and engineers see prior rounds via per-agent
context.

This skill is the third primitive in the `guild-*` substrate family.
Like `/guild-validate`, it **composes `/guild-spawn`** rather than
calling the `Agent` tool directly — the layering is the point. A loop
using `/guild-whiteboard` gets parallel agent invocation for free,
deterministic attributed-section writes, and forward-compatible
multi-round support without re-implementing any of it.

`/guild-whiteboard` does not know about specific engineer rubrics. It
expects each spawned engineer to return a response body that the skill
will write verbatim under a `### From <engineer-name>` header.

## Inputs

- `engineers` — comma-separated `subagent_type` names of whiteboard
  engineers to spawn, e.g.
  `whiteboard-react-architect,whiteboard-design-systems`. Order is
  preserved in the output's per-engineer fields and in the attributed
  sections written to the whiteboard file.
- `brief` — shared task description handed to every spawned engineer.
  This is the design question being explored (e.g. "How should
  `<Card>` adapt to the new dark-mode token tier?"). Passed verbatim.
- `whiteboard` — repo-relative path where the attributed artifact
  lives. If the file does not exist, the skill creates it with a
  topical header inferred from the brief's first line. If it exists,
  the skill detects the next round number and appends a new `## Round
  N` block.
- `round` (optional) — explicit round number override. Defaults to
  auto-detect (max existing `## Round N` + 1; `1` if file is new or
  empty). Allows explicit re-runs of a specific round if a prior
  invocation was interrupted.

## Output format (locked to the design plan)

The output shape is fixed even when v1 will populate `contradictions`
empty — downstream callers depend on the shape:

```json
{
  "whiteboard_path": "<path>",
  "round": <N>,
  "sections": [
    { "engineer": "<name>", "section": "<verbatim engineer body>" }
  ],
  "contradictions": []
}
```

`contradictions` is empty in v1. Cross-engineer contradiction detection
is a future-work case — see § "Contradiction detection (v1: future-
work)" below.

## Process

1. **Validate inputs.**
   - If `engineers` is empty, refuse with `guild-whiteboard-error:
     empty engineers list`.
   - If `brief` is missing or empty, refuse with
     `guild-whiteboard-error: missing brief`.
   - If `whiteboard` is missing or empty, refuse with
     `guild-whiteboard-error: missing whiteboard path`.
   - Do not validate that named agents are role-typed
     `whiteboard-engineer`. The substrate doesn't enforce this; if a
     non-engineer is passed, `/guild-spawn` will spawn it and the
     return body will be written verbatim under the attributed
     section header. Caller is responsible for choosing role-
     appropriate agents.

2. **Resolve round number.**
   - If `round` arg supplied, use it verbatim.
   - Otherwise call
     `Bash("bin/guild whiteboard detect-round <whiteboard-path>")`.
     The verb returns a single integer on stdout (`1` if the file
     does not exist or has no `## Round N` headers, else
     `max(existing) + 1`).

3. **Initialize the whiteboard if needed.**
   - If the file does not exist (round = 1), call
     `Bash("bin/guild whiteboard init <whiteboard-path>
     --topic='<first line of brief>'")`. The verb writes the file
     with a `# Whiteboard: <topic>` header. Idempotent — no-op if
     the file already exists.

4. **For round > 1: read prior state.**
   - Call
     `Bash("bin/guild whiteboard read-state <whiteboard-path>")`.
     The verb returns JSON
     `{rounds: [{number, sections: [{engineer, section}]}]}`.
   - Construct `per_agent_context` for `/guild-spawn` as a JSON
     object keyed by engineer `subagent_type`, where each value is
     the prior-state preamble string (the body is identical for
     every engineer in v1 — every engineer sees the same prior
     rounds; the per-agent shape is used so `/guild-spawn` routes
     the preamble to each spawned agent's brief):

     ```json
     {
       "whiteboard-react-architect": "## Prior whiteboard state\n\n<...prior rounds...>\n\n## This round (N)\n\n<...instructions...>",
       "whiteboard-design-systems":  "## Prior whiteboard state\n\n<...prior rounds...>\n\n## This round (N)\n\n<...instructions...>"
     }
     ```

     The preamble-string content is:

     ```
     ## Prior whiteboard state

     <verbatim concatenation of all prior rounds, each formatted as
     "## Round N\n\n### From <engineer>\n\n<section>\n\n">

     ## This round (N)

     You are addressing the prior round(s) above. Look for
     contradictions with your prior position, areas where another
     engineer's section reframes the question, and places where
     consensus has emerged. Your section in this round should
     reflect those observations.
     ```

     Engineers not named in `per_agent_context` (none in this v1
     pattern — all engineers see prior state) receive only the
     shared brief.

5. **Spawn engineers in parallel.** Invoke `/guild-spawn` via the
   `Skill` tool with `agents=<engineers>` and `brief=<input brief>`.
   For round > 1, pass `per_agent_context` constructed in step 4.
   For round = 1, omit `per_agent_context` — every engineer sees
   only the shared brief by design.

6. **Append attributed sections to the whiteboard.** Build a JSON
   array of `{engineer, section}` entries from `/guild-spawn`'s
   outputs (preserving input order; the `section` is the engineer's
   full response body, verbatim) and pipe it to the append script
   via stdin:

   ```bash
   echo '<json-array>' | bin/guild whiteboard append <whiteboard-path>
   ```

   The verb writes the new `## Round N` block with each engineer's
   `### From <name>` subsection and returns the locked Result JSON
   on stdout.

7. **Return** the script's output (parsed back into a structured
   value) to the caller. This skill performs no further work.

## Example

Round 1 invocation:

```
/guild-whiteboard \
  engineers=whiteboard-react-architect,whiteboard-design-systems \
  brief="How should <Card> adapt to the new dark-mode token tier?" \
  whiteboard=projects/2026-05-dark-mode/whiteboards/3-card-dark-mode.md
```

After the skill returns, the whiteboard file contains:

```markdown
# Whiteboard: How should <Card> adapt to the new dark-mode token tier?

## Round 1

### From whiteboard-react-architect

<verbatim engineer-1 response body>

### From whiteboard-design-systems

<verbatim engineer-2 response body>
```

The returned JSON:

```json
{
  "whiteboard_path": "projects/2026-05-dark-mode/whiteboards/3-card-dark-mode.md",
  "round": 1,
  "sections": [
    { "engineer": "whiteboard-react-architect", "section": "<...>" },
    { "engineer": "whiteboard-design-systems", "section": "<...>" }
  ],
  "contradictions": []
}
```

A subsequent round-2 invocation with the same `whiteboard=` path
auto-detects round 2, constructs `per_agent_context` from round 1's
sections, and appends a new `## Round 2` block.

## Contradiction detection (v1: future-work)

A contradiction is two engineers in the same round emitting
incompatible recommendations on the same scope (file, identifier,
architectural choice) — applying both would leave the design
incoherent.

In v1, contradiction detection is a documented no-op:
- For single-engineer panels, only one engineer can contribute, so
  contradictions cannot exist by definition. Return `contradictions:
  []`.
- For multi-engineer panels, the detection mechanism needs a shared
  scope-and-claim comparison rule. That logic is a Phase 4+ concern
  and will be added to this skill's process step 6 then.

Until then, `contradictions` is a field the API supports but v1 does
not produce. Loops can write contradiction-handling code that's ready
when it does. Multi-round invocations let the caller surface
contradictions through the prior-state mechanism (engineers see other
engineers' prior sections and can call out conflicts in their next
round contribution).

## What this skill does NOT do

Explicitly the caller's responsibility, not the substrate primitive's:

- **Iteration / round orchestration.** The caller decides whether to
  invoke a second round, third round, etc. This skill processes one
  round per call.
- **Engineer role validation.** Any named `subagent_type` can be
  passed. Non-whiteboard-engineer agents will produce sections of
  unpredictable shape, which the caller sees in the output. The
  substrate doesn't gatekeep.
- **Whiteboard archival or cleanup.** The whiteboard file persists
  after the skill returns. The caller (typically a phase's `/ev-loop-*`
  invocation) decides when to roll it forward, archive it, or wipe it.
- **Engineer-direct file writes.** Engineers are read-only via their
  `tools:` allowlist (Read, Glob, Grep). The orchestrator does ALL
  writes to the whiteboard via the helper script. This sidesteps
  race conditions on parallel writes and matches the read-only
  stance established by `evaluator-base.md` for the panel family.
- **Topic inference beyond the first line of `brief`.** If the
  topic-from-brief heuristic produces a bad header for the new file,
  the caller can either pre-create the file with a better header
  (the `init` verb is idempotent) or rename the topic later
  manually.

## Rules

- **Compose `/guild-spawn`.** Do not call the `Agent` tool directly.
  The layering is the point.
- **Engineers are read-only.** All writes to the whiteboard file flow
  through `bin/guild whiteboard`. No engineer agent
  should ever be passed a `Write`/`Edit` tool in its `tools:`
  allowlist.
- **Lock the output shape.** Even when v1 leaves `contradictions`
  empty, the structure is what downstream callers depend on.
- **No emojis.**

## Failure modes

- Empty `engineers` list → `guild-whiteboard-error: empty engineers
  list`. Stop.
- Missing or empty `brief` → `guild-whiteboard-error: missing brief`.
  Stop.
- Missing or empty `whiteboard` → `guild-whiteboard-error: missing
  whiteboard path`. Stop.
- `/guild-spawn` itself errors → forward the error verbatim to the
  caller. Do not partially aggregate or write a half-round to the
  whiteboard.
- `whiteboard.ts append` fails (e.g. file path unwritable,
  unparseable stdin) → surface the script's error verbatim and exit
  non-zero. The whiteboard file's state is whatever it was when the
  failure hit (the script does atomic-replace on success, so a
  partial write should not corrupt the file).
- One or more engineer spawns fail individually → the failed
  entries' `section` field carries the error text and the caller
  sees the failure pattern in the structured output. The whiteboard
  file gets the attributed section for that engineer with the error
  body (so the failure is visible in the artifact, not silently
  dropped).
