# Checkin 01 — ev.agent-guilds.replan-phase-1-5

**Created**: 2026-05-05 11:30
**Phase**: 1.5 — Substrate primitive cleanup
**Unit**: 1 — Convention doc: skills-as-interfaces-vs-workers

## Contract

- **Goal**: Document the "scripts for CRUD, skills for LLM-shaped work, orchestration stays skill" convention in `projects/CONVENTIONS.md` so the migrations that follow have a why-anchor a future reader (or future agent) can cite. The doc names the four substrate primitive shapes (CRUD / LLM / interactive / orchestration), gives the rule for each, and grounds the rule in the empirically-verified `disable-model-invocation` finding (a skill cannot be both composable-from-another-skill and blocked-from-ambient-discovery — the only path to composition-only behavior is a different primitive). Also adds a brief `.claude/scripts/` directory layout subsection so callers know where migrated CRUD lands.

- **Acceptance criteria**:
  - `projects/CONVENTIONS.md` gains a new section titled "Substrate primitive shapes" (or similar — placement near the top, before the per-format specs, since this is the cross-cutting principle behind the formats).
  - The section documents the four shapes:
    - **CRUD-shaped** (read/edit/write files; deterministic; no LLM judgment) → Node script under `.claude/scripts/<family>/<verb>.js`. No skill ambient surface. Callers shell out via `Bash`.
    - **LLM-shaped** (judgment, taste, narrative, classification) → stays as a skill. May have a CRUD epilogue extracted to a script (the "shell extraction" pattern).
    - **Interactive** (multi-turn user conversation) → stays as a skill in the main thread.
    - **Orchestration** (composes Skill + Agent in the same context) → stays as a skill. Guild substrate is the canonical example.
  - The section explains the empirical finding: `disable-model-invocation: true` blocks ALL model-initiated invocations, including transitive `Skill` tool calls from another skill. So a skill cannot be simultaneously "composable from another skill" AND "blocked from ambient auto-discovery." Composition-only behavior requires a different primitive (script or subagent).
  - The section adds a short `.claude/scripts/` directory-layout block (mirroring the existing `./projects/` layout block) showing `.claude/scripts/<family>/<verb>.js` with `trout`, `griot`, `guild` as the three families.
  - The section names the per-family wildcard permission convention: `Bash(node .claude/scripts/<family>/*)` in project-wide `.claude/settings.json`, added as each family's first script lands.
  - No emojis. Terse, spec-flavored prose consistent with the rest of CONVENTIONS.md. Existing sections of CONVENTIONS.md are not modified.
  - `npm run lint` clean.
  - `git status` after the unit shows only `M projects/CONVENTIONS.md` and `A projects/2026-05-02-agent-guilds/checkins/ev.agent-guilds.replan-phase-1-5/01.md`.

- **Rules applied**:
  - `~/.claude/CLAUDE.md` and `aart.camp/.claude/CLAUDE.md` conventions: no emojis, no speculative abstractions, terse prose, document the *why* not the *what*.
  - Existing CONVENTIONS.md tone: format-spec-flavored, leans on tables and code blocks over prose, terse.
  - `npm run lint` (Biome) clean as a baseline check (this is a markdown-only edit; no JS / TS touched, but lint must remain green).

- **Disqualifiers**:
  - The new section duplicates content that already lives in another canonical location (e.g. re-stating MANIFEST format) instead of cross-referencing.
  - Speculative content: documenting "future" primitives that don't yet exist or that we haven't committed to.
  - Implementation drift: the section claims a layout or convention (e.g. permission shape, family list) that contradicts what the manifest commit and PLAN.md Phase 1.5 entry already established. Anything authoritative about Phase 1.5 must agree across the three places (CONVENTIONS.md, PLAN.md Phase 1.5 section, manifest Current state).
  - Bloating CONVENTIONS.md with prose where a code block / table would do.
  - Editing existing sections of CONVENTIONS.md (out of scope — this is purely an additive change).
  - `disable-model-invocation` is mis-stated. The finding is: it blocks model-initiated invocations including from other skills via the `Skill` tool. Do not over-claim (e.g. "blocks all invocations" — bash invocations of skills via slash commands in user input are not model-initiated).

- **Inputs**:
  - `projects/CONVENTIONS.md` (target of edit; existing structure to fit alongside)
  - `projects/2026-05-02-agent-guilds/sessions/2026-05-05-a.md` (the audit + planning material that defines the convention)
  - `projects/2026-05-02-agent-guilds/PLAN.md` (Phase 1.5 entry — must agree on family list and permission shape)
  - `projects/2026-05-02-agent-guilds/MANIFEST.md` (Current state — must agree on the convention summary)
  - `~/.claude/projects/-home-krambuhl-work-aart-camp/memory/project_disable_model_invocation_blocks_composition.md` (the memory note recording the empirical finding)

