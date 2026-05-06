---
name: trout-save-session
description: >-
  Author a narrative session handoff at the end of a work session. Reads
  recent manifest events, writes sessions/YYYY-MM-DD-<letter>.md, and
  records the session-saved event. Use at session end when there is state
  worth handing off to the next session.
argument-hint: "<project-slug-or-path>"
allowed-tools: Read, Write, Bash(date:*), Skill
---

# /trout-save-session

Author one narrative handoff file per work session. Unlike autosave
(mechanical, per-unit), this is written by Claude and captures the parts
of the session that don't fit in the event table: reasoning that moved,
trade-offs considered, what's brittle, what to watch for next time.

**Format reference**: `projects/CONVENTIONS.md` (§ Session handoff format,
repo-relative). Pairs with `.claude/scripts/trout/autosave.ts`, which
records the emitted event.

## Process

1. **Resolve the project directory.** `$ARGUMENTS` is the project slug or
   path (resolution rules as in `.claude/scripts/trout/autoload.ts`).
   If omitted, resolve
   from the current working directory; if resolution fails, surface the
   error and stop.
2. **Read the manifest** to get the list of events emitted during this
   session. A session is "events since the last `session-saved` event" —
   if no prior one exists, use the whole event log.
3. **Read the checkins touched this session.** The manifest events
   `checkin-created` give you their paths. Read each to get scope,
   verdict, and any `correction:` lines in "Notes for the PR".
4. **Capture corrections.** For each `correction:` line found in step
   3, invoke `/griot-capture` via the Skill tool with
   `args: "--from-checkin=<checkin-path> --slug=<proposed-slug>"`.
   Do this **before** writing the handoff so the handoff can report
   actual counts. Don't apply a value gate here — the user marking a
   line `correction:` is the gate, and `/griot-compact` is the
   value filter. Capture every correction.
5. **Determine the filename.** Today's date is available via
   `date '+%Y-%m-%d'`. Start at letter `a`. If
   `sessions/YYYY-MM-DD-a.md` already exists, try `b`, then `c`, etc. If
   `z` is already taken, stop and ask the user — that's a sign something
   has gone wrong.
6. **Draft the handoff** using the template below. Keep it tight —
   2–6 sentences for "What happened", a short list for "Open threads".
   Don't repeat the event log; synthesize. If step 4 produced captures,
   list the session-notes paths under **Learnings captured**; otherwise
   omit that section.
7. **Write the file.** Do not commit.
8. **Run** `Bash("node .claude/scripts/trout/autosave.ts <slug> --event=session-saved --detail=<filename>")` to log the event.

## Report

After writing, respond with exactly four lines:

```
session: <path of handoff file>
touched: phases=<list>, checkins=<NN list>, PR=<#N or none>
captured: <N learnings to session-notes/ — run /griot-compact to process, or "none">
open-threads: <comma-separated, or "none">
```

## Template

```markdown
# Session YYYY-MM-DD-<letter>

**Phases touched**: <phase numbers>
**Checkins written**: <NN list>
**PR activity**: <#N opened|updated|merged, or "none">

## What happened
<2–6 sentences of narrative — what moved, what we decided, what stuck>

## Open threads
- <thread the next session should pick up>
- <known risk or unresolved question>

## Learnings captured
<Omit this section entirely if step 4 captured nothing.>
- `learnings/session-notes/<folder>/` — from `<checkin-path>`.

## Notes
<anything not captured elsewhere — one-off observations, references, etc.>
```

## Capturing corrections (step 4, in detail)

In step 3, when you read each checkin, collect every line in
`## Notes for the PR` that starts with `correction:`. Each such line
is a capture.

For each correction line:

1. Derive a 3–5 word kebab-case slug from the correction text or the
   checkin's Unit field.
2. Invoke the `griot-capture` skill via the Skill tool:
   - `skill`: `griot-capture`
   - `args`: `--from-checkin=<checkin-path> --slug=<slug>`
3. Capture returns a `captured: learnings/session-notes/<folder>/`
   line. Collect those paths for the handoff's "Learnings captured"
   section.

**Do not apply a value gate.** The user marking a line `correction:`
is the gate. `/griot-compact` is the value filter — it runs the
judge panel and decides which captures get promoted to `rollup.md`.
Save-session's job is to not lose correction signal, not to decide
what's worth keeping.

If a checkin has multiple `correction:` lines, invoke capture once per
line with distinct slugs (e.g. `unit-7-corr-a`, `unit-7-corr-b`).
Multiple captures from the same checkin is fine.

## Quality bar

- **Narrative, not a log dump.** If you find yourself listing events
  verbatim, stop and write what they meant instead.
- **Honest.** If the session ended with a broken build or a half-done
  refactor, say so in "Open threads".
- **Under a page.** Long handoffs don't get read. Synthesize.
- **No emojis. No ASCII art.**

## Failure modes

- Project not found → surface the error from `.claude/scripts/trout/autosave.ts`
  resolution; do not create anything.
- No new events since last session-saved → write a short file that says
  "No substantive work this session" and still record the event, unless
  there were truly zero events at all, in which case stop and report it.
