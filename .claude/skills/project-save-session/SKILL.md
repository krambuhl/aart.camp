---
name: project-save-session
description: >-
  Author a narrative session handoff at the end of a work session. Reads
  recent manifest events, writes sessions/YYYY-MM-DD-<letter>.md, and
  records the session-saved event. Use at session end when there is state
  worth handing off to the next session.
argument-hint: "<project-slug-or-path>"
disable-model-invocation: true
allowed-tools: Read, Write, Bash, Skill
---

# /project-save-session

Author one narrative handoff file per work session. Unlike autosave
(mechanical, per-unit), this is written by Claude and captures the parts
of the session that don't fit in the event table: reasoning that moved,
trade-offs considered, what's brittle, what to watch for next time.

**Format reference**: `projects/CONVENTIONS.md` (§ Session handoff format,
repo-relative). Pairs with `/project-autosave`, which records the emitted
event.

## Process

1. **Resolve the project directory.** `$ARGUMENTS` is the project slug or
   path (resolution rules as in `/project-autoload`). If omitted, resolve
   from the current working directory; if resolution fails, surface the
   error and stop.
2. **Read the manifest** to get the list of events emitted during this
   session. A session is "events since the last `session-saved` event" —
   if no prior one exists, use the whole event log.
3. **Read the checkins touched this session.** The manifest events
   `checkin-created` give you their paths. Read each to get scope and
   verdict.
4. **Determine the filename.** Today's date is available via
   `date '+%Y-%m-%d'`. Start at letter `a`. If
   `sessions/YYYY-MM-DD-a.md` already exists, try `b`, then `c`, etc. If
   `z` is already taken, stop and ask the user — that's a sign something
   has gone wrong.
5. **Draft the handoff** using the template below. Keep it tight —
   2–6 sentences for "What happened", a short list for "Open threads".
   Don't repeat the event log; synthesize. Capture things a human or a
   future Claude would actually want on a cold read: what was tried and
   rejected, what's fragile, what's blocking, what deserves a second
   look.
6. **Write the file.** Do not commit.
7. **Invoke `/project-autosave`** via the Skill tool —
   `skill: project-autosave`, `args: "<slug> --event=session-saved
   --detail=<filename>"` — to log the event.

## Report

After writing, respond with exactly three lines:

```
session: <path of handoff file>
touched: phases=<list>, checkins=<NN list>, PR=<#N or none>
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

## Notes
<anything not captured elsewhere — one-off observations, references, etc.>
```

## Quality bar

- **Narrative, not a log dump.** If you find yourself listing events
  verbatim, stop and write what they meant instead.
- **Honest.** If the session ended with a broken build or a half-done
  refactor, say so in "Open threads".
- **Under a page.** Long handoffs don't get read. Synthesize.
- **No emojis. No ASCII art.**

## Failure modes

- Project not found → surface the error from `/project-autosave`
  resolution; do not create anything.
- No new events since last session-saved → write a short file that says
  "No substantive work this session" and still record the event, unless
  there were truly zero events at all, in which case stop and report it.
