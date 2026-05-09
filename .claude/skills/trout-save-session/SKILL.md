---
name: trout-save-session
description: >-
  Author a narrative session handoff at the end of a work session. Reads
  recent manifest events, writes sessions/YYYY-MM-DD-<letter>.md, and
  records the session-saved event. Use at session end when there is state
  worth handing off to the next session.
argument-hint: "<project-slug-or-path>"
allowed-tools: Read, Skill, Bash(node .claude/scripts/trout/*)
---

# /trout-save-session

Author one narrative handoff file per work session. Unlike autosave
(mechanical, per-unit), this is written by Claude and captures the parts
of the session that don't fit in the event table: reasoning that moved,
trade-offs considered, what's brittle, what to watch for next time.

**Format reference**: `projects/CONVENTIONS.md` (§ Session handoff format,
repo-relative). Pairs with `.claude/scripts/trout/autosave.ts`, which
records the emitted event.

The deterministic finalize tail (filename determination, file write, and
correction-capture invocations) lives in
`.claude/scripts/trout/save-session-finalize.ts`. Narrative authoring
stays in this skill body — that's the LLM-shaped heart of the handoff.

## Process

1. **Resolve the project directory.** `$ARGUMENTS` is the project slug or
   path (resolution rules as in `.claude/scripts/trout/autoload.ts`).
   If omitted, resolve from the current working directory; if resolution
   fails, surface the error and stop.
2. **Read the manifest** to get the list of events emitted during this
   session. A session is "events since the last `session-saved` event" —
   if no prior one exists, use the whole event log.
3. **Read the checkins touched this session** to inform the narrative —
   what shipped, what got flagged, what felt brittle. Don't inventory
   `correction:` lines manually; the finalize script captures them.
4. **Draft the narrative.** Use the template below. Keep it tight —
   2–6 sentences for "What happened", a short list for "Open threads".
   Synthesize, don't log-dump. Write to a temp file at
   `/tmp/session-handoff-<slug>-<timestamp>.md`.
5. **Finalize.** Run
   `Bash("node .claude/scripts/trout/save-session-finalize.ts <slug> --content-file=<temp-file>")`.
   The script picks the next available `<YYYY-MM-DD>-<letter>.md` under
   `<project>/sessions/`, writes the content, walks manifest events
   backward to the previous `session-saved` (or table start) to find
   this session's checkins, and invokes `griot/capture.ts` per
   `correction:` line found. Stdout: `session-saved: <relative-path>`.
6. **Record the event.** Run
   `Bash("node .claude/scripts/trout/autosave.ts <slug> --event=session-saved --detail=<filename>")`.
   Autosave stays separate so its event vocabulary, permission, and
   test surface remain independent of session-handoff specifics.

## Report

After step 6, respond with exactly four lines:

```
session: <path of handoff file>
touched: phases=<list>, checkins=<NN list>, PR=<#N or none>
captured: <N learnings to session-notes/ — run /griot-compact to process, or "none">
open-threads: <comma-separated, or "none">
```

For the `captured` count, list `learnings/session-notes/` after step 5
returns and count folders newer than the prior session-saved event.

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
<Omit this section entirely if step 5 captured nothing.>
- `learnings/session-notes/<folder>/` — from `<checkin-path>`.

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

- Project not found → the finalize script surfaces the error from
  `resolveProject`; do not create anything else.
- No new events since last session-saved → write a short narrative that
  says "No substantive work this session" and still record the event,
  unless there were truly zero events at all, in which case stop and
  report it.
- All letters a-z taken for today's date → the finalize script fails
  with `save-session-finalize-error: all letters a-z taken for <date>`.
  Stop and ask the user — that's a sign something has gone wrong.
- Capture sub-invocation fails → the finalize script surfaces the
  capture error verbatim and exits non-zero. The session file is
  written before captures run, so a capture failure leaves a session
  file on disk; resolve the underlying issue and re-invoke is not
  idempotent (the next-letter pick will advance). Manual cleanup may
  be needed.
