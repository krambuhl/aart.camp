# Evaluator packet — Checkin 14 (D12: e2e verification + autosave --init removal; closes Phase 1.5)

## How to evaluate efficiently

You have a tight tool-use budget (maxTurns=5). Pre-computed verification
below is authoritative — do not re-run lint/build/test/grep unless you
find specific evidence the artifact summary contradicts itself.
Spot-check at most ONE or TWO criteria with targeted reads, then emit
`VERDICT:`.

**Important context:** D12 is the closer for Phase 1.5. Two distinct
work products in one checkin: (a) end-to-end exercise of the migrated
substrate scripts against a throwaway test project (now archived at
`projects/archive/2026-05-09-phase-1-5-test/`), and (b) removal of the
deferred-from-D10 `autosave.ts --init` code path plus its 4 tests.
Both are deliberately bundled because they're conceptually one closing
unit: "the new path works (verified) AND the old path is gone (cleaned
up)."

## Contract (paraphrased)

**Goal**: Verify Phase 1.5 migrated substrate scripts compose
end-to-end against a real throwaway test project. Remove orphaned
`autosave.ts::runInit` + `--init` flag (deferred from D10's AC #3) and
its 4 `--init` tests. Mark Phase 1.5 complete via autosave.

**Acceptance criteria** (full text in
`projects/2026-05-02-agent-guilds/checkins/ev.agent-guilds.phase-1-5-substrate-cleanup-9/14.md`):

1. Test project scaffolded at `projects/2026-05-09-phase-1-5-test/`
   via direct `plan-scaffold.ts` invocation (D10 path).
2. `autoload.ts` (D3) exercised on the test project; briefing renders.
3. Test project's checkin 01 manually authored (no `/ev-loop-interactive`
   recursion).
4. `autosave.ts checkin-created` event recorded for the test project
   (D2 path).
5. `save-session-finalize.ts` (D8) exercised; session note written.
6. `archive-relocate.ts` (D7) exercised; project moves to
   `projects/archive/`, MANIFEST `**Status**` flips to `archived`.
7. `autosave.ts --init` code path removed (`runInit`,
   `resolveInitTarget`, `InitDetail`, `--init` flag, related
   validation, ARG_HINT update, unused imports cleaned). `~70` line
   estimate; actual `-114` lines.
8. 4 `--init` tests removed from `autosave.test.ts`. `~55` line
   estimate; actual `-57` lines.
9. Phase 1.5 marked complete via `autosave --event=phase-completed
   --detail=1.5 --phase-update=1.5:completed`.
10. Verification: lint clean, build clean, test pass (210 expected
    after `-4` from `--init` test removal), test project absent from
    `projects/`, present in `projects/archive/` with `Status: archived`,
    autosave.ts shrunk significantly (target `≤410`; actual `362`).
11. No co-located refinements bundled (substrate findings logged as
    Notes, not addressed).

**Disqualifiers** (single-line summary): Test project NOT scaffolded
via plan-scaffold; NOT archived via archive-relocate; session note NOT
written via save-session-finalize; `autosave.ts --init` code retained;
`autosave.test.ts` retains `--init` tests; Phase 1.5 NOT marked
complete; real GitHub PR opened for test project; real evaluator run
for test project's dummy unit; test project's MANIFEST modified by
hand instead of through scripts; sibling project state polluted;
`project-initialized` event vocabulary entries removed (only `--init`-
specific tests, not vocabulary refs); substrate refinements bundled.

## Artifact

**Files** (created/modified/deleted):
- CREATED: `projects/2026-05-02-agent-guilds/checkins/.../14.md` (this checkin)
- CREATED: `projects/2026-05-02-agent-guilds/checkins/.../14-packet.md` (this packet)
- CREATED: `projects/archive/2026-05-09-phase-1-5-test/` directory tree (5 files: PLAN.md, config.md, MANIFEST.md, sessions/2026-05-09-a.md, checkins/ev.phase-1-5-test.verify/01.md). Created at `projects/2026-05-09-phase-1-5-test/` then relocated to `projects/archive/` by `archive-relocate.ts` — git history shows the rename.
- MODIFIED: `.claude/scripts/trout/autosave.ts` (476 → 362 lines; -114 net)
- MODIFIED: `.claude/scripts/trout/autosave.test.ts` (348 → 291 lines; -57 net, -4 tests)
- MODIFIED: `projects/2026-05-02-agent-guilds/MANIFEST.md` (branch reconciliation + phase-completed event + phase 1.5 row → completed)

