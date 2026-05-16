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

## Final approval (v1)

User approved the drafted PLAN.md as-is with slug `trout-sunset`. Risk #2
mitigation (immediate CLAUDE.md update redirecting project birth to
`/draft-plan`) stays as a footnote rather than being lifted into a Phase 0;
treated as part of merging the plan, not a tracked deliverable.

## Q6 (post-approval revision): What about the ev-loops themselves?

User flagged that ev-loop-confidence and ev-loop-interactive currently
compose `/trout-pull-request`, `/trout-pr-respond`, `/trout-save-session`
skills. Deleting trout while loops depend on it would break execution.

- **Recommendation:** Add a Phase 1 (loop migration) before the existing
  sunset phase. Loops migrate to compose `/loom-pr`, `/loom-pr-respond`,
  `/loom-session`, and `/draft-revise` skills. Phase 2 (sunset) gates on
  Phase 1 + drain.
- **Answer:** Migrate loops, but to direct CLI invocation (`bin/loom`,
  `bin/draft revise`) — NOT to ambient `/loom-*` skills.
- **Why:** "I want to avoid creating ambient skills for the agent that
  we don't really want end users to litter." Substrate plumbing (open a
  PR, save a session) doesn't earn a slot in the user-visible skill
  chooser. Loops should call CLIs directly. This rule applies
  retroactively to existing `/loom-pr`, `/loom-pr-respond`,
  `/loom-session`, `/draft-revise` skills — they get audited and pruned
  if they exist only as CLI wrappers.

## Q7 (post-approval): Loom for this project's own substrate?

- **Recommendation:** Eat the dogfood — adopt loom for trout-sunset's
  own execution substrate (manifest.json, events.jsonl, checkins/,
  sessions/), not trout.
- **Answer:** Yes, use loom for this project.
- **Why:** Consistency with the migration's intent. This project itself
  validates the new substrate; using trout would be a contradictory
  signal.

**Notable substrate gaps surfaced during adoption:**
1. `bin/loom project scaffold` refuses on existing dirs (this project
   already had PLAN.md + INTERVIEW.md from `bin/draft plan`), so the
   loom files were written manually (manifest.json, config.json,
   events.jsonl, checkins/, sessions/).
2. Once loom adopts a project, `bin/draft revise` can no longer find it
   because draft's resolver excludes anything with `manifest.json`.
   PLAN.md edits for loom-managed projects bypass the CLI seam entirely
   (this revision was applied via the Write tool directly).

Both gaps recorded as Open questions in PLAN.md for follow-up.
(In v3 these were lifted into Phase 1 scope — see Q8.)

## Q8 (post-approval): Are loom and draft alternatives, or paired?

User clarified: "my intention was that loom and draft are used together
exclusively against trout who used to do too much."

- **Recommendation (mine, before clarification):** Treat the
  coexistence gaps as future "open questions" — defer fixing them to
  another project; this project just documents them and works around
  them manually.
- **Answer:** Wrong frame. Loom and draft are paired halves of one
  substrate, not alternatives. The gaps are bugs in the substrate model
  the user explicitly designed for. They belong in scope, not deferred.
- **Why:** Trout did too much; the split (loom owns execution, draft
  owns planning) is the whole point. Every project gets both. The
  scaffold-refuses-on-existing-dirs and resolver-excludes-loom-projects
  bugs are actively preventing the model from working.

**Plan revision:** Promoted both gaps from "open questions" into a new
**Phase 1: Fix loom + draft coexistence**. Loop migration becomes
Phase 2; trout sunset becomes Phase 3. Phase 2 depends on Phase 1.
Also added auto-loom-adopt to `bin/draft plan` as a Phase 1 deliverable
(the substrate-pair model implies one entry point produces both
substrates; `--no-loom` is the escape hatch).

Reframed Context to lead with the pairing. Updated Decisions list. Saved
the new framing as a feedback memory so future sessions don't make the
same wrong-frame mistake.
