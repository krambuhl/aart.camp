# Trout Sunset

## Context

The aart.camp repo's substrate model splits the work that **trout** (legacy)
used to do into two paired substrates:

- **Loom** (execution): `manifest.json`, `events.jsonl`, `checkins/`,
  `sessions/`, retros, PRs. CLI-backed (`bin/loom`).
- **Draft** (planning): `PLAN.md`, `INTERVIEW.md`, plan revisions.
  CLI-backed (`bin/draft`).

The intent is that **loom + draft are used together**, on every project.
They're complementary halves of one substrate, not alternatives. Trout was
the monolith that did both jobs; replacing it means projects always have
both loom files and draft files in the same dir, with each CLI owning its
own files and ignoring the other's.

In practice today, loom + draft do not yet coexist cleanly:

- `bin/loom project scaffold` refuses on existing dirs, so a project born
  from `bin/draft plan` (which creates `PLAN.md` + `INTERVIEW.md`) has no
  CLI path to adopt the loom substrate. Loom files have to be written
  manually.
- `bin/draft revise`'s resolver (`resolveTroutProject`) excludes anything
  with a `manifest.json` marker, so once loom adopts a project, draft can
  no longer revise its `PLAN.md` via the CLI.

These are bugs in the coexistence story, not future design questions —
they're blocking the substrate model the user designed for.

The ev-loops (`ev-loop-confidence`, `ev-loop-interactive`) currently
compose `/trout-pull-request`, `/trout-pr-respond`, `/trout-save-session`
skills. Migrating them is a precondition for deleting trout — and the
migration target is **direct CLI invocation** of `bin/loom` / `bin/draft
revise`, not new ambient `/loom-*` skills. Substrate plumbing doesn't
earn a slot in the user-visible skill chooser.

This project closes all of that out:
1. Fix the loom + draft coexistence so they actually work together.
2. Migrate ev-loops to invoke the CLIs directly.
3. Delete trout.

## Scope

**In:**
- Fix `bin/loom project scaffold` (or add a sibling verb like `bin/loom
  project adopt`) so loom files can be written into a directory that
  already has `PLAN.md` from `bin/draft plan`. The "draft created the
  dir, loom adopts it" path becomes a real CLI seam.
- Relax draft's resolver (`resolveTroutProject` in
  `.claude/cli/lib/draft-project.ts`) so it includes loom-managed
  projects. PLAN.md is plain markdown — draft owns it regardless of
  whether loom owns the rest.
- Decide on `/draft-plan` behaviour: does it auto-adopt loom (one entry
  point produces both substrates), or is loom adoption a separate
  subsequent step the user invokes? Recommended: auto-adopt, with a
  `--no-loom` escape hatch for the rare draft-only case.
- Migrate `ev-loop-confidence` and `ev-loop-interactive` to invoke
  `bin/loom` and `bin/draft revise` directly, replacing all `/trout-*`
  primitive composition.
- Audit user-facing `/loom-pr`, `/loom-pr-respond`, `/loom-session`, and
  `/draft-revise` skills: remove those that exist only to wrap a CLI
  call.
- Delete `.claude/skills/trout-*/` (5 skills).
- Delete `.claude/scripts/trout/` (script substrate).
- Remove trout references from `CLAUDE.md`, `.claude/CLAUDE.md`, and any
  in-repo docs/skills that still mention trout.
- Fold `projects/CONVENTIONS.md` (trout format) into
  `projects/LOOM-CONVENTIONS.md` — single conventions file going forward.
- Verify no live trout-managed project remains before executing the
  deletion.

**Out:**
- Building a `loom-plan` lightweight skill — `/draft-plan` is the
  planning surface; if it auto-adopts loom, that *is* the lightweight
  loom-plan path.
- Building `/loom-pr`-style ambient wrappers around CLI verbs — direct
  `bin/loom` calls are the contract.
- Writing a trout→loom converter for existing or archived trout projects.
- Rewriting archived trout projects into loom format — they stay frozen
  as-is in `projects/archive/`.
- Code-level freeze signals (frontmatter "DEPRECATED" notes, chooser
  de-emphasis) during the wait — this PLAN.md serves as the freeze
  record.
- Parity audit of loom vs trout — accepted as "trust loom + fix on
  demand".

**Deferred:**
- Real gaps that surface during the drain. If a mid-task user hits
  something trout had that loom doesn't, port it then.

## Phases

### Phase 1: Fix loom + draft coexistence

Make the substrate match the design intent: loom and draft coexist on
every project, each CLI owns its own files, neither one excludes the
other.

