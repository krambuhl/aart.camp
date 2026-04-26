---
name: fasa-autoload
description: >-
  Load a project's MANIFEST.md, config.md, and most recent session handoff,
  then return a compact orientation briefing. Called at session start and
  by /ev-run before routing. Use when Claude needs to resume work on an
  existing project and establish shared context.
argument-hint: "<project-slug-or-path>"
disable-model-invocation: true
allowed-tools: Read, Bash(ls:*), Bash(git branch:*), Bash(git status:*)
---

# /fasa-autoload

Return an orientation briefing that lets the caller resume work without
reading the full corpus. Read-only.

**Format reference**: `projects/CONVENTIONS.md` (repo-relative).

## Process

1. **Resolve the project directory** from `$ARGUMENTS` using the same
   rules as `/fasa-autosave` (exact slug → suffix match → full path).
   If `$ARGUMENTS` is empty, list the active directories under
   `projects/` (excluding `archive/`) and ask which to load. If the
   project is archived, say so and stop — archive reads go through
   `/fasa-archive` with a different intent.
2. **Read `MANIFEST.md`.** If missing, report "no manifest found — project
   scaffolding may be incomplete" and stop.
3. **Read `config.md`** if present.
4. **Locate the most recent session handoff:** `ls sessions/` sorted
   descending, read the top file. If `sessions/` is empty, skip.
5. **Locate the latest checkin:** follow the top-level `Latest checkin`
   field in the manifest. Read it if the path resolves. Do not enumerate
   all checkins — the manifest is ground truth.
6. **Check git state:** run `git branch --show-current`. If it differs
   from the manifest's `Current branch`, flag the drift in the briefing.
7. **Produce the briefing** (see Output Format below). Do not perform any
   work. Do not modify the manifest.

## Output format

```markdown
## Project orientation: <title> (<slug>)

**Status**: <active|archived>  **Branch (manifest → actual)**: <manifest-branch> → <git-branch>

### Phases
<copy of the Phases table from MANIFEST>

### Current state
<copy of Current state section>

### Last checkin (<NN>, <when>)
- **Unit**: <unit from checkin>
- **Verdict**: <approved|flagged — reason>
- **Notes**: <1-line gist of Notes for the PR, if any>

### Last session (<filename>)
- **Open threads**: <copied verbatim>

### Config highlights
- Verification: <copied commands>
- PR base: <value>

> Drift: manifest says <x>, git is on <y>. (Emit only when drift detected;
> otherwise omit the drift line and the "Branch" arrow is self-evident.)

Omit the `Last checkin` / `Last session` / `Config highlights` sections
entirely when their source files are absent — do not emit empty headings.

### Suggested next action
<one sentence — what the caller should do next, inferred from state>
```

## Suggested next action logic

- Phases all completed → suggest `/fasa-archive <slug>`.
- A phase is `blocked` → name the blocker, suggest resolving it before
  resuming work.
- A phase is `in-progress` with a fresh checkin and no open PR → suggest
  `/fasa-pull-request <slug> <branch>`.
- A phase is `in-progress` with open PR and new comments → suggest
  `/fasa-pr-respond <slug> <pr>` (the router picks up on this signal).
- A phase is `not-started` and its dependencies are satisfied → suggest
  starting it via the branded loop named in `config.md`, or via
  `/ev-run <slug>`.
- A phase is `not-started` and blocked on merged-ness of a prior PR →
  name the PR the caller is waiting on.

## Failure modes

- Project not found → list matching candidates or suggest `/fasa-plan`.
- Archive path → print "archived project — read RETROSPECTIVE.md directly"
  and stop.
- Manifest malformed → print the section that failed to parse and
  recommend manual repair.
- Session directory empty → still produce a briefing; note "no prior
  session handoff".
