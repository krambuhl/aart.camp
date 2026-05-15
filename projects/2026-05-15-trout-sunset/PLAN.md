# Trout Sunset

## Context

The aart.camp repo currently maintains three parallel project substrates:
- **Trout** (existing default): prose-flavored PLAN.md, event-log MANIFEST.md,
  sessions/, checkins/, script-backed (`.claude/scripts/trout/`)
- **Loom** (shipped May 2026): JSON-first storage, CLI-backed (`bin/loom`),
  structured manifests/sessions/retros/checkins/PRs
- **Draft** (shipped May 2026): planning-only, CLI-backed (`bin/draft`),
  grill-me interview producing PLAN.md + INTERVIEW.md; sibling consumer of
  loom's `lib/` substrate

Loom + draft together cover everything trout does today. The forward-creation
surface is mirrored: trout-pull-request → loom-pr; trout-pr-respond →
loom-pr-respond; trout-archive → loom-archive; trout-save-session →
loom-session; trout-plan → `/draft-plan` (heavyweight only). The result is a
three-substrate maintenance tax on a repo that doesn't need it.

This project closes that out. Trout becomes legacy and disappears once
nothing live runs on it.

## Scope

**In:**
- Delete `.claude/skills/trout-*/` (5 skills: trout-plan, trout-pull-request,
  trout-pr-respond, trout-archive, trout-save-session)
- Delete `.claude/scripts/trout/` (script substrate)
- Remove trout references from `CLAUDE.md`, `.claude/CLAUDE.md`, and any
  in-repo docs/skills that still mention trout
- Fold `projects/CONVENTIONS.md` (trout format) into
  `projects/LOOM-CONVENTIONS.md` (loom format) — single conventions file
  going forward
- Verify no live trout-managed project remains before executing

**Out:**
- Building a `loom-plan` lightweight skill — collapsed onto `/draft-plan`
  (terse answers replace the lightweight path)
- Writing a trout→loom converter for existing or archived trout projects
- Rewriting archived trout projects into loom format — they stay frozen
  as-is in `projects/archive/`
- Code-level freeze signals (frontmatter "DEPRECATED" notes, chooser
  de-emphasis) during the wait — this PLAN.md serves as the freeze record
- Parity audit of loom vs trout — accepted as "trust loom + fix on demand"

**Deferred:**
- Real gaps that surface during the drain. If a mid-task user hits something
  trout had that loom doesn't, port it then.

## Phases

### Phase 1: Sunset

A single PR that retires the trout substrate.

**Trigger condition (gates this phase):** Every live trout-managed project
under `projects/` (not `projects/archive/`) has been archived. As of plan
write (2026-05-15), this is gated on `adopt-biome`. Any new trout project
started between plan write and trigger fire blocks similarly.

**Deliverables (single PR):**
- Delete the five trout skill directories under `.claude/skills/`
- Delete `.claude/scripts/trout/`
- Delete `bin/trout` if present (none today per survey; verify)
- Update `CLAUDE.md` and `.claude/CLAUDE.md` — remove trout references,
  direct project birth at `/draft-plan` and lifecycle at the loom skills
- Fold `projects/CONVENTIONS.md` into `projects/LOOM-CONVENTIONS.md` and
  delete the trout-format file. Folded doc covers loom format and points to
  draft for planning.
- Grep audit: `rg -i "trout"` returns only references in archived project
  session notes (acceptable read-only artifacts); anything else gets
  resolved
- Final smoke: `/draft-plan`, `/loom-pr`, `/loom-session`, `/loom-archive`
  end-to-end on a throwaway sandbox project

PR shape: one conceptual change (substrate retirement). Many files but
mechanical change-per-file (delete or remove-references), reviewable in one
sitting.

## Dependencies

- Phase 1 cannot start until every live trout project has archived. Known
  blocker today: `adopt-biome`. Verify the full set at trigger time.
- No dependency on the agent-guilds project (loom-managed).
- No dependency on a parity audit (skipped by decision).

## Verification

- `rg -l "trout" projects/` returns only paths under `projects/archive/`
- `rg -l "trout" .claude/` returns nothing
- `rg -l "trout" bin/ CLAUDE.md .claude/CLAUDE.md` returns nothing
- `ls .claude/skills/ | grep trout` returns nothing
- `ls .claude/scripts/ | grep trout` returns nothing
- Sandbox smoke: `/draft-plan` scaffolds a fresh project, `/loom-archive`
  retires it; both succeed with no trout in the loop
- `npm run lint` passes

## Risks

- **Trigger condition never fires** — `adopt-biome` drags on; plan rots.
  *Mitigation:* timebox to 90 days from plan write (2026-08-13). If trigger
  hasn't fired by then, revisit — either accelerate the lingering project
  via `/loom-archive`, or formally re-scope.
- **No code-level freeze signal during the wait** — a new trout project
  could be started inadvertently. *Mitigation:* update `.claude/CLAUDE.md`
  *immediately* (not at delete time) to point project birth at `/draft-plan`,
  so any agent reading project context sees the new default. PLAN.md itself
  also lives in `projects/` and is visible to substrate-aware tooling.
- **Hidden trout reference surfaces post-delete** — some doc, README, or
  non-skill file mentions trout in a way the grep misses (paraphrased
  reference, comment, sketch metadata). *Mitigation:* case-insensitive
  sweep before merge; manual review of any match outside
  `projects/archive/`.
- **Loom parity gap mid-drain** — someone hits a thing trout did that loom
  doesn't, while trout still exists. *Mitigation:* port on demand (accepted
  policy). Trout still works during drain.
- **Archived trout projects reference deleted skills** — old session notes
  link `/trout-pull-request` etc. *Mitigation:* accept. Archived projects
  are read-only artifacts; stale intra-doc references are not load-bearing.

## Open questions

- Is `adopt-biome` the only live trout project, or are there others not
  surfaced by the pre-plan survey? Verify at trigger-time.
- Does anything outside this repo reference trout skill names (cron jobs,
  external tooling)? Likely none, but worth a final check before delete.

## Decisions

- **Deprecate fully, not freeze.** End-state is removal. Stops the
  three-place-decision tax.
- **Drain, don't convert.** Existing trout projects finish on trout. No
  converter built.
- **Single PR, no freeze phase.** Deprecate-and-delete happens in one shot
  at trigger time. PLAN.md substitutes for code-level freeze signals.
- **Collapse onto /draft-plan, no loom-plan.** One planning surface in the
  repo, not two.
- **Trust loom + fix on demand.** No formal parity audit.
- **Archived trout projects stay trout-format.** No historical rewrite.
  Mixed formats in `projects/archive/` are accepted.