**Deliverables (single PR):**
- Add a `bin/loom project adopt <slug>` verb (or `--adopt-existing` flag
  on `scaffold`) that writes `manifest.json`, `config.json`,
  `events.jsonl`, `checkins/`, `sessions/` into an existing project dir
  without touching `PLAN.md` or `INTERVIEW.md`. Refuses if loom files
  already exist.
- Drop the `LOOM_MARKER` exclusion from `listTroutProjects` in
  `.claude/cli/lib/draft-project.ts`. PLAN.md is the only marker draft
  cares about; loom-managed projects with `PLAN.md` qualify.
- Update `bin/draft plan` to auto-adopt loom by default (calls into the
  same path as `bin/loom project adopt` once `PLAN.md` is in place).
  Add `--no-loom` escape hatch for the unusual case where someone wants
  draft-only.
- Backfill loom for the existing draft-cli project (this trout-sunset
  project itself is already manually adopted, but it should be
  re-doable cleanly via the new verb so we trust the seam).
- Update `projects/LOOM-CONVENTIONS.md` to document the
  loom-adopts-draft sequence and the auto-adopt default.
- Tests: `draft-project.test.ts` updated to expect loom-managed
  projects to resolve via `resolveTroutProject`; new tests for `loom
  project adopt` covering the happy path, refusal on already-adopted,
  refusal on missing PLAN.md.

**PR shape:** one substrate-fix PR. Reviewable as a small unit because
the changes are mechanical (one resolver line dropped, one verb added,
draft plan grows an internal call).

### Phase 2: Migrate ev-loops to direct CLI invocation

Replace `/trout-pull-request`, `/trout-pr-respond`, `/trout-save-session`
composition in the ev-loop skills with direct `bin/loom ...` and
`bin/draft revise` invocations. Audit existing `/loom-*` and
`/draft-revise` ambient skills against the "loops use CLI directly" rule
and prune those that exist only as CLI wrappers.

**Deliverables (single PR):**
- Update `.claude/skills/ev-loop-confidence/SKILL.md`: replace each
  `/trout-pull-request <slug> <branch>` with the equivalent `bin/loom
  pr open|update <slug> --branch=<branch> ...` invocation; replace
  `/trout-pr-respond <slug> <pr>` with `bin/loom pr comments` +
  `bin/loom pr respond`; replace `/trout-save-session` with `bin/loom
  session write`. Update prose accordingly.
- Update `.claude/skills/ev-loop-interactive/SKILL.md` likewise.
- Audit `/loom-pr`, `/loom-pr-respond`, `/loom-session`, `/draft-revise`:
  decide per-skill whether each earns its keep as a user-facing ambient
  surface. Default bias: remove if it's a thin CLI wrapper; keep if it
  does meaningful prose synthesis (e.g. drafting a PR body) the user
  genuinely benefits from invoking by name.
- Smoke: invoke `ev-loop-interactive` on this trout-sunset project
  (loom-adopted, so a working sandbox once Phase 1 has shipped).
  Verify a checkpoint PR opens, a session saves, PR feedback responds,
  and a plan revision flows — all via direct CLI calls, no `/trout-*`
  and no `/loom-*` in the loop.

**Dependencies:** Phase 1 must be merged first. The smoke test depends
on `bin/loom project adopt` working cleanly so the loop can drive a
properly-adopted project end-to-end.

**PR shape:** one PR covering both ev-loop migrations + the skill audit
results.

### Phase 3: Sunset trout

A single PR that retires the trout substrate.

**Trigger condition (gates this phase):** Phase 1 + Phase 2 merged AND
every live trout-managed project under `projects/` (not
`projects/archive/`) has been archived. As of plan write (2026-05-15),
known trout-managed live projects are: `agent-guilds`, `draft-cli`,
`adopt-biome`. Verify the full set at trigger time.

**Deliverables (single PR):**
- Delete the five trout skill directories under `.claude/skills/`.
- Delete `.claude/scripts/trout/`.
- Delete `bin/trout` if present (none today per survey; verify).
- Update `CLAUDE.md` and `.claude/CLAUDE.md` — remove trout references,
  direct project birth at `/draft-plan` (which auto-adopts loom).
- Fold `projects/CONVENTIONS.md` into `projects/LOOM-CONVENTIONS.md`
  and delete the trout-format file. Folded doc covers the unified
  loom+draft substrate.
- Rename `resolveTroutProject` → `resolveProject` (or similar) in
  `.claude/cli/lib/draft-project.ts`. The "trout" prefix is a vestigial
  artifact of the resolver's history; once trout is gone, the name
  should reflect what the function actually does.
