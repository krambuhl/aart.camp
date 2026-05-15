# Interview trail: trout sunset

## Frame

User asked to plan a migration of "anything we can" from the trout substrate
(project birth, lifecycle, PRs, sessions) into loom (CLI-backed, JSON-first)
or draft (planning-only). Pre-interview repo survey showed loom and draft
already mirror trout's surface area; the question wasn't "build the new
substrates" but "what to do with the trout half."

Survey findings that shaped the questions:

- Loom already has full skill counterparts for `trout-pull-request`,
  `trout-pr-respond`, `trout-archive`, `trout-save-session`
- Draft has a heavyweight counterpart for `trout-plan` (grill-me) but
  no lightweight loom-plan exists — trout-plan's "I know what I want, just
  scaffold" mode is currently homeless on the loom side
- One active project (`adopt-biome`) is still trout-managed
- No deprecation signals in git log — they coexist deliberately today

## Q1: What's the end-state for trout?

- **Recommendation:** Deprecate fully — migrate anything useful, then delete
  the trout substrate. Forces convergence on a single substrate; stops the
  same decision being made in three places.
- **Answer:** Deprecate fully.
- **Why:** Eliminates the three-substrate maintenance tax on a small repo.
  Coexistence forever just kicks the decision down the road.

## Q2: How do we handle existing trout-managed projects?

- **Recommendation:** Drain, then delete. Don't write a converter. Let
  in-flight trout projects finish on trout (they're already shaped that way;
  converting mid-flight is risky).
- **Answer:** Drain, then delete.
- **Why:** Lower risk than mid-flight conversion. Cheaper than building a
  one-way converter. Trades speed for safety; the deprecation timeline is
  paced by real project completion rather than engineering effort.

## Q3: How rigorous should the parity audit be before declaring trout deprecated?

- **Recommendation:** Dedicate a phase to side-by-side comparison of the
  four mirrored skills; document gaps in a parity matrix.
- **Answer:** Trust loom + fix on demand.
- **Why:** Pragmatic. Loom shipped recently; if a real gap exists, someone
  will hit it. Pre-emptive audit overspends for the size of this repo. The
  drain period itself functions as a soft audit — anyone who needs trout
  during that time will surface real gaps.

## Q4: What's the plan for the trout-plan lightweight scaffold?

- **Recommendation:** Build a thin `loom-plan` skill — wraps
  `bin/loom project scaffold`, mirrors trout-plan's lightness.
- **Answer:** Collapse onto `/draft-plan` only.
- **Why:** One planning surface in the repo, not two. Sharper. Users who
  want speed answer questions tersely. Less duplication; less chooser
  ambiguity.

## Q5: How should the drain period be modeled in the plan?

- **Recommendation:** Two phases (Freeze, Delete) — drain modeled as a Phase
  2 dependency, not a phase.
- **Answer:** One phase: deprecate-and-delete in one shot.
- **Why:** Cleaner ledger. The "freeze" work is just an entry in PLAN.md;
  no need for a code-level signal phase. Single PR at trigger time. PLAN.md
  itself substitutes for any in-codebase freeze signal during the wait.

## Final approval

User approved the drafted PLAN.md as-is with slug `trout-sunset`. Risk #2
mitigation (immediate CLAUDE.md update redirecting project birth to
`/draft-plan`) stays as a footnote rather than being lifted into a Phase 0;
treated as part of merging the plan, not a tracked deliverable.
