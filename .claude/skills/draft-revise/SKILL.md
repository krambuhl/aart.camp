---
name: draft-revise
description: >-
  Thin composer for mid-flight PLAN.md revisions. Reads the current
  PLAN, integrates a scope-shift summary, surfaces the change for
  user confirm, and shells to `bin/draft revise --rationale=<summary>`.
  Invoked loop-side after `ev-loop-*` detects a scope-shift signal;
  not user-facing under normal conditions. No grill-me ceremony —
  revisions are surgical in v1.
argument-hint: "<slug> <one-line scope-shift summary>"
allowed-tools: Read, Write, Bash(bin/draft *), AskUserQuestion
user-invocable: false
---

# /draft-revise

A thin loop-invoked composer. The job: take the current PLAN.md +
a scope-shift summary, integrate the change surgically, get user
confirm, commit via `bin/draft revise`.

This skill is **not user-invocable** — it's composed by
`ev-loop-confidence` and `ev-loop-interactive` after their
scope-shift detection step fires. Users land here indirectly: a
loop offers a revision; user confirms; the loop dispatches here.

**No grill-me ceremony.** Revisions are surgical. The user has
already approved the offer at the loop layer; this skill just
composes the file and gets one final confirmation on the proposed
content. If revision quality consistently slips, the deferred item
in the parent project (`projects/2026-05-15-draft-cli/PLAN.md` §
Deferred) lifts this skill to a grill-me posture — but that's a
later concern.

## Process

### 1. Parse arguments

`$ARGUMENTS` is `<slug> <one-line summary>`. The slug is the
date-prefixed or date-less project identifier (the CLI resolves
either). The summary is the rationale that will land in the
commit message AND the `## Revision log` entry.

- If slug is missing, refuse with a short message and stop. The
  caller (loop) is responsible for passing it.
- If summary is missing, ask the user for one in one sentence.
  Don't fill it in yourself — the rationale is the load-bearing
  artifact for the revision trail.

### 2. Read the current PLAN.md

Invoke:

```
Bash("bin/draft read <slug>")
```

The CLI emits a JSON envelope. Parse to extract:
- `path` — repo-relative PLAN.md path
- `content` — full PLAN.md markdown

If the CLI errors (`project-not-found`, `plan-not-found`), surface
the error verbatim and stop. The caller resolves.

### 3. Compose the revision

Read the current PLAN.md content. Integrate the scope-shift change
surgically:

- Preserve unrelated sections verbatim. The composer's job is to
  reflect the named scope shift, not to rewrite the document.
- If the shift affects a specific phase, update that phase's
  prose. Adjust dependencies and verification if they ripple.
- If the shift introduces or removes a deliverable, update the
  Phases section.
- If the shift touches Decisions, append or revise the relevant
  decision.
- Leave the existing `## Revision log` section untouched (if
  present). The CLI appends the new entry; do not pre-author it.

The composed content is the full new PLAN.md. Write it to:

```
/tmp/draft-revision-<slug>.md
```

### 4. Surface + confirm

Show the user a 1-3 sentence summary of the change:

```
Proposed revision for <slug>:
- <one-line description of what's changing>
- <one-line description of why (echo the summary)>
- Files touched: PLAN.md (Revision log entry will be appended)
```

Use `AskUserQuestion` for the confirm:

- "Apply this revision?" → yes / no / show me the full revision
  first

If the user wants the full revision first, surface the entire
`/tmp/draft-revision-<slug>.md` content (or a diff-like
representation if the change is small). Then re-ask the confirm.

If the user declines, stop. Don't shell to the CLI. Leave the
temp file for inspection.

### 5. Commit via the CLI

On confirm, invoke:

```
Bash("bin/draft revise <slug> --revision-file=/tmp/draft-revision-<slug>.md --rationale=<summary>")
```

The CLI:
- Replaces PLAN.md with the composed content.
- Appends a `<YYYY-MM-DD> — <summary>` entry to PLAN.md's
  `## Revision log` section (or creates the section if absent).
- Commits with `[draft revise] <slug>: <summary>`.

If the CLI errors, surface verbatim and stop.

### 6. Report

One short line:

```
Revised <slug>: <summary>
PLAN.md updated; ## Revision log entry appended.
```

Return to the calling loop. The loop resumes the deliverable that
fired the scope-shift signal.

## Rules

- **No grill-me ceremony.** The user has already approved the offer
  at the loop layer. This skill is surgical, not exploratory.
- **Preserve unrelated sections.** The composer's job is to
  reflect the named shift, not to rewrite the document. If you
  find yourself touching sections that don't relate to the
  summary, stop and ask.
- **Rationale is the load-bearing artifact.** It lands in the
  commit message AND the in-PLAN Revision log. Six months from
  now, the rationale is what tells future maintainers _why_ the
  plan changed. Make it specific.
- **No emojis.**
- **`Bash("bin/draft *")` is the only allowed shell prefix.** The
  CLI carries the deterministic IO; the skill shouldn't shell out
  to git or fs directly.
- **Do not invoke this skill yourself if you are the user.** Use
  `/draft-plan` for fresh plans or edit PLAN.md by hand + `bin/draft
  revise <slug> --revision-file=<your-edit> --rationale="..."` for
  surgical updates. This skill exists for loop integration; the
  `user-invocable: false` keeps it out of the slash-command
  surface.

## Failure modes

- Slug not provided: refuse with a one-line message naming the
  caller (`ev-loop-*`) as the source of the missing arg. Stop.
- Project not found (CLI error `project-not-found`): surface and
  stop. The loop misrouted; user resolves.
- PLAN.md not found (`plan-not-found`): surface and stop. The
  loop misrouted (revising a project that doesn't have a draft
  yet); user runs `/draft-plan` first.
- User declines the revision after seeing the proposed change:
  leave the temp file at `/tmp/draft-revision-<slug>.md` for
  inspection. Report "revision declined" back to the loop.
- The composed revision drifts substantially from the scope-shift
  summary (composer over-reaches): the user catches this at step 4
  confirm. Iterate the composition or decline.
