---
name: griot-use
description: >-
  Load learnings/rollup.md into context and install the citation contract.
  Use ONLY when explicitly invoked via /griot-use. Never auto-invoke.
  Do not load session-notes/ or nightly/ — only rollup.md.
user-invocable: true
allowed-tools: Read
---

# Learnings Use

Load the curated rollup of validated learnings for this session and install
the citation contract.

## Procedure

1. Read `learnings/rollup.md` from the repo root.
   - If it doesn't exist, tell the user: _"No rollup yet — run
     `/griot-compact` once captures exist."_ Then stop.
   - If it exists but has no entries (only the header), tell the user:
     _"Rollup is empty — no validated learnings yet."_ Then stop.
2. If there are entries, echo a summary like: _"Loaded N learnings from
   `learnings/rollup.md`. I'll append `Applied: L-NNN` when I use any of
   them."_
3. Keep the rollup contents resident in your working context for this
   session. Refer back to them when relevant.

## The citation contract

For the remainder of this session:

> If you apply any of the learnings from `rollup.md` to a response — whether
> avoiding a pattern it warns against, using a pattern it prefers, or
> structuring output the way an entry dictates — end that response with
> `Applied: L-NNN` (or comma-separated: `Applied: L-012, L-027`) on its own
> line.

Only cite a learning when you **actively used it**. Don't cite a learning
just because it was relevant-adjacent. The Stop hook greps the transcript
for `Applied: L-\d+` and updates `citations.json` accordingly — padded
citations poison that signal.

## Tier separation

Only `rollup.md` is ever loaded at session time. Do **not** read
`session-notes/`, `nightly/`, or anything else under `learnings/` during a
session — those layers are allowed to contradict the rollup and are only
valid inputs to `/griot-compact`.

## When this ends

This skill's work is done once the rollup is loaded and the contract is
stated. The user drives the session from here. Don't continue to other
tasks unless asked.
