---
name: trout-autosave
description: >-
  Write a structured state update to a project's MANIFEST.md. Called after
  each unit of work, at phase boundaries, and on PR events. Mechanical, not
  narrative — appends one event row and refreshes the summary sections.
  Use when the caller needs ground-truth state persisted to disk in the
  project substrate format.
argument-hint: "<project-slug-or-path> [--init] [--event=<name>] [--detail=<text>] [--current-state=<text>] [--phase-update=<n>:<status>[:<k=v>]*]"
allowed-tools: Read, Edit, Write, Bash(date:*)
---

# /trout-autosave

Write a single structured update to a project's `MANIFEST.md`. This is the
substrate primitive for persisting state. Loops call it after every unit;
the router calls it at phase boundaries; PR skills call it on PR events.

**Format reference**: `projects/CONVENTIONS.md` (repo-relative). Read it if
you are unfamiliar with the manifest shape or event vocabulary. Do not
invent fields or event names.

## Arguments

`$ARGUMENTS` begins with a project identifier. Everything after the
identifier is flags.

- `<project-slug-or-path>` — one of:
  - A full slug: `2026-04-23-adopt-biome`
  - A bare name: `adopt-biome` (resolve against `./projects/` by
    suffix match on everything after the date prefix)
  - A full path: `./projects/2026-04-23-adopt-biome`
- `--init` — create the project directory scaffold and write the first
  MANIFEST.md. Expects the caller (`/trout-plan`) to have already
  produced `PLAN.md` content in-memory; the `--detail` flag carries a
  compact JSON object with fields: `title`, `slug`, `started`, `strategy`,
  `phases` (array of `{name, dependencies}`).
- `--event=<name>` — event name from the vocabulary. Required unless
  `--init`.
- `--detail=<text>` — detail string for the event. Optional; format
  depends on the event (see CONVENTIONS.md).

The caller may also pass `--current-state=<text>` to replace the Current
state section in one shot, and `--phase-update=<n>:<status>[:<field=value>]*`
to mutate one row of the Phases table (for example,
`--phase-update=2:in-progress:branch=claude/adopt-biome-v1:checkin=03`).

## Process

1. **Resolve the project directory.** Under `./projects/`, look for an
   exact match first, then a suffix match. If zero or multiple match, fail
   with a clear error listing the candidates.
2. **If `--init`:** create the directory tree (`sessions/`, `checkins/`),
   write `MANIFEST.md` from the template in CONVENTIONS.md populated from
   the `--detail` JSON, and write a minimal `config.md` placeholder. Append
   a single `project-initialized` event. Done.
3. **Otherwise:** read the existing `MANIFEST.md`.
4. **Get the timestamp.** Run `date '+%Y-%m-%d %H:%M'` via Bash once.
5. **Apply updates** in this order, editing the manifest in place:
   a. If `--phase-update` is present, rewrite that row of the Phases table.
   b. If a PR event is fired, update the PR column of the relevant phase
      row.
   c. If `--current-state` is present, replace the Current state paragraph.
   d. If a `checkin-created` event is fired, update the top-level
      **Latest checkin** field and the Latest checkin column in the phase
      row.
   e. Append the event row to the Events table: `| <timestamp> | <event> | <detail> |`.
6. **Do not commit.** Autosave is per-unit and happens many times between
   commits. The loop decides when to stage and commit manifest changes,
   typically at PR boundaries.

## Write discipline

- **One event per call.** Batching events in a single call defeats the
  point. Callers that need to record multiple transitions call autosave
  multiple times.
- **Preserve manual edits.** If a human has hand-edited sections outside
  the strict template (notes below Events, annotations on phase rows),
  leave them alone. Only touch the sections you are updating.
- **Never rewrite history.** Previous event rows are immutable. Never
  modify or remove rows already in the Events table.
- **Events table grows downward.** New rows append at the bottom.
- **Fail loudly on vocabulary violations.** If the caller passes an
  `--event` not in CONVENTIONS.md, refuse and list the valid events.

## Project resolution

Given a bare name `adopt-biome`, look for a directory under `./projects/`
whose name ends with `-adopt-biome`. If exactly one matches, use it. If
multiple match, fail and print the candidates. If none matches and the
argument is not a full path, fail and suggest `/trout-plan <topic>` to
create a new project.

If the argument is a full path (starts with `.` or `/`), use it directly.

Archived projects live under `./projects/archive/`. Do **not** autosave
into them — they are read-only. If the caller resolves to an archive path,
fail.

## Examples

Initial scaffold (called by `/trout-plan`):
```
/trout-autosave 2026-04-23-adopt-biome --init --detail='{"title":"Adopt Biome","slug":"2026-04-23-adopt-biome","started":"2026-04-23","strategy":"Replace ESLint with Biome across three phases.","phases":[{"name":"Setup"},{"name":"Remove ESLint","dependencies":["Phase 1 merged"]},{"name":"Cleanup","dependencies":["Phase 2 merged"]}]}'
```

Record a checkin from inside a loop:
```
/trout-autosave adopt-biome --event=checkin-created --detail="03 on claude/adopt-biome-v1" --phase-update=2:in-progress:branch=claude/adopt-biome-v1:checkin=03 --current-state="Phase 2 unit 3: running lint to verify ESLint removal."
```

PR opened by `/trout-pull-request`:
```
/trout-autosave adopt-biome --event=pr-opened --detail="#14" --phase-update=2:in-progress:pr=#14
```

Session handoff written by `/trout-save-session`:
```
/trout-autosave adopt-biome --event=session-saved --detail="2026-04-23-a"
```

## Output

On success, print a single line:
`autosave: <slug> <event> @ <timestamp>`

On failure, print:
`autosave-error: <reason>[; candidates: <a>, <b>]`
and stop without writing.

## Failure modes

- Project not found → suggest `/trout-plan` or list matching candidates.
- Multiple matches → print candidates; caller must retry with a fuller slug.
- Archived project → refuse to write.
- Unknown event name → print the valid vocabulary from CONVENTIONS.md.
- Manifest missing required sections → re-emit the missing section from
  the template, preserving existing content, then apply the update.
