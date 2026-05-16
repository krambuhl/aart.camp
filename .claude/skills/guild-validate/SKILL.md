---
name: guild-validate
description: >-
  Antagonist panel coordinator for the guild-* substrate family.
  Composes guild-spawn to run evaluator agents in parallel, parses
  each evaluator's verdict, and aggregates findings into a single
  panel verdict (approved | flagged | flagged-conflict) with
  blocking/advisory split and conflict surfacing. Internal substrate
  skill — composed by ev-loop and any other loop style that wants
  antagonist panel coordination. Does not iterate, does not auto-
  resolve conflicts.
argument-hint: "agents=<comma-separated names> packet=<text> [precedence=<comma-separated names>]"
user-invocable: false
allowed-tools: Skill
---

# /guild-validate

Antagonist panel coordinator. Spawns one or more evaluator agents in
parallel against the same evaluation packet, parses each verdict,
and aggregates findings into a single panel verdict that the calling
loop can act on.

This skill is the second primitive in the `guild-*` substrate family.
It **composes `guild-spawn`** rather than calling the `Agent` tool
directly — the layering is the point. A loop using `guild-validate`
gets parallel agent invocation for free, structured aggregation, and
forward-compatible verdict shape, without re-implementing any of it.

`guild-validate` does not know about specific evaluator rubrics. It
expects each spawned agent to return a parseable verdict (see the
contract in `.claude/agents/evaluator-base.md`) and treats every
agent's output uniformly.

## Inputs

- `agents` — comma-separated `subagent_type` names of evaluators to
  spawn, e.g. `evaluator-contract-fit` (single-evaluator panel) or
  `evaluator-contract-fit,evaluator-a11y,evaluator-tokens` (multi-
  evaluator panel). Order is preserved in the output's per-evaluator
  fields.
- `packet` — the standard three-section evaluation packet (Contract /
  Artifact / Original ask). This is the shared brief handed to every
  evaluator. The packet shape is documented in `evaluator-base.md`.
- `precedence` (optional) — comma-separated ordered list of evaluator
  names for non-conflicting overlap resolution. When two evaluators
  flag the same issue with non-contradictory remedies, the higher-
  precedence one's finding is reported in the consolidated list.
  Defaults to input order when absent.

## Output format (locked to the design plan)

The output shape is fixed even when v1 will populate some fields
empty — downstream callers (loops, retry policies, PR builders)
depend on the shape:

```
{
  "verdict": "approved" | "flagged" | "flagged-conflict",
  "blocking_findings": [
    {
      "evaluator": "<agent name>",
      "code": "<flag code, e.g. criterion-unmet>",
      "evidence": "<one-line evidence>",
      "remedy": "<minimal concrete fix>"
    },
    ...
  ],
  "advisory_findings": [ ...same shape... ],
  "cli_runs": [
    { "evaluator": "<agent name>", "command": "<cmd>", "passed": true | false }
  ],
  "conflicts": [
    {
      "scope": "<file:line or shared scope>",
      "evaluators": ["<a>", "<b>"],
      "findings": [ ...the conflicting finding objects... ]
    }
  ]
}
```

`conflicts` is only non-empty when `verdict` is `flagged-conflict`.

## Process

1. **Validate inputs.**
   - If `agents` is empty, refuse with `guild-validate-error: empty agents list`.
   - If `packet` is missing or empty, refuse with `guild-validate-error: missing packet`.
   - Do not validate that named agents are role-typed `evaluator`. The
     substrate doesn't enforce this; if a non-evaluator is passed,
     `guild-spawn` will spawn it and `guild-validate` will attempt to
     parse a verdict from its output. A non-evaluator's output won't
     parse, which surfaces as a `parse-failure` in the aggregated
     output. Caller is responsible for choosing role-appropriate agents.
2. **Spawn evaluators in parallel.** Invoke `guild-spawn` via the
   `Skill` tool with `agents=<input agents>` and `brief=<input packet>`.
   Do not pass `per_agent_context` — every evaluator sees the same packet
   by design. (A future caller wanting domain-specific hints could spawn
   evaluators with per-agent context; this skill does not.)
