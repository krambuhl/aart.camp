---
name: trout-archive
description: >-
  Close out a completed project. Synthesize a retrospective from the full
  corpus, interview the user for color, classify findings, dispatch them
  (inline / follow-up / new project / defer), relocate the project
  directory under ./projects/archive/, and author the archive PR via
  /trout-pull-request. Use when all phases are complete and the user is
  ready to put the project to bed.
argument-hint: "<project-slug-or-path>"
allowed-tools: Read, Write, Edit, Bash(git status:*), Bash(git log:*), Bash(git branch:*), Bash(ls:*), Skill
---

# /trout-archive

Death ritual for a project. Retrospective + dispositions + relocation.

**Format reference**: `projects/CONVENTIONS.md` (repo-relative).

Skill invocations like `/trout-pull-request` below mean
`Skill(skill: <name>, args: "…")` — the Skill tool is how substrate
skills compose. Script invocations like
`.claude/scripts/trout/autosave.ts` mean
`Bash("node .claude/scripts/trout/autosave.ts <args>")`.

## Resolve the target

`$ARGUMENTS` is a project slug (e.g. `adopt-biome`) or a full path
(e.g. `projects/2026-04-23-adopt-biome/`). Resolve it to the project
directory before step 1. If `$ARGUMENTS` is empty, ask the user which
project to archive and list candidates under `projects/` excluding
`archive/`.

## Preconditions

- All phases in the manifest are `completed` (or explicitly deferred and
  the user confirms they won't resume).
- There are no unresolved PR blockers on any phase's PR (merged or
  closed).

If either fails, stop and report what's open.

## Process

### 1. Read the full corpus

- `PLAN.md`
- `MANIFEST.md`
- `config.md`
- Every file under `sessions/`
- Every file under `checkins/<branch>/`
- Every file under `<scope-dir>/retros/` if any exist (confidence-loop
  tactical retros)

Skim, don't memorize. You are looking for: what the plan said, what
actually happened, where it diverged, what surprised us, what would you
do differently, what's worth preserving as a reusable insight.

### 2. Interview the user for color

Before drafting, ask 2–4 targeted questions. Examples:
- "Anything the record doesn't capture — tension, dead ends, off-ramps?"
- "Is there a lesson here that belongs in CLAUDE.md or a learnings file?"
- "Any findings you want absorbed back into the codebase separately?"

Keep it short. One round of questions, one round of answers.

### 3. Draft RETROSPECTIVE.md

Structure:

```markdown
# Retrospective — <project title>

**Archived**: YYYY-MM-DD
**Duration**: <started → archived>
**PRs**: #12, #14, #17

## What we set out to do
<distilled from PLAN.md — 2–4 sentences>

## What actually happened
<2–5 paragraphs — the honest story, not a log dump>

## What went well
- <bullet>

## What didn't
- <bullet — this section is where the value is; don't shrink from it>

## Findings
<Numbered list. Each finding is a surprise, lesson, or unresolved thread.
Each gets a disposition in the next section.>

## Dispositions
<Written after the human approves dispositions in step 4.>
```

Show the draft to the user. Iterate until they approve the narrative
sections. Do not propose dispositions yet.

### 4. Classify findings and propose dispositions

For each finding, propose one of:

| Disposition | When | What happens |
|-------------|------|--------------|
| **Inline** | Trivial fix belongs in the archive PR itself | Apply during this skill, include in the archive PR |
| **Follow-up** | Medium-size fix, related to this project but out of scope | Dispatch as a separate project or PR (suggest `/trout-plan`) |
| **New project** | Large discovery — different scope, different substrate | Invoke `/trout-plan <topic>` after archive PR is up |
| **Defer** | Known but not worth acting on now | Record in RETROSPECTIVE and forget |

Present the list to the user: one row per finding with your proposed
disposition and a one-line rationale. Ask them to approve or revise each.

### 5. Apply dispositions

- **Inline findings**: make the code changes in the current working tree
  on a new branch `archive/<slug>`. Keep them genuinely trivial — if it
  turns into work, promote to Follow-up.
- **Follow-up findings**: do **not** implement. Write a note in
  RETROSPECTIVE.md with a TODO link format suggesting `/trout-plan`
  or a direct PR later.
- **New project**: after the archive PR is authored, invoke
  `/trout-plan <topic>` to birth the replacement.
- **Defer**: record verbatim in the Dispositions section.

Write the final **Dispositions** section in RETROSPECTIVE.md listing each
finding and its approved disposition.

### 6. Relocate

1. Run `Bash("node .claude/scripts/trout/archive-relocate.ts <slug>")` — the script flips `MANIFEST.md`'s `**Status**` field from `active` to `archived` and `git mv`s the project under `projects/archive/`. The new path is on stdout: `relocated: <old-path> → <new-path>`. The script refuses (and reports) if the project doesn't exist, is already archived, has a non-`active` Status, has a missing Status field, or if the destination already exists.
2. Run `Bash("node .claude/scripts/trout/autosave.ts <new-path> --event=archived --detail=<new-path>")` — autosave records the event against the now-relocated MANIFEST. Call against the new path returned by step 1.

### 7. Archive PR

Invoke `/trout-pull-request <slug> archive/<slug>` to author the
archive PR. Its body is the RETROSPECTIVE.md Summary sections, not the
usual checkin body — override the authoring template for archive PRs:

```markdown
<!-- project-archive: <slug> -->

## Archive: <title>
<What we set out to do — verbatim from retro>

## Outcome
<2–4 sentences>

## Inline findings applied
<bullets or "none">

## Follow-ups dispatched
<bullets or "none">

---
Full retrospective: ./projects/archive/<date>-<slug>/RETROSPECTIVE.md
```

### 8. Dispatch follow-ups and new projects

After the archive PR is created:
- For each Follow-up, surface the suggested command to the user
  (`/trout-plan` or a plain PR) — do not auto-dispatch.
- For each New project, invoke `/trout-plan <topic>` so the user can
  run its interview now.

## Completion report

After step 8, post a final summary:

```
Archived: <title> → projects/archive/<date>-<slug>/
PR: <url>
Inline applied: <count>
Follow-ups to dispatch: <list with suggested commands, or "none">
New projects to birth: <list, or "none">
```

## Rules

- **The archive PR is small.** If inline dispositions balloon, promote
  them to follow-ups and shrink the archive PR.
- **The retrospective is honest.** Negative findings are the point of
  this ritual. Do not soften to preserve feelings.
- **Archived means read-only.** No further autosaves after the move.

## Failure modes

- Phases still open → stop, list them.
- User cancels during interview → save the draft retrospective as
  `RETROSPECTIVE-DRAFT.md` in the project directory and stop. Do not
  relocate.
- Git move fails (uncommitted changes in the way) → surface the error;
  do not force.
