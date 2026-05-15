# Retrospective — Draft: a grill-me-shaped planning CLI and skill

**Archived**: 2026-05-15
**Duration**: 2026-05-15 → 2026-05-15 (single-day project, roughly 8 working hours)
**PRs**: #70, #74, #75, #77, #80, #81, #83, #85

## What we set out to do

Ship a heavyweight planning substrate alongside `/trout-plan`. Where
`/trout-plan` interviews briefly for users who already know what they
want, this project ships a grill-me-shaped path: relentless interview,
one decision at a time, recommendation each time, walking the decision
tree branch by branch. Two artifacts per project (`PLAN.md` clean,
`INTERVIEW.md` walked-trail), a small CLI (`bin/draft` with `plan` /
`revise` / `read`), two skills (user-facing `/draft-plan` and
loop-invoked `/draft-revise`), and ev-loop wiring that notices when
PLAN.md drifts and offers a revision.

## What actually happened

Eight deliverables shipped across eight PRs in a single day. The
substrate itself evolved while we were building on top of it, which
forced three meaningful mid-project pivots and turned the project into
a live test of its own revision flow.

The original plan was a single PR per phase. PR #70 (D1) merged
standalone within minutes of opening — that was the first signal that
actual practice in this repo is one PR per deliverable, matching
loom-cli's cadence. PLAN.md got revised inline (D5's PR carried the
update), and the remaining deliverables shipped per-PR as the work
naturally suggested. Two consolidations followed: D5+D6 (revise + read
verbs, sharing `resolveTroutProject`) and D7+D8 (the two skills, both
shelling to the CLI) merged into single PRs at the user's direction.
Each was the right granularity — splitting would have duplicated
scaffolding for no review benefit.

The second pivot was loom's. While D5 (revise + read verbs) was being
built, loom-cli's `listProjects` got updated to filter by a
`manifest.json` marker — formalizing the trout/loom coexistence
boundary. Draft's own resolver (D3) had been written to filter on
`MANIFEST.md`, but draft's own `plan` verb produces projects with
`PLAN.md` + `INTERVIEW.md` only (no MANIFEST.md). The end-to-end smoke
in D5 surfaced the gap: draft couldn't find its own output. Fixed
inline by broadening the resolver filter to "PLAN.md present +
`manifest.json` absent." Trout-managed projects (with both files)
still qualified; loom projects still didn't. The change shipped in
D5's PR alongside the verbs.

The third pivot was a runtime quirk. The whiteboard step at phase
start needed `whiteboard-*` agents loaded by the Claude Code runtime —
but those agents had been authored in prior sessions, and the runtime
registry doesn't refresh on `/clear`. The first whiteboard invocation
failed; the workaround was a full Claude Code restart to reload the
agent registry. Worth a substrate-side documentation note (L-004 lives
at runtime, not just disk).

Throughout, we got to dogfood the project's own revision flow. Every
mid-project pivot above was exactly the kind of scope shift
`/draft-revise` is designed to handle — we manually revised PLAN.md
inline (because `/draft-revise` was still being built), but the
pattern matched what the loop wiring would automate. By the time D7
landed the wiring, the project had already used the revise flow three
times.

## What went well

- **TDD discipline held**. Every CLI verb (createSlug, plan, revise,
  read) was written test-first; the failing test commits before the
  implementation in git history. The pure/effect split per verb —
  `DraftCliContext` with injected `gitRunner` and `today` — made the
  tests deterministic and the verb logic visible. This pattern is
  worth replicating in any future CLI work.

- **The substrate dogfooded itself**. Three mid-project scope shifts
  each got handled by revising PLAN.md inline before the next
  deliverable started. The project's own revision flow worked even
  before `/draft-revise` shipped — because the pattern is just "notice
  drift, write a new PLAN, commit." The CLI/skill formalize that; the
  underlying flow is already humane.

- **Consolidation calls were tactical and clean**. Combining D5+D6
  (revise + read verbs, sharing the resolver) and D7+D8 (the two
  skills, both shelling to the CLI) produced clearer reviews than the
  original per-deliverable split. The signal: when two deliverables
  share scaffolding deeper than the surface (resolver, skill body
  structure), splitting them costs more than it saves.

- **Loom convention reuse paid off**. Mirroring `loom.ts` for the
  entry-file structure, `bin/loom` for the shim, `verbs/<namespace>.ts`
  for the verb file layout, and `LoomError` for structured errors
  meant the draft CLI was structurally familiar within ~30 minutes of
  the scaffold landing. No design debate; just follow the established
  pattern.

- **Identical-prose-in-both-loops for the scope-shift wiring (D7)
  worked**. Bounded duplication beat shared-doc indirection at
  scale-of-two. If a third loop ever appears, extract. That's a
  cheaper decision rule than "always factor" or "always inline."

## What didn't

- **The substrate co-evolution friction was real**. Three pivots in
  one day each cost ~30 minutes to absorb, even though each was
  trivial once understood. The friction wasn't the changes themselves;
  it was that the project's mental model had to keep updating
  mid-flight. We don't have a great way to surface "the substrate
  shifted under you" automatically — every pivot was caught by hand
  when something broke or felt wrong. The very feature this project
  built (scope-shift detection) is the long-term answer, but it
  only catches shifts internal to a project, not external substrate
  shifts.

