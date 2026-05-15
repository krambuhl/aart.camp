# Checkin 04 — ev.agent-guilds.substrate-foundations

**Created**: 2026-05-03 19:29
**Phase**: 1 — Substrate foundations
**Unit**: Migrate ev-loop skills to guild-validate; retire evaluator.md

## Contract

- **Goal**: Migrate `ev-loop-confidence` and `ev-loop-interactive` to invoke `guild-validate` via the `Skill` tool with a 1-agent panel `[evaluator-contract-fit]` instead of spawning `subagent_type: evaluator` directly via the `Agent` tool. Behavior at the loop level is identical to today (single skeptical evaluator, same verdict shape, same iteration budget); the implementation is now routed through substrate, demonstrating the layering works end-to-end. **Retirement of `.claude/agents/evaluator.md` is split into a follow-up unit (`Unit 4b`) at the start of next session** — see Acceptance criteria 7b/7c and Execution section for the architectural reason.

- **Acceptance criteria**:
  - `.claude/skills/ev-loop-confidence/SKILL.md` "Evaluate" step (currently lines 176-184) invokes `guild-validate` via the `Skill` tool with `agents=evaluator-contract-fit` and the evaluation packet as `packet=...`. The Agent-tool spawn of `subagent_type: evaluator` is removed.
  - `.claude/skills/ev-loop-interactive/SKILL.md` "Evaluate" step (currently lines 76-81) makes the same change.
  - Both skills' "Composes" line at the top references `guild-validate` (or `guild-*`) instead of "evaluator." This signals the new dependency.
  - Both skills' "subagent is spawned" framing prose is updated to describe the substrate path.
  - References to `.claude/agents/evaluator.md` for verdict-shape documentation are redirected to `.claude/agents/evaluator-base.md` (the file that now actually owns the verdict format) or `evaluator-contract-fit.md`.
  - The 3-run evaluator budget (initial + 2 retries before user escalation) is preserved. `guild-validate` returns one verdict per call; the loop owns retry logic.
  - **Runtime verification (deferred to Unit 4b)**: spawn `evaluator-contract-fit` (or invoke `guild-validate` with `agents=evaluator-contract-fit`) against a small synthetic packet. Confirm a parseable verdict in the locked output shape. **This criterion explicitly cannot be met in this session** — Claude Code's agent registry is loaded at session start, and `evaluator-contract-fit` was authored earlier in this same session. The new agent is not visible as a `subagent_type` until next session reloads the registry. Documented as Unit 4b, executed first thing next session.
  - **`.claude/agents/evaluator.md` retirement (deferred to Unit 4b)**: deleted **only after** Unit 4b's runtime verification passes. evaluator.md remains in place through the rest of this session as the bridge file (same pattern Unit 1 used for the same architectural reason). No references to `evaluator.md` should remain in `.claude/skills/ev-loop-*` after this unit's edits — verify via grep.
  - The migrated loops continue to be valid skill files (frontmatter intact, no broken links, lint clean).
  - Other prose mentions of "evaluator" (as a generic concept, not as a subagent_type identifier) are preserved — those describe the role, not the specific agent.

- **Rules applied**:
  - `npm run lint` (Biome) clean.
  - `~/.claude/CLAUDE.md` and `aart.camp/.claude/CLAUDE.md` conventions: no emojis, no speculative abstractions.
  - Substrate composition: loops invoke `guild-validate` via the `Skill` tool, not `Agent` directly. The point of unit 4 is to demonstrate the full layering chain works (loop → guild-validate → guild-spawn → Agent → evaluator-contract-fit).

