---
name: griot-load
description: >-
  Load the validated learnings rollup into the current session as
  LLM-friendly prose, with the citation contract installed. Wraps
  `bin/griot use --as=llm` — the CLI does the rendering; this skill is
  the addressable user surface for manual rollup loads. Use when you
  want the rollup active mid-session or as the deliberate session-start
  loader. Opt-in: not auto-invoked.
user-invocable: true
disable-model-invocation: true
allowed-tools: Bash
---

# Griot Load

Render `learnings/rollup.json` to LLM prose and emit it into the
current session, along with the citation contract that asks Claude to
emit `Applied: L-NNN` (or `AP-NNN`) when it applies a learning or
antipattern from the rollup.

This skill is a **thin wrapper**. All rendering, schema interpretation,
and citation-contract content live in `bin/griot use --as=llm`. The
skill exists as the addressable `/griot-load` user surface;
automated loaders (like `/ev-run`'s start-of-session step) call the CLI
directly via Bash without composing this skill. Per the substrate-API-
stability rule and the Phase 4 rollup pinned Decision: synthesis lives
in the CLI, the skill is a name-stable handle.

## Invocation

Run the CLI and return its stdout verbatim:

```bash
bin/griot use --as=llm
```

The CLI handles all three load outcomes:

- `loaded N learnings` → status line + full rollup content + citation
  contract. Top of context for the rest of the session.
- `rollup empty` → short message, no citation contract. No promoted
  entries yet.
- `no rollup yet` → short message, no citation contract. No rollup
  file present (e.g., a fresh clone before any `/griot-compact` run).

A format-detection error fires if a mid-flight session encounters the
legacy `learnings/rollup.md` without `learnings/rollup.json` — that's
a Phase-4-rollup-cutover safety net per the substrate's whiteboard
findings. The remedy is to run
`node .claude/scripts/migrate-rollup-md-to-json.ts` and restart the
session.

## Do not

- Do not add synthesis to this skill body. Any prose or logic above
  what `bin/griot use --as=llm` already emits should land in the CLI
  itself, so other consumers (e.g. `/ev-run`'s loader step) get it
  identically. Two skills with the same job and different names
  is a cohesion failure; one skill that wraps the CLI keeps the
  citation contract single-sourced.
- Do not invoke this skill automatically. It is opt-in per the
  learnings-system Principle 4 (Opt-in). The user types `/griot-load`
  deliberately.
- Do not read `learnings/rollup.json` directly from the skill body.
  Always go through `bin/griot use --as=llm` — the CLI owns the
  schema-to-prose render and the legacy-format detection error path.
