# PR #55 response plan — generated 2026-05-15

## Items

### Item 1 — Whiteboard step should not be opt-in  [Blocker]
- **Source**: krambuhl on `.claude/skills/ev-loop-interactive/SKILL.md:59` ([discussion](https://github.com/krambuhl/aart.camp/pull/55#discussion_r3246859935))
- **Summary**: The new `### Whiteboard (opt-in)` section frames the
  whiteboard step as opt-in via a PLAN.md `**Whiteboard**:` block.
  Reviewer says it should not be opt-in.
- **Proposed action**: Fix in code, but the framing decision needs
  one round-trip with the user first (per **L-002**, this is a
  mid-flight scope change — PLAN.md Phase 3 literally calls out
  "opt-in" as the spec, so flipping it is a real direction change
  rather than a typo correction). Options to surface:
  - **(A) Always-on with sensible defaults**: every phase runs the
    whiteboard step automatically. Phases without an explicit
    `**Whiteboard**:` block use a default engineer set (e.g. all
    six whiteboard engineers, single round) and a default topic
    derived from the phase name. PLAN.md block becomes an
    override, not a trigger.
  - **(B) Always-on with required config**: every phase MUST
    declare `**Whiteboard**:` with engineers + topic + rounds.
    Loop errors if missing. Most explicit; forces deliberate
    config but adds boilerplate.
  - **(C) Always-on but with `**No-whiteboard**:` opt-out**: the
    inverse of today. Default behavior runs the whiteboard; a
    phase suppresses by declaring an opt-out marker. Sidesteps
    PLAN-block boilerplate but adds the inverse keyword.
  - The plan-authoring loop should surface this fork to the user
    via AskUserQuestion before writing code.
- **If code change**: rewrite the `### Whiteboard` section in
  both `/ev-loop-*` SKILLs (drop "(opt-in)" qualifier + invert
  default behavior); update CONVENTIONS.md
  `## PLAN.md phase-config extensions` to match the new framing;
  amend D1 checkin's Notes for the PR with a `correction:`
  recording the framing shift.

### Item 2 — Run `/review-skill` on the new SKILL.md  [Suggestion]
- **Source**: krambuhl on `.claude/skills/guild-whiteboard/SKILL.md:15` ([discussion](https://github.com/krambuhl/aart.camp/pull/55#discussion_r3246861909))
- **Summary**: Reviewer asks for the skill body to be run through
  the project's `/review-skill` tool (a skill-audit pass).
- **Proposed action**: Adopt. Invoke `/review-skill` against
  `.claude/skills/guild-whiteboard/SKILL.md`, capture findings,
  and address blocking findings inline. Advisory findings get
  documented in the response unit's Notes for the PR for the
  user's review.
- **If code change**: depends on what `/review-skill` flags. If
  the audit returns clean, no code change beyond noting "audit
  ran, returned clean" in the response unit. Otherwise apply
  the suggested fixes to the skill body in the same response
  unit as Item 1's framing change.

### Item 3 — vercel[bot] deployment notice  [Praise / ack]
- **Source**: vercel[bot] ([comment](https://github.com/krambuhl/aart.camp/pull/55#issuecomment-4458189277))
- **Summary**: Automated Vercel deploy status comment. Status:
  Canceled (no preview was deployed because the substrate
  changes don't trigger a Vercel build — only product code
  changes do).
- **Proposed action**: No action. Informational only.

---

**Recommended next unit**: one new checkin `02.md` on
`ev.agent-guilds.whiteboard` that addresses Items 1 and 2 together.
Both touch the same surface area (the new skill body + ev-loop
integration sections), so bundling them in one unit keeps the
diff coherent. Begin Item 1 by surfacing the (A) / (B) / (C) fork
to the user via AskUserQuestion before writing code. Once the
framing is settled, apply the change, run `/review-skill`, address
its blockers (if any), commit, and re-invoke `/trout-pull-request`
to update the PR body.