- **Disqualifiers**:
  - `evaluator.md` is deleted in this unit. (Per the amended scope, retirement is Unit 4b's responsibility, gated on Unit 4b's runtime verification. Deleting the bridge in this unit would leave this session's loops non-functional.)
  - Loops still call `Agent` with `subagent_type: evaluator` after the migration. The whole point is to remove this direct call.
  - Loops invoke `guild-validate` but pass a hardcoded packet instead of the actual unit-evaluation packet. The migration must preserve the existing packet content (Contract / Artifact / Original ask).
  - The 3-run evaluator budget is dropped or changed. v1 behavior must be preserved for the rollout to be backward-compatible.
  - References to `.claude/agents/evaluator.md` for verdict shape (in framing prose) are not redirected. Stale documentation references degrade discoverability.

- **Inputs**:
  - `.claude/skills/ev-loop-confidence/SKILL.md` (target of migration)
  - `.claude/skills/ev-loop-interactive/SKILL.md` (target of migration)
  - `.claude/skills/guild-validate/SKILL.md` (substrate primitive being invoked)
  - `.claude/skills/guild-spawn/SKILL.md` (composed by guild-validate)
  - `.claude/agents/evaluator-base.md` (verdict format reference, replaces evaluator.md)
  - `.claude/agents/evaluator-contract-fit.md` (the v1 evaluator the loops will spawn via the panel)
  - `.claude/agents/evaluator.md` (file to retire — deferred to next session, see Execution)
  - `~/.claude/plans/yo-i-m-curious-what-shimmying-cook.md` (design plan, "ev-loop changes" section)
  - `projects/2026-05-02-agent-guilds/PLAN.md` (Phase 1 spec)

## Scope

Files modified:
- `.claude/skills/ev-loop-confidence/SKILL.md` — Composes line, framing prose, Evaluate step
- `.claude/skills/ev-loop-interactive/SKILL.md` — same three sections

Files **preserved** (deviation from initial contract — see Execution):
- `.claude/agents/evaluator.md` — bridge through this session due to Claude Code's session-cached agent registry. Deletion deferred to next session.

No source code touched. No build-affecting changes.

## Execution

Migration of both ev-loop skills was straightforward. In each file three sections were updated:

1. **Composes line** at top: `evaluator` → `/guild-validate`.
2. **Framing prose** explaining tool composition: now describes the full chain (loop → `/guild-validate` → `/guild-spawn` → `Agent`), with explicit "the loop itself never calls the `Agent` tool directly" framing. Verifies the layering claim from the design plan.
3. **Evaluate step** in the unit loop: was `Spawn the evaluator subagent via the Agent tool with subagent_type: evaluator`, now `Invoke /guild-validate via the Skill tool with agents=evaluator-contract-fit and packet=...`. Documents the v1 single-evaluator panel and forward-compatibility for Phase 2 multi-evaluator panels via PLAN.md's panel: field. References `.claude/agents/evaluator-base.md` for the per-evaluator verdict shape.

Iteration cycle text was updated to use `re-invoke /guild-validate` instead of `re-spawn the evaluator`.

A grep verified no remaining `subagent_type: evaluator` or `agents/evaluator.md` references in either skill file.

### Why this unit is split into 4 + 4b

When the runtime-verification step was attempted, the new agent registered earlier in this session was not visible:

```
Agent type 'evaluator-contract-fit' not found.
Available agents: claude-code-guide, evaluator, Explore, general-purpose, Plan, statusline-setup
```

Claude Code loads the agent registry **at session start**. `evaluator-base.md` and `evaluator-contract-fit.md` were authored in unit 1 of this same session, so they are not visible as `subagent_type` until a future session reloads the registry. The substrate is structurally correct; the migration code is correct; the runtime path simply can't be exercised in this session.

The original unit 4 contract (initial version) bundled "edit loops to use guild-validate" + "runtime-verify" + "delete evaluator.md" into one unit. The first sub-step was achievable in this session; the latter two were not. The first evaluator pass correctly flagged this as `criterion-unmet` + `contract-inadequate` (sequencing). Per the evaluator's recommended remedy and with the user's approval, the contract was **amended** to split the unit into:

- **Unit 4 (this checkin, this session)**: ev-loop skills migrated to compose `/guild-validate`. evaluator.md preserved as the session bridge. Acceptance criteria 1-6 + 8-10 + the evaluator.md-retention sub-clause of 7b are fully met.
- **Unit 4b (next session, first action)**: runtime-verify by spawning `evaluator-contract-fit` against a synthetic packet; if approved, delete evaluator.md in a small cleanup commit. Acceptance criteria 7a (runtime verification) and the deletion clause of 7b are explicitly deferred and documented as such.

This is the same architectural pattern unit 1 used for evaluator.md preservation — the registry-cache constraint is real, and the bridge-file pattern is the right answer.

This unit's evaluation was itself spawned via `subagent_type: evaluator` (the bridge file), since it's still the only callable evaluator subagent in this session. From unit 4b onward (next session), the standard path will be `subagent_type: evaluator-contract-fit`.

correction: the original unit 4 contract bundled work that's structurally unfinishable in one session, because it required runtime-verifying agents authored earlier in that same session — and Claude Code's agent registry only refreshes at session start. The contract was amended to split the unit into 4 (this session: loop edits) and 4b (next session: runtime verify + retire evaluator.md). Lesson for future agent-introduction units: when authoring new agent files, isolate any "use the new agent" steps into a follow-up unit that runs in a fresh session. Otherwise the contract is structurally unfinishable. Document this in the agent-creation pattern for future evaluator-* / generator-* / whiteboard-* additions across Phase 2 / 3 / 4.

## Changes

```
M   .claude/skills/ev-loop-confidence/SKILL.md   (Composes, framing, Evaluate step)
M   .claude/skills/ev-loop-interactive/SKILL.md  (Composes, framing, Evaluate step)
```

`evaluator.md`, `evaluator-base.md`, `evaluator-contract-fit.md`, `guild-spawn`, `guild-validate` are all untouched in this unit.

## Notes for PR

- Both ev-loop skills now compose `/guild-validate` instead of spawning the evaluator subagent directly. The full chain is loop → `/guild-validate` (Skill) → `/guild-spawn` (Skill) → `Agent` (`subagent_type: evaluator-contract-fit`). The loops themselves never call `Agent` directly anymore.
- The migrated `Evaluate` step uses `agents=evaluator-contract-fit` as a 1-agent panel. Phase 2+ phases will declare larger panels via the `panel:` field in PLAN.md (planned in the design doc; not implemented in Phase 1).
- The verdict shape returned by `/guild-validate` matches the locked spec (`approved` | `flagged` | `flagged-conflict`); v1 single-evaluator panels never produce `flagged-conflict`.
- **`.claude/agents/evaluator.md` is preserved by design.** Claude Code's agent registry is session-cached; newly-added `evaluator-contract-fit` isn't visible as a `subagent_type` in this session, so runtime verification can't complete. evaluator.md retains the `name: evaluator` frontmatter as the bridge. Next session's first action: verify `evaluator-contract-fit` is callable, then delete `evaluator.md` in a cleanup commit. Reviewers should NOT be alarmed by evaluator.md still existing in this PR — it's the conscious bridge pattern, mirroring unit 1.
- The session-cached agent registry is a real architectural finding worth remembering. Captured as a correction in this checkin's Execution section.