- **The whiteboard L-004 runtime boundary surprised us at phase
  start**. The skill was authored expecting agents to be available;
  the runtime had a different set loaded. The error message was
  cryptic ("Agent type 'whiteboard-skeptic' not found. Available
  agents: ..."). A more substrate-aware error would have caught this
  faster.

- **Slug-grammar regex duplication is still there**. `SLUG_RE` and
  `DATELESS_RE` live verbatim in both `lib/project.ts` (loom-owned)
  and `lib/draft-project.ts` (draft-owned) because loom doesn't export
  them. We documented the duplication in each file's header but didn't
  lift to a shared constants file. It's a small follow-up.

- **`LoomError` is a slight name asymmetry for draft**. When draft
  throws an error, the class name in the stack trace reads as "this
  came from loom" — confusing for anyone debugging draft. We declined
  to rename in this project's scope (substrate-wide rename is a
  separate effort if/when it earns its weight), but the asymmetry is
  there.

- **`parse-and-aggregate.ts` strict-mode tripped us twice**. The
  evaluator panel's VERDICT-line parser expects `VERDICT: approved`
  on a clean line; parenthetical qualifiers (`VERDICT: approved
  (not applicable)`) trigger a `parse-failure`. Worked around by
  briefing evaluators on the strict rule, but the parser could be
  tolerant of trailing context — that's a substrate-side
  brittleness worth noting.

## Findings

1. **The pure/effect split per CLI verb is reusable.** `DraftCliContext`
   with injected `gitRunner` + `today` made tests deterministic without
   stubbing the filesystem or shelling out. Pattern is worth lifting
   into a learning so future CLI work starts with this shape.

2. **Identical-prose-in-both-loops worked for the scope-shift wiring.**
   The decision rule "duplicate at scale-of-two; extract when a third
   writer appears" is a cheap heuristic that beats premature shared
   docs. Worth lifting into a learning.

3. **The `signal:` note prefix convention** (D7) lets a loop surface
   "detected but below threshold" without interrupting. Parallel to
   the existing `correction:` prefix in checkin Notes. The pattern
   will probably appear elsewhere; worth naming.

4. **Whiteboard agent registry doesn't refresh on `/clear`.** L-004
   exists at runtime, not just disk. Worth a substrate-side
   documentation note where the L-004 learning is captured (probably
   `learnings/rollup.md`).

5. **`parse-and-aggregate.ts` strict VERDICT-line matching is
   brittle.** Tolerating trailing context (or stripping it before
   match) would prevent the parse-failures we hit twice this
   project. Substrate-side robustness improvement.

6. **`LoomError` name asymmetry for draft consumers.** Stack traces
   from draft errors read as loom-sourced. Documented and accepted in
   this project; substrate-wide rename is a separate effort.

7. **Slug-grammar regex duplication.** `SLUG_RE` and `DATELESS_RE`
   live verbatim in both `lib/project.ts` and `lib/draft-project.ts`
   because loom doesn't export them. Small substrate cleanup.

8. **When `loom project scaffold` ships fully, `bin/draft plan` could
   delegate** the directory-creation step instead of doing it itself.
   No problem today (loom-cli's scaffold landed in #76); revisit on
   the next draft-related project.

## Dispositions

Approved 2026-05-15.

| # | Finding | Disposition | Action |
|---|---------|-------------|--------|
| 1 | Pure/effect split per CLI verb | **Defer (lift to learnings)** | Capture via `/griot-capture` in a future session — pattern is reusable for any future CLI verb work. |
| 2 | Identical-prose-at-2, extract-at-3 | **Defer (lift to learnings)** | Capture via `/griot-capture` in a future session — decision rule for shared prose vs duplicated prose. |
| 3 | `signal:` note prefix convention | **Defer (lift to learnings)** | Capture via `/griot-capture` when the next loop scope-shift mechanic appears. |
| 4 | Whiteboard registry doesn't refresh on `/clear` | **Defer (lift to learnings)** | Capture as a corollary to existing L-004 (runtime boundary, not just disk boundary). |
| 5 | `parse-and-aggregate.ts` strict VERDICT-line matching | **Follow-up** | Dispatch as standalone PR or via `/trout-plan` for a small substrate-cleanup project. Suggested fix: tolerate trailing context (or strip it) before the `VERDICT:` match. |
| 6 | `LoomError` name asymmetry for draft consumers | **Defer** | Substrate-wide rename earns its weight only if more CLIs join the substrate. No action today. |
| 7 | Slug-grammar regex duplication (`SLUG_RE`/`DATELESS_RE` in both `lib/project.ts` and `lib/draft-project.ts`) | **Follow-up** | Trivial substrate cleanup PR: export the regexes from `lib/project.ts`, drop duplicates in `lib/draft-project.ts`. |
| 8 | `bin/draft plan` delegation to `loom project scaffold` | **Defer** | Loom-cli is archived; revisit only when the next draft-style project surfaces a need. |

**Summary**:
- 0 Inline (nothing trivial enough to apply in the archive PR).
- 2 Follow-up (substrate cleanups: findings #5 and #7).
- 0 New project.
- 6 Defer (4 with intent to capture via `/griot-capture` later, 2 pure record).

The two follow-ups will be surfaced as suggested commands at the end
of this archive ritual; this skill does not auto-dispatch them.