- Grep audit: `rg -i "trout"` returns only references in archived
  project session notes (acceptable read-only artifacts); anything else
  gets resolved.
- Final smoke: `/draft-plan` end-to-end on a fresh sandbox project (now
  with auto-loom-adoption); drive a sandbox loop end-to-end on it;
  archive via `bin/loom project archive`. All succeed with no trout in
  the loop.

**PR shape:** one conceptual change (substrate retirement). Many files
but mechanical change-per-file (delete or remove-references), reviewable
in one sitting.

## Dependencies

- Phase 1 has no project-substrate dependencies — purely a CLI/lib edit.
- Phase 2 depends on Phase 1 (the smoke test exercises the new adopt
  verb and relaxed resolver).
- Phase 3 cannot start until Phase 1 + Phase 2 are merged AND every
  live trout project has archived. Today's known blockers:
  `agent-guilds`, `draft-cli`, `adopt-biome`.
- No dependency on a parity audit (skipped by decision).

## Verification

**Phase 1:**
- `bin/loom project adopt <slug>` succeeds on a draft-only dir; refuses
  on an already-adopted dir
- `bin/draft revise` succeeds on a loom-managed project
- `bin/draft plan` end-to-end produces a project with both PLAN.md +
  INTERVIEW.md AND manifest.json + config.json + events.jsonl by
  default
- All updated tests pass

**Phase 2:**
- `grep -rE "/trout-(pull-request|pr-respond|save-session)" .claude/skills/ev-loop-*` returns nothing
- Loop ran end-to-end on this project's loom substrate; PR opened,
  session saved, feedback responded — confirmed in `events.jsonl`

**Phase 3:**
- `rg -l "trout" projects/` returns only paths under `projects/archive/`
- `rg -l "trout" .claude/` returns nothing (modulo the renamed
  resolver if any aliases linger; verify)
- `rg -l "trout" bin/ CLAUDE.md .claude/CLAUDE.md` returns nothing
- `ls .claude/skills/ | grep trout` returns nothing
- `ls .claude/scripts/ | grep trout` returns nothing
- Sandbox smoke: a fresh `/draft-plan` invocation drives end-to-end with
  no trout in the loop
- `npm run lint` passes

## Risks

- **Phase 1 substrate change breaks an existing project's reads** —
  relaxing the draft resolver means loom-managed projects start
  appearing in `bin/draft revise`'s candidate list. If a loom project
  has a malformed PLAN.md (or none), draft might error confusingly.
  *Mitigation:* the resolver already requires `PLAN.md` to be present;
  loom projects without PLAN.md continue to be invisible. Tests cover
  the new inclusion path.
- **Auto-loom-adopt in `bin/draft plan` surprises someone** — a user
  invoking `/draft-plan` for a one-off planning sketch (no execution
  intended) gets loom files they didn't want. *Mitigation:* `--no-loom`
  flag on `bin/draft plan` for the escape hatch. Document the default
  in the skill prompt.
- **Phase 2 strands live trout projects' loop support** — ev-loops
  post-Phase-2 know only loom verbs; running them on a trout-only
  project (manifest is `MANIFEST.md`, not `manifest.json`) fails. Live
  trout projects (`agent-guilds`, `draft-cli`, `adopt-biome`) lose
  ev-loop assistance for their remaining life. *Mitigation:* before
  merging Phase 2, audit each live trout project's loop usage. Either
  accept manual drive for the remainder, or accelerate archival.
- **Phase 3 trigger never fires** — live trout projects drag on; PLAN.md
  rots in `projects/`. *Mitigation:* timebox to 90 days from plan write
  (2026-08-13). If trigger hasn't fired, revisit — accelerate via
  `bin/loom project archive` (after manual conversion) or formally
  re-scope.
- **No code-level freeze signal during the wait** — a new trout project
  could be started inadvertently. *Mitigation:* update `.claude/CLAUDE.md`
  *immediately* (as part of merging Phase 1) to point project birth at
  `/draft-plan` (which by then auto-adopts loom). Substrate-aware
  tooling sees PLAN.md in `projects/` regardless.
- **Hidden trout reference surfaces post-delete** — some doc, README,
  or non-skill file mentions trout in a way the grep misses.
  *Mitigation:* case-insensitive sweep before merge; manual review of
  any match outside `projects/archive/`.
- **Skill audit removes a skill someone actually wanted** — removing
  `/loom-pr` because it's a thin wrapper, then a human misses it.
  *Mitigation:* per-skill judgment in the audit; if in doubt, keep.
  Threshold is "does this do prose synthesis worth wrapping?" not "is
  it conceptually a CLI call?"