## Scope

Files modified:
- `projects/CONVENTIONS.md` (additive — new section)

Files created:
- `projects/2026-05-02-agent-guilds/checkins/ev.agent-guilds.replan-phase-1-5/01.md` (this checkin)

No source code touched. No build-affecting changes.

## Execution

**Step 1 — Insertion point.** Placed the new "Substrate primitive shapes" section directly after the file's intro paragraph and before "## Directory layout." Rationale: the section is the cross-cutting principle behind every format spec below it. A future reader encounters "what shape is this?" before "what's the format of MANIFEST.md?".

**Step 2 — Section structure.** Top-level table names the four shapes (CRUD / LLM / Interactive / Orchestration), what each is, the primitive, and where it lives. One short paragraph after the table introduces the shell-extraction pattern so LLM-with-CRUD-epilogue skills (most of the `/trout-*` family) have a documented option without forcing it. Three subsections follow: "Why orchestration stays a skill" (the empirical disable-model-invocation finding), "`.claude/scripts/` directory layout" (mirrors the existing `./projects/` block), "Permissions" (per-family wildcard convention).

**Step 3 — Empirical finding phrasing.** The "Why orchestration stays a skill" subsection states the finding without overclaiming. Specifically:
- "blocks all model-initiated invocations of it, including transitive `Skill` tool calls from other skills" — accurate per the test fixture run in the prior session (parent skill's `Skill` tool call against the disabled child failed with "cannot be used with Skill tool due to disable-model-invocation").
- Does NOT claim the flag blocks user-typed slash commands or other non-model invocation paths. The convention only needs to establish that orchestration substrate must stay discoverable; it doesn't need to fully document the flag's positive case.

**Step 4 — Verification.**
- `npm run lint` passes with the same 2 baseline broken-symlink warnings on unrelated skills (no regressions from this unit).
- `git status` shows: `M projects/CONVENTIONS.md`, `A projects/2026-05-02-agent-guilds/checkins/ev.agent-guilds.replan-phase-1-5/01.md`. (Plus the unstaged `.claude/settings.local.json` drift carried from before — harness-managed local config, not part of this unit.)

**Step 5 — Evaluator correction.** First panel run flagged a `criterion-unmet`: working tree had a stray `M next-env.d.ts` (auto-generated Next.js file; an `import` path moved from `./.next/dev/types/routes.d.ts` → `./.next/types/routes.d.ts`, evidently from a prior dev/build run on a sibling branch). The file has an in-file warning ("This file should not be edited") and Next.js regenerates it on demand. Reverted via `git checkout -- next-env.d.ts`. Re-ran git status; only this unit's intentional changes remain (plus the already-noted local-settings drift). Re-invoked the panel.
- Three-way agreement check: PLAN.md Phase 1.5 entry, MANIFEST Current state, and CONVENTIONS.md new section all reference the same family list (`trout`, `griot`, `guild`) and the same per-family wildcard permission shape. No drift.

## Notes for PR

- correction: Evaluator flagged unaccounted-for `next-env.d.ts` working-tree change on first panel run; reverted (auto-generated Next.js build-output reference, marked "should not be edited" in-file). Lesson: when authoring a "git status shows only X and Y" criterion, the pre-evaluation step must include a fresh `git status` read against that exact criterion, not a recalled summary from earlier in the session.
- This unit ships in the **replan PR** (branch `ev.agent-guilds.replan-phase-1-5`), not the main Phase 1.5 cleanup PR. Rationale: the post-merge audit produced both a rewritten plan (4× the original Phase 1.5 scope) and a load-bearing convention (this section). Shipping them together as a planning PR before any migration code lands gives the cleanup PR a stable convention + plan to reference, and lets a reviewer evaluate the scope expansion separately from the mechanical work.
- Reviewers should focus on: (1) whether the four-shape framing is correct and complete (any shape we're missing? any forced into the wrong bucket?); (2) whether the empirical finding phrasing is precise without overclaiming (the flag's positive case is deliberately not documented here); (3) whether the directory-layout block matches what we'll actually author in the follow-up cleanup PR.
- The cleanup PR (next) will execute the remaining 11 deliverables against this merged convention. The convention IS the why for that PR's mechanical changes.
- After this PR merges: the `replan-phase-1-5` branch dies; a fresh `ev.agent-guilds.phase-1-5-substrate-cleanup` branch cuts from main; the loop resumes on deliverable 2 (`trout-autosave` → script).