**Pre-computed verification (authoritative — do not re-run)**:
- `npm run lint` → clean (only pre-existing symlink warnings).
- `npm run build` → clean.
- `npm run test` → **210 / 210 passing across 14 test files** (was 214; -4 from `--init` test removal, exactly as expected).
- `wc -l .claude/scripts/trout/autosave.ts` → 362 (was 476; cap target ≤410 ✓).
- `wc -l .claude/scripts/trout/autosave.test.ts` → 291 (was 348; cap target ≤295 ✓).
- `test -d projects/2026-05-09-phase-1-5-test` → false (project relocated ✓).
- `test -d projects/archive/2026-05-09-phase-1-5-test` → true (archive present ✓).
- `grep "^\*\*Status\*\*: archived" projects/archive/2026-05-09-phase-1-5-test/MANIFEST.md` → matches ✓.
- `grep -n "runInit\|resolveInitTarget\|InitDetail" .claude/scripts/trout/autosave.ts` → no matches ✓.
- `grep -n "init\|InitDetail\|--init" .claude/scripts/trout/autosave.test.ts` → only matches in `project-initialized` event vocabulary references (lines 52, 93), preserved as required ✓.
- Phase 1.5 row in `agent-guilds/MANIFEST.md` reads `| 1.5 | Substrate primitive cleanup | completed | ev.agent-guilds.phase-1-5-substrate-cleanup-9 | — | — |` ✓.
- Manifest events table includes a `| ... | phase-completed | 1.5 |` row for D12.

**Direct mappings to acceptance criteria**:
- AC #1-#6 (e2e exercise of migrated scripts) → execution log in checkin 14.md, plus the artifact at `projects/archive/2026-05-09-phase-1-5-test/`.
- AC #7 (autosave --init removal) → `autosave.ts` (the entire file is now smaller and cleaner; specific deletions documented in checkin Execution step 7).
- AC #8 (autosave test cleanup) → `autosave.test.ts:281-336` are gone; remaining `project-initialized` references at lines 52 and 93 are vocabulary refs, preserved.
- AC #9 (phase-completed) → MANIFEST events table + phase row both updated.
- AC #10-#11 (verification + no refinements) → see Pre-computed verification.

**Iteration story**:
- Panel run 1, no prior runs.
- Two in-execution substrate findings recorded in Notes for the PR
  (NOT corrections to the contract — these are findings about the
  substrate's existing behavior that emerged during exercise):
  - `archive-relocate.ts` requires git-tracked source (uses `git mv`).
    First archive attempt failed; fix was to commit the test project
    first. Documented as a substrate finding for follow-up doc-sweep.
  - `archive-relocate.ts` leaves the Status flip unstaged
    (modify-after-mv pattern). Required a separate commit. Documented
    as a substrate-refinement candidate.
- No contract-cap renegotiations needed.
- One scope choice worth flagging: this checkin bundles two work
  products (e2e verification + `--init` cleanup). They're conceptually
  one closing unit per AC #11's framing ("the new path works AND the
  old path is gone"), and the contract explicitly authorizes both
  (AC #7 references "deferred from D10's AC #3"). Reading AC #11 ("no
  co-located refinements") strictly might call this out, but the
  refinement-vs-deliverable distinction is: the `--init` cleanup is a
  scoped deliverable explicitly named in the contract, not a
  refinement bundled mid-stream.

## Original ask

Verbatim from `projects/2026-05-02-agent-guilds/PLAN.md` § Phase 1.5 deliverable 12:

> 12. **End-to-end verification.** Scaffold a throwaway
> `phase-1-5-test` project via the migrated `/trout-plan`. Take it
> through one unit of work via `/ev-run` → `/ev-loop-interactive`.
> Save session via the migrated `/trout-save-session`. Confirm
> everything works through the migrated path. Archive the test
> project via the migrated `/trout-archive`.

Plus the deferred-from-D10 cleanup explicitly authorized by D10's
AC #3 ("Cleanup of the now-unused `--init` is out of scope for D10
— flag for follow-up maintenance once the `/trout-plan` rewrite is
verified working end-to-end").

## Suggested spot-check (one tool use)

The single most efficient spot-check is reading the file listing
under `projects/archive/2026-05-09-phase-1-5-test/` (one `ls` or one
read of the MANIFEST.md) to confirm the e2e verification artifact
exists with `Status: archived`. That single observation collapses
ACs #1-#6 (every script exercise produces an artifact in the test
project; if the archive exists with the expected files, all four
script exercises succeeded). A secondary spot-check would be a
`grep` on `autosave.ts` for `runInit\|InitDetail` to confirm the
`--init` cleanup landed.