- **Archived trout projects reference deleted skills** — old session
  notes link `/trout-pull-request` etc. *Mitigation:* accept. Archived
  projects are read-only artifacts.

## Open questions

- Are `agent-guilds`, `draft-cli`, `adopt-biome` the only live trout
  projects, or are there others not surfaced by the pre-plan survey?
  Verify at Phase-3 trigger-time.
- Does anything outside this repo reference trout skill names (cron
  jobs, external tooling)? Likely none, but worth a final check before
  delete.
- Phase 1 design call: `--adopt-existing` flag on `scaffold` vs a
  separate `adopt` verb. Recommendation: separate verb, since "scaffold
  fresh" and "adopt existing" have meaningfully different invariants
  (scaffold writes PLAN; adopt requires PLAN).

## Decisions

- **Loom + draft are paired, not alternatives.** Every project gets both.
  Substrate gaps preventing coexistence are bugs to fix, not deferred
  design questions. This drives Phase 1's existence.
- **Loops invoke CLI directly, no ambient `/loom-*` skills.** Substrate
  plumbing doesn't earn a skill slot.
- **Deprecate trout fully.** End-state is removal.
- **Drain, don't convert.** Existing trout projects finish on trout. No
  converter built.
- **Three phases: substrate fix, loop migration, sunset.** Each is one
  PR. Phase 2 depends on Phase 1; Phase 3 depends on Phase 1 + Phase 2 +
  drain.
- **Collapse onto `/draft-plan`, no loom-plan skill.** With auto-loom-
  adoption (Phase 1), `/draft-plan` *is* the loom-plan equivalent.
- **Trust loom + fix on demand.** No formal parity audit.
- **Archived trout projects stay trout-format.** No historical rewrite.

## Revision log

### 2026-05-15 (v3) — Add Phase 1 substrate fix; reframe loom+draft as paired

User clarified: "loom and draft are used together exclusively against
trout who used to do too much." The two were designed as paired halves
of one substrate (replacing trout's monolithic role), not as alternatives.

Surfaced two coexistence bugs while writing v2:
- `bin/loom project scaffold` refuses on existing draft-created dirs
- `bin/draft revise`'s resolver excludes loom-managed projects

v2 had recorded these as future "open questions." v3 reclassifies them
as in-scope blockers and lifts them into a new **Phase 1: Fix loom +
draft coexistence**. Existing Phase 1 (loop migration) becomes Phase 2;
Phase 2 (sunset) becomes Phase 3. Phase 2 now depends on Phase 1 (the
loop smoke test exercises the new adopt verb).

Added auto-loom-adopt to `bin/draft plan` as a Phase 1 deliverable,
since the substrate-pair model implies one entry point should produce
both substrates by default. `--no-loom` escape hatch for the unusual
draft-only case.

Reframed Context to lead with "loom + draft are paired" rather than
treating them as parallel-but-separate. Updated Decisions accordingly.

Phase 3 now also includes renaming `resolveTroutProject` →
`resolveProject` once trout is gone; the "trout" name is vestigial.

### 2026-05-15 (v2) — Add loop-migration phase; switch loop migration target to direct CLI

Original plan had a single phase (Phase 1: Sunset) gated only on the
drain of live trout projects. It missed that ev-loops are upstream
consumers of the trout substrate (composing `/trout-pull-request`,
`/trout-pr-respond`, `/trout-save-session`) — deleting trout while
loops depend on it would break the execution surface.

Revised to two phases:
- **Phase 1: Migrate ev-loops** to invoke `bin/loom` and `bin/draft
  revise` directly. Critically, the migration target is *direct CLI
  invocation*, not new ambient `/loom-*` skills — substrate plumbing
  doesn't earn a skill slot in the user-visible chooser. This was
  user-directed mid-revision.
- **Phase 2: Sunset trout** (the original Phase 1, now gated on Phase 1
  merged + drain).

Also added an in-scope audit of existing `/loom-pr`, `/loom-pr-respond`,
`/loom-session`, `/draft-revise` ambient skills — same rule applied
retroactively: if it's just a CLI wrapper, prune it.

Live-trout-project list updated from "adopt-biome" to "agent-guilds,
draft-cli, adopt-biome" after surveying `projects/` for `MANIFEST.md`
files outside `archive/`.

Project itself adopted loom (manifest.json, config.json, events.jsonl,
checkins/, sessions/) by manual file writes — `bin/loom project
scaffold` refuses on existing dirs and `bin/draft revise` excludes
loom-managed projects. Both gaps recorded under Open questions for
follow-up. (Subsequently lifted into Phase 1 in v3.)
