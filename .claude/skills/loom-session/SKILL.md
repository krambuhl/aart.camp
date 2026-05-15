---
name: loom-session
description: >-
  Author a structured session handoff for a loom-managed project at
  end-of-session. Reads recent events + correction lines from
  checkins, composes a Session JSON, writes it via
  `bin/loom session write`. Pairs with the loom CLI the way
  trout-save-session pairs with autosave.
argument-hint: "<project-slug-or-path>"
allowed-tools: Read, Write, Bash(bin/loom *)
---

# /loom-session

End-of-session handoff for a loom-managed project. Unlike the event
log (mechanical, append-only, per-state-change), the session handoff
captures the parts of the work that don't fit in event detail
shapes: what shifted in your reasoning, trade-offs considered,
brittle spots, what to watch for next time.

The output is a structured `Session` JSON, not prose. The
**bullet-array fields** (`what_happened`, `open_threads`, `notes`)
hold short summary lines — robots filter and skim them; humans
expand them via `bin/loom session read --pretty`.

**Format reference**: `projects/LOOM-CONVENTIONS.md` (§ Session
storage, repo-relative). Pairs with `bin/loom session write`, which
appends the `session-saved` event.

## Arguments

- `<project-slug-or-path>` — resolved by loom's standard slug
  resolution (date-less form, full form, or path).

## Process

### 1. Read state

Run these in parallel to assemble the corpus:

- `bin/loom events read <slug>` — full event log.
- `bin/loom session corrections <slug>` — every
  `execution.corrections[]` line across the project's checkins,
  attributed to its source checkin + branch.
- `bin/loom session list <slug>` — enumerate existing session
  files (to pick today's letter suffix: `a` if none yet,
  otherwise the next letter).
- `bin/loom project read <slug>` — current manifest state (phases,
  branches, latest checkin per phase).

### 2. Compose the Session JSON

Build a single object matching the `Session` schema:

```json
{
  "schema_version": 1,
  "date": "YYYY-MM-DD",
  "letter": "a",
  "phases_touched": [<numbers>],
  "checkins_written": ["NN", ...],
  "pr_activity": ["#N opened", "#N merged", ...],
  "what_happened": ["...", "..."],
  "open_threads": ["...", "..."],
  "notes": ["...", "..."]
}
```

Rules:
- `date` is today's UTC date.
- `letter` is the next unused letter for today's date among
  existing sessions (`session list` → highest letter + 1; default
  `a`).
- `phases_touched` is the deduplicated list of phase numbers
  attached to events written since the prior session.
- `checkins_written` lists every checkin number created in this
  session.
- `pr_activity` summarizes pr-opened, pr-updated, pr-merged events
  as one-line strings.
- `what_happened` is 2-6 bullets summarizing the session's
  contribution — distill the events into a story, but each bullet
  is a single line, not a paragraph.
- `open_threads` is what the next session should pick up. Include
  anything from `session corrections` that's not yet resolved.
- `notes` captures anything else worth surfacing — substrate
  observations, friction encountered, decisions deferred.

Write the JSON to a temp file at
`/tmp/loom-session-<slug>-<date>-<letter>.json`.

### 3. Write the session

```
Bash("bin/loom session write <slug> --session-file=<temp-path>")
```

`session write` validates the file, writes
`sessions/YYYY-MM-DD-<letter>.json`, and appends the
`session-saved` event in one operation.

### 4. Report

One paragraph: which file landed, where (path), and what's the
single most-important open thread for the next session.

## Rules

- **No prose blobs.** Every field is structured. If a bullet wants
  to be a paragraph, split it or shrink it.
- **Compose `bin/loom`, never `node .claude/cli/loom.ts`.** The
  shim is the entry of record; the node form is an implementation
  detail.
- **Letter suffix is the next unused for today.** Multiple sessions
  per day get `a`, `b`, `c`, … in order. Don't reuse.
- **Records of corrections live in the substrate.** This skill
  surfaces them via `session corrections` and includes the unresolved
  ones in `open_threads`. It does not author new
  `correction:` lines.
- **No emojis.**

## Failure modes

- Slug unresolved → forward loom's error, stop.
- `session write` returns `session-already-exists` → another session
  ran in parallel; pick the next letter and retry once.
- User mid-flight redirects what's in `what_happened` or
  `open_threads` → preserve the redirect verbatim, then check via
  `correction:` lines in the next checkin (not in the session file
  itself, which is composed once at close).
