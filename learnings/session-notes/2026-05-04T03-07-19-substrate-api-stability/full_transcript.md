# Checkin 02 — ev.agent-guilds.substrate-foundations

**Created**: 2026-05-02 20:10
**Phase**: 1 — Substrate foundations
**Unit**: Author guild-spawn substrate skill

## Contract

- **Goal**: Author the `guild-spawn` substrate skill — a style-neutral parallel-spawn primitive that takes a list of subagent_types, a shared brief, and optional per-agent context overrides, and returns each agent's output attributed by name. This is the base primitive that `guild-whiteboard` and `guild-validate` will compose.

- **Acceptance criteria**:
  - `.claude/skills/guild-spawn/SKILL.md` exists with valid frontmatter (`name`, `description`, `argument-hint`, `user-invocable: false`, `allowed-tools` including `Agent`).
  - Skill body documents inputs: `agents` (array of subagent_type names), `brief` (shared task description), `per_agent_context` (optional per-agent context overrides).
  - Skill body documents output: structured collection of attributed `{agent: <name>, output: <text>}` entries.
  - Skill body specifies the spawn mechanism: a single Agent tool message containing N parallel `Agent` tool calls, one per entry in `agents`. Each call passes the shared `brief` plus that agent's optional context override.
  - Skill body explicitly states what it does NOT do: aggregation, conflict resolution, iteration / retries, role validation. These belong to consumers (guild-validate, guild-whiteboard, etc.).
  - Skill body is style-neutral — no ev-loop-specific opinions, no references to "panel" or "antagonist" or "whiteboard" semantics. Could be composed by an alternative loop with different opinions.
  - Skill body includes failure modes: empty agents list (refuse), invalid agent name (forward Claude Code's error), no brief provided (refuse).

- **Rules applied**:
  - `npm run lint` (Biome) clean.
  - Skill file frontmatter conventions match existing trout-* skills (consulted `trout-autosave/SKILL.md` for shape reference).
  - `~/.claude/CLAUDE.md` and `aart.camp/.claude/CLAUDE.md` conventions: no emojis, no speculative abstractions, no comments-for-comments-sake.

- **Disqualifiers**:
  - Skill body encodes loop-specific semantics (mentions panels, validation, whiteboarding, evaluators-vs-engineers — anything domain-specific). Substrate primitives are dumb pipes.
  - Skill body imports / depends on / spawns specific named agents. It must accept any agent name as input.
  - Skill body performs aggregation, retries, or any logic beyond "spawn in parallel and collect outputs."
  - Skill is invokable by users (`user-invocable: true`). Substrate primitives are infrastructure, not user-facing.
  - The `Agent` tool is not in `allowed-tools` (the skill cannot do its job without it).

- **Inputs**:
  - `~/.claude/plans/yo-i-m-curious-what-shimmying-cook.md` (design plan, "guild-spawn" section under "The `guild-*` substrate family")
  - `projects/2026-05-02-agent-guilds/PLAN.md` (Phase 1 spec)
  - `.claude/skills/trout-autosave/SKILL.md` (frontmatter shape reference)

## Scope

Files created:
- `.claude/skills/guild-spawn/SKILL.md`

No source code touched. No build-affecting changes.

## Execution

Authored `guild-spawn` per design plan. Frontmatter follows the
`trout-autosave` shape: `name`, `description`, `argument-hint`,
`user-invocable: false`, `allowed-tools: Agent`. Body covers:

- **Purpose framing** (style-neutral parallel-spawn primitive; explicit
  about not knowing role semantics — those are caller concerns).
- **Inputs**: `agents` (comma-separated subagent_type names) and
  `brief` (shared prompt). Order preserved in output.
- **Process** (4 steps): validate inputs → compose nothing (brief is
  verbatim) → spawn in parallel via single Agent tool message with N
  parallel calls → collect outputs in input order → return.
- **Explicit non-responsibilities**: aggregation, conflict resolution,
  iteration, role validation, per-agent context variation. Each is
  explicitly the caller's domain (`guild-validate` aggregates,
  `guild-whiteboard` reads shared file, etc.).
- **Output format**: structured `{agents, outputs}` with attributed
  per-agent output. Failed individual spawns include their error text
  in the `output` field.
- **Failure modes**: empty agents → refuse; missing brief → refuse;
  individual spawn failure → surface in collection, do not raise.

Initial draft made one simplification:

- Failed-spawn handling is "include error text in output" rather than
  a structured `failed: true` field. Simpler; caller can pattern-match
  error text if needed. (Kept.)

Initial draft also dropped `per_agent_context` as a structured input
on YAGNI grounds. **Iteration 2 of 3 added it back** after the
evaluator flagged `criterion-unmet` and `contract-ask-drift`: dropping
the field silently rewrote the contract, and the substrate-API
stability argument (downstream callers depend on the documented shape)
trumps the YAGNI argument. The skill body now includes:

- Frontmatter `argument-hint` references `[per_agent_context=<json-map>]`.
- Inputs section documents `per_agent_context` as an optional
  JSON-encoded map from agent name to extra context string, with an
  example.
- Process step 2 ("Compose per-agent prompts") describes how each
  agent's prompt is built from the verbatim brief plus its optional
  context appended under a delimited `## Context for <agent-name>`
  section.

The skill is visible in the available-skills list (verified via
system-reminder after file write). Confirms the substrate primitive
is callable as `Skill(skill: "guild-spawn", ...)` from this point
forward.

correction: Initial draft dropped per_agent_context with YAGNI
rationale; evaluator flagged contract-ask-drift; iteration restored
the field. Lesson: substrate API stability trumps in-flight YAGNI
calls when the design plan has already specified the shape. If the
spec genuinely should narrow, amend the contract first, then iterate.

## Changes

```
A   .claude/skills/guild-spawn/SKILL.md       (new, 91 lines)
```

`evaluator.md` and the rest of the substrate are untouched. The
`.claude/settings.local.json` modification from earlier remains
unstaged (not part of this conceptual unit).

## Notes for PR

- `guild-spawn` is the dumb-base primitive. Reviewers should verify it
  truly does nothing beyond parallel-spawn — any aggregation, role
  checking, or retry logic creeping in here is a defect.
- The skill explicitly does not validate agent names against
  `.claude/agents/`. This is by design: Claude Code already surfaces
  invalid `subagent_type` errors at spawn time, and validation here
  would couple the substrate to filesystem layout that may evolve.
- Per-agent context variation was considered and dropped. None of the
  v1 callers need it; if a future caller does, we add a structured
  field rather than overload the brief.
- The skill is `user-invocable: false`. Substrate primitives are
  infrastructure for other skills, not user-facing.