3. **Parse and aggregate.** Build a JSON array of `{agent, output}`
   entries from `guild-spawn`'s outputs and pipe it to
   `bin/guild parse-and-aggregate` via stdin. The verb returns the
   locked Result shape (`{verdict, blocking_findings,
   advisory_findings, cli_runs, conflicts}`) on stdout. Bash invocation
   uses a quoted heredoc so JSON content passes through verbatim:

   ```bash
   bin/guild parse-and-aggregate <<'GUILD_INPUT'
   [
     {"agent": "evaluator-contract-fit", "output": "...full evaluator output..."}
   ]
   GUILD_INPUT
   ```

   The verb is the implementation; the rules below are the spec it
   honors:

   - For each entry, locate `VERDICT:`. `approved` → no findings.
     `flagged` → extract the Reasons section bullets as findings, plus
     the optional Suggested remedies section (paired with reasons by
     index). Missing or unparseable VERDICT line → one `parse-failure`
     blocking finding.
   - **v1 severity rule**: each reason is `blocking` by default. An
     explicit `BLOCKING:` or `ADVISORY:` prefix on the reason line
     overrides. (Today's evaluators emit unprefixed reasons; Phase 2
     evaluators with antipattern catalogs will emit explicit prefixes.)
   - Each finding has shape `{evaluator, code, evidence, remedy}`.
     `code` defaults to `criterion-unmet`; if the evidence text starts
     with `<word>(-<word>)*: ...` (kebab code prefix, optionally
     backtick-wrapped, optionally with parenthetical context), the
     prefix becomes `code` and the rest becomes `evidence`.
   - CLI runs: v1 evaluators do not emit a `## CLI runs` section, so
     `cli_runs` stays empty. Forward-compat infrastructure for Phase 2.
   - Verdict precedence: `conflicts` non-empty → `flagged-conflict`;
     else `blocking_findings` non-empty → `flagged`; else `approved`.
     Advisory-only is still `approved` — advisories surface but do not
     gate.
4. **Return** the script's output (parsed back into a structured
   value) to the caller. This skill performs no further work.

## Conflict detection (v1: future-work)

A conflict is two evaluators emitting blocking findings on the same
scope (file path, file:line, or named symbol) with **incompatible**
remedies — that is, applying both remedies would leave the artifact
broken.

In v1, conflict detection is a documented no-op:
- For single-evaluator panels (e.g. `[evaluator-contract-fit]` as
  used by ev-loop in unit 4), only one evaluator can fire, so
  conflicts cannot exist by definition. Return `conflicts: []`.
- For multi-evaluator panels (Phase 2+ when a11y, nextjs, react-api,
  tokens, naming evaluators land), the detection mechanism needs a
  shared scope-and-remedy comparison rule. That logic is a Phase 2
  concern and will be added to this skill's process step 4 then.

Until then, `flagged-conflict` is a verdict the API supports but v1
does not produce. Loops can write conflict-handling code that's ready
when it does.

## Aggregation rules (summary)

| Findings present | Verdict |
|------------------|---------|
| None of any kind | `approved` |
| Advisory only (no blocking, no conflicts) | `approved` (advisories preserved) |
| Blocking, no conflicts | `flagged` |
| Conflicts detected | `flagged-conflict` |

## What this skill does NOT do

- **Iterate or retry.** If the panel returns `flagged`, the caller
  decides whether to re-spawn after the generator addresses the
  remedies. This skill returns one verdict per call.
- **Auto-resolve conflicts.** When `flagged-conflict` fires, the
  conflicts list surfaces unaltered. The calling loop decides whether
  to surface to the human, auto-pick by precedence, or whatever the
  style layer prefers.
- **Validate evaluator role-typing.** Any named agent can be passed.
  Non-evaluators will produce parse-failures, which the caller sees
  in the output. The substrate doesn't gatekeep.
- **Modify the packet.** The packet passes through `guild-spawn`
  verbatim and is handed to every evaluator unchanged.

## Rules

- **Compose `guild-spawn`.** Do not call the `Agent` tool directly.
  The layering is the point.
- **Lock the output shape.** Even when v1 leaves fields empty,
  the structure is what downstream callers depend on.
- **No emojis.**

## Failure modes

- Empty `agents` list → `guild-validate-error: empty agents list`. Stop.
- Missing or empty `packet` → `guild-validate-error: missing packet`. Stop.
- `guild-spawn` itself errors (e.g. invalid agent name) → forward the
  error verbatim to the caller. Do not partially aggregate.
- One or more evaluator verdicts are unparseable → record
  `parse-failure` blocking findings for those evaluators; aggregate
  the rest normally; verdict is at minimum `flagged`.
- Every evaluator's output fails to parse → `verdict: flagged` with
  every entry in `blocking_findings` carrying a `parse-failure` code.
  The caller distinguishes "everyone said it's broken" from "the
  panel itself can't read what was returned."
