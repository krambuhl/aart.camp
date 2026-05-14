# Retrospective — Migrate griot-compact to subagents

**Archived**: 2026-05-14
**Duration**: 2026-05-08 → 2026-05-14 (6 days, calendar)
**PRs**: #21, #22, #24, #25 (Phase 1) · #27, #29, #31 (Phase 2) · #38 (Phase 3)

## What we set out to do

Dissolve the SDK-driven `/griot-compact` orchestrator (a Node script at
`scripts/learnings-compact/` calling `@anthropic-ai/sdk` directly) into
a subagent-driven pipeline orchestrated by the `/griot-compact` skill
itself. Move the judge panel from seven version-pinned Anthropic models
to four tier-based slots (2 Opus, 1 Sonnet, 1 Haiku) callable via the
Agent tool on pooled subscription tokens. Keep griot internally cohesive
as its own family (`griot-base.md` plus five role files, two
deterministic helpers under `.claude/scripts/griot/`) but fully isolated
from the `guild-*` substrate — the patterns rhyme, the code does not.

## What actually happened

**Phase 1 (Substrate, four PRs, ~3 days)** landed cleanly. D1 added six
subagent files (one base + five roles). D2 rewrote
`learnings/config.yaml` end-to-end from 7-judge version-pinned to
4-judge tier-based, dropping the SDK-era `weight`, `max_tokens`, and
`execution.*` fields. D3 added `mediate-panel.ts` — a pure stdin→stdout
JSON transformer that absorbs the SDK mediator's deterministic logic
(verdict parsing, tally, threshold check, tier-split detection,
tiebreak). D4 added `operator-checks.ts` — a two-mode helper
(`verify-rubric` for rubric-tampering detection, `log-intervention`
for JSONL appends). Every deliverable shipped under both lint and
test gates; the SKILL.md still pointed at the SDK path through Phase 1,
so nothing broke.

