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
   verdict. While reading, also collect **learning-capture candidates**
   per § Learning capture candidates below.
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
   look. Populate **Learning capture candidates** only if the scan in
   step 3 found any.
6. **Write the file.** Do not commit.
7. **Invoke `/project-autosave`** via the Skill tool —
   `skill: project-autosave`, `args: "<slug> --event=session-saved
   --detail=<filename>"` — to log the event.
8. **If any learning candidates were surfaced**, end the report with a
   nudge: `candidates for /learnings-capture: N — see "Learning capture
   candidates" in the handoff`. Do **not** invoke `/learnings-capture`
   yourself — the capture gate ("would a reasonable Claude have gotten
   this wrong by default?") is a judgment the user has to make.

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

## Learning capture candidates
<Omit this section entirely if no candidates surfaced.>
- **<short slug>** — <one-line description of what was corrected>.
  Suggested `/learnings-capture` slug: `<kebab-case>`.

## Notes
<anything not captured elsewhere — one-off observations, references, etc.>
```

## Learning capture candidates

When reading checkins and events in step 3, watch for signals that the
session contains a correction a future Claude should learn from. Likely
signals:

- Evaluator flags tagged `rules-violation`, `scope-creep`,
  `contract-ask-drift`, or `contract-inadequate` that the unit then
  resolved — the *cause* of the flag is candidate material.
- "Notes for the PR" sections in checkins that say "user redirected"
  or "corrected approach" or otherwise name a user course-correction.
- Events where a unit went through ≥ 2 evaluator iterations — often a
  sign the generator's default was off.
- The user explicitly said "next time" or "in future" while directing
  mid-session.

Apply the **capture gate** before listing a candidate, same as
`/learnings-capture`:

> Would a reasonable Claude have gotten this wrong by default? Is the
> correction non-obvious, and does it contradict something Claude
> would say by default?

If yes, list the candidate in the handoff's "Learning capture
candidates" section with a 3–5 word slug proposal. If no, omit. Signal
over volume — a shallow candidate pollutes the corpus.

The handoff surfaces candidates; the user decides whether to run
`/learnings-capture`. Never write to `learnings/session-notes/` from
this skill.

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