**Phase 2 (Migration, three PRs, ~2 days)** rewrote
`.claude/skills/griot-compact/SKILL.md` in three layered passes. D1
(#27) replaced the thin `npm run learnings:compact` wrapper with a
fully-articulated skeleton: pre-flight, per-note pipeline (Steps A–F)
covering the happy paths (`IMPROVED`, `DID_NOT_REPRODUCE`), end-of-run
housekeeping. `UNCHANGED`/`REGRESSED` was stubbed as
`deferred_pending_rewrite_loop`. The skeleton was end-to-end functional
for any note that reached `IMPROVED` or `DID_NOT_REPRODUCE` on the
panel. D2 (#29) added the attempt loop and operator escalation: rubric
integrity check before each rewrite, `griot-rewriter` invocation on
attempt > 1, synthetic verdicts (`RUBRIC_TAMPERED`, `REWRITER_FAILED`,
`STUCK_LEARNING`) routed to outcome handlers. All JSONL appends got
centralized through `operator-checks.ts log-intervention` — a refactor
that removed the implicit-formatting burden from the orchestrator. D3
(#31) added §3 Regression suite (read prior `passing_ids` from
bench-history's last line, run a single-spawn pass-check per rollup
entry at opus tier, log only newly-failing entries) and §4 Compose
nightly PR body (a markdown blob emitted to the user, no file write).
SKILL.md grew 98 → 332 → 478 → 665 lines across the three passes.

**Phase 3 (Cleanup, one PR with two checkins, ~3 days elapsed)** turned
into the most consequential phase. PLAN.md scoped it as a small
deletion — drop `scripts/learnings-compact/`, drop the npm script,
drop the dep, update prose. But Phase 2's PLAN.md verification step
("real subagent run on a small batch of session-notes, with the rollup
diff reviewed manually") had no committed record on disk: nothing in
Phase 2's PRs or checkins captured the wet-run proof, even though Phase
1's substrate flipped to `completed` on the basis of it. Rather than
delete first and verify after, checkin 01 of Phase 3 ran the wet
validation that should have been Phase 2's: five notes drove every
pipeline path that mattered (pre-flight, rubric-author, control +
treatment parallel spawn, 4-judge round 1, debate-summarizer, round 2
with prior reasoning, `mediate-panel.ts` math, `operator-checks.ts`
verify-rubric and log-intervention across three log paths, archive
moves, rollup writes, and most load-bearing — the rewriter loop firing
on a real UNCHANGED outcome).

The wet run surfaced two real ambiguities in `griot-judge.md`'s
verdict-derivation rules that no design-time review had caught. (1)
Both "if control and treatment are effectively identical, the verdict
is UNCHANGED — not DID_NOT_REPRODUCE" and "only use DID_NOT_REPRODUCE
when control already passes every assertion" can hold simultaneously,
and different judges resolved it different ways. Fix: restructure into
a precedence-ordered first-match-wins list, with `DID_NOT_REPRODUCE`
ahead of `UNCHANGED` (downstream actions differ — DNR archives,
UNCHANGED triggers rewrites). (2) The IMPROVED rule required *every*
assertion control failed to now pass in treatment; partial progress
falls through into a verdict gap that the four labels don't cleanly
cover. Fix: drop the second conjunct, since rule 1 already catches
treatment-introducing-new-failures earlier in the precedence chain.
Both fixes landed inline in checkin 01.

Two learnings promoted via the wet run: **L-001** "Node 24 strips TS —
use `node` directly" (4/4 round-2 IMPROVED after the debate summary
made the fault line explicit) and **L-002** "Halt-and-fork on
mid-flight scope expansion" (unanimous round-1 IMPROVED). Checkin 02
then did the actual cleanup and immediately got to apply L-002 twice:
**Fork 1** (the `learnings-report.ts` consumer imports from the
deletion target; lift `config.ts` out before deleting, or inline, or
also delete, or revise PLAN — user picked lift) and **Fork 2**
(post-deletion, `npm run learnings:report` throws against the new
bench-history shape because Phase 2's intentional schema change was
never propagated to the consumer — surfaced as a deferred fork rather
than absorbed into this checkin).

After checkin 02 merged as PR #38, the migration was complete:
`scripts/learnings-compact/` is gone, `@anthropic-ai/sdk` is gone, the
API-key prereq is gone. One path from session-notes to rollup.md; one
set of types feeding it; zero `@anthropic-ai/sdk` imports anywhere in
the live tree.

## What went well

- **Three-phase decomposition held perfectly.** Substrate (PRs 1–4) →
  Migration (PRs 5–7) → Cleanup (PR 8). Each phase was reviewable
  independently; each deliverable inside a phase was a single
  conceptual unit; the dependency graph between phases was honored
  (Phase 1's substrate landed before Phase 2 referenced it; Phase 2
  shipped end-to-end before Phase 3 deleted the old path).

- **Subagent isolation between griot and guild held.** No accidental
  coupling crept in. `griot-base.md` shares its *pattern* with
  `evaluator-base.md` but zero files or code. The orchestrator skill
  calls Agent directly rather than via `guild-spawn`, which felt
  redundant at first but proved correct in the wet run — the per-note
  flow's spawn shapes (4 judges in parallel, sequential rewriter, etc.)
  are genuinely different from anything the guild family does.

- **The tier-based panel works, and debate round 2 isn't theater.**
  Both wet-run IMPROVED notes (L-001 and L-002) saw real position
  shifts between rounds. L-001 flipped from 3 IMPROVED + 1 UNCHANGED to
  4/4 IMPROVED after the debate summary made the assertion-3 fault
  line explicit. The dogfood note flipped 3-1 IMPROVED → 4-0 UNCHANGED
  (complete consensus inversion). Judges actually move when they see
  other reasoning; the round-2 path is doing real work and shouldn't
  be optimized away.

- **Halt-and-fork pattern got self-validated in the same session it
  was promoted.** L-002 was written from the wet run in checkin 01;
  checkin 02's two forks were the first applications, both raised
  explicitly with named options rather than silently absorbed. The
  validation-and-application loop ran in 24 hours.

- **The deterministic-helpers-out-of-skill split is correct.** Pulling
  `mediate-panel.ts` and `operator-checks.ts` out of the SKILL.md
  meant the JSON-shaped logic (parse a fenced verdict block, tally,
  threshold-check, write a JSONL line) is unit-tested in vitest, and
  the skill prose stays focused on orchestration. The skill body
  describes *what happens* in human-readable procedural natural
  language; the scripts describe *how* in code with tests.

## What didn't

- **Phase 2's verification got rescued by Phase 3.** PLAN.md named
  "real subagent run on a small batch of session-notes, with the
  rollup diff reviewed manually" as Phase 2's gate. No Phase 2 commit
  captured proof of that run. Phase 2 flipped to `completed` in the
  manifest anyway, and the deletion in Phase 3 would have shipped on
  top of an unverified pipeline if checkin 01 hadn't taken the
  verification onto itself. This is luck dressed as discipline. The
  substrate (`/ev-loop-interactive`, `/trout-autosave --phase-update`)
  doesn't currently check that a phase's PLAN.md-declared verification
  was satisfied before letting `phase-completed` be recorded — and
  there's no clear universal shape for "verification was satisfied"
  the substrate could mechanically enforce.

- **Two rule ambiguities in `griot-judge.md` shipped through every
  layer of design review.** The precedence-conflict between
  DID_NOT_REPRODUCE and UNCHANGED, and the IMPROVED-strict-conjunct
  gap, both existed in the file from Phase 1 D1 onward. They were
  re-read during Phase 2 D1 (when the SKILL.md got rewritten to
  spawn `griot-judge` directly), and re-read again during Phase 3 D1
  contract authoring. No human or evaluator caught them. They only
  surfaced when real Opus/Sonnet/Haiku judges voted *differently* on
  the same case in the wet run. Spec gaps in evaluation rules don't
  surface against design review; they surface against real inputs.

- **`learnings-report.ts` is broken against the new bench-history
  shape** (Fork 2 from checkin 02). Phase 2 changed the bench-history
  record schema (PLAN.md **Out** section: "sparser rows, no per-call
  token granularity from subagents") but `learnings-report.ts` was
  never updated to read it. The first records to land on the new
  schema were L-001 and L-002 from the wet run; running the report
  against them throws at `bench.verdict_counts.IMPROVED`. The
  consumer wasn't on anyone's radar during Phase 2 because nothing
  was running against the new schema yet. Cleanup-by-deletion
  discovered it, didn't fix it.

- **The wet-run corpus has structural bias toward
  `DID_NOT_REPRODUCE`.** When the corrected artifact lives on disk
  and the prompt invites Claude to read it, the control output
  routinely cribs from the fix and "passes" every rubric assertion.
  This isn't a pipeline bug — it's a property of how session-notes
  are captured (after the fix lands, in the same repo). The two
  notes that hit IMPROVED were ones where the failure mode required
  either knowledge of an external-to-repo capability (Node 24
  strip-types) or process-shaped behavior (raising a scope fork) —
  failure modes that reading the codebase doesn't resolve. The first
  scheduled nightly run on the 22-note backlog should expect a high
  DNR share; the metric is corpus-structural, not pipeline-broken.

- **Three pipeline paths remain unexercised post-archive.** The
  operator stuck-learning escalation only fires after five failed
  rewriter attempts on one note — out of wet-run scope. The
  regression suite §3 will run on the next `/griot-compact`
  invocation now that rollup.md has entries. The round-2
  no-consensus fallthrough requires a genuinely deadlocked panel the
  wet run did not produce. All three are expected to be exercised by
  real nightly runs over the next few weeks. Not a blocker for
  archive; worth flagging so we know what's still mechanically
  unproven.

- **Phase 1 was probably over-decomposed.** Four PRs for substrate
  is heavy for what it shipped. D1 (subagent files) and D2 (config
  schema) are tightly coupled — the config references role names the
  subagent files declare. D3 (`mediate-panel.ts`) and D4
  (`operator-checks.ts`) are independent helpers that share an
  output pattern (stdin→stdout JSON, vitest co-located). They could
  have been 2 PRs (substrate-definitions + helpers) without losing
  review surface. Phase 2's three deliverables felt right; Phase 1's
  four felt like one PR too many.

## Findings

1. **Phase verification gate isn't enforced by the substrate.**
   PLAN.md declared a verification for Phase 2; no commit landed it;
   the manifest still flipped to `phase-completed`. The substrate has
   no mechanical check tying PLAN.md's verification clause to a
   measurable "yes, it ran" signal.

2. **Two rule ambiguities in `griot-judge.md` survived design review
   and only surfaced against wet inputs.** Already fixed inline in
   Phase 3 checkin 01. The meta-pattern — verdict rules need real
   judge votes to validate — is the part worth preserving.

3. **`learnings-report.ts` runtime breakage against the new
   bench-history shape.** Phase 2 intentionally changed the schema;
   the consumer was never updated. Discovered post-deletion in
   checkin 02 Fork 2. Two reasonable paths: (a) rewrite the report to
   read the new shape and surface tier-based panel metrics, (b)
   retire the report (the metrics it surfaced — per-judge tokens and
   calibration drift — were explicitly cut by Phase 2 and have no
   replacement).

4. **Wet-run corpus has structural bias toward `DID_NOT_REPRODUCE`.**
   When the corrected artifact lives on disk and the prompt invites
   reading, control cribs the fix and passes trivially. Operational
   observation; affects how to read the first scheduled nightly's
   metrics.

5. **Three pipeline paths remain unexercised post-archive.**
   Operator stuck-learning escalation, regression suite §3,
   round-2 no-consensus fallthrough. None blocked archive; all
   expected to be exercised by real nightly runs.

6. **Phase 1 was over-decomposed (4 PRs for substrate).** D1+D2 are
   tightly coupled; D3+D4 are independent helpers with a shared
   output pattern. Could have been 2 PRs.

## Dispositions

| # | Finding | Disposition | Action |
|---|---------|-------------|--------|
| 1 | Phase verification gate not enforced by substrate | **Defer** | Substrate concern beyond griot's scope; would need a phase-verification contract designed first. Captured in this retro so future projects don't trip the same way. |
| 2 | Two rule ambiguities in `griot-judge.md` survived design review | **Defer (already fixed)** | Both rules patched inline in Phase 3 checkin 01 (precedence-ordered first-match-wins list; dropped strict IMPROVED conjunct). Meta-lesson "verdict rules need wet inputs to validate" captured in narrative above. |
| 3 | `learnings-report.ts` runtime breakage against new bench-history shape | **Follow-up** | Recommend retirement over rewrite — the metrics it surfaced (per-judge tokens, calibration drift) were explicitly cut by Phase 2 and have no replacement in the tier-based pipeline. Suggested command: `/trout-plan retire-learnings-report` or a small one-shot PR. User to decide between planned and direct shape. |
| 4 | Wet-run corpus structural bias toward `DID_NOT_REPRODUCE` | **Defer** | Operational observation; will become evidence-driven on the first scheduled nightly run. Captured here so the first-nightly reader knows what to expect when interpreting DNR share against the 22-note backlog. |
| 5 | Three pipeline paths unexercised post-archive | **Defer** | Operator stuck-learning escalation, regression suite §3, round-2 no-consensus fallthrough. All three expected to be exercised by real nightly runs over coming weeks. Revisit if any path still hasn't been exercised in 30 days. |
| 6 | Phase 1 over-decomposed (4 PRs for substrate) | **Defer** | Backward-looking critique with no fix for this project. Captured for future projects: Phase 1 substrate with tight-coupling pairs (config + roles, helpers with shared output patterns) can land as 2 PRs without losing review surface. |

No inline findings applied. One follow-up (#3) to dispatch after archive PR is up.

