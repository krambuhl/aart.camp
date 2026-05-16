---
name: a11y-review-file
description: >-
  Single-file a11y review. Invokes /guild-validate with evaluator-a11y
  against one .tsx file path; returns the structured panel verdict.
  Composes the guild-* substrate only — no ev-loop opinions (no unit
  contract, no whiteboard step, no checkin authoring, no findings
  JSONL write, no autosave, no PR creation). The composability-proof
  loop for the agent-guilds substrate; reusable by any caller wanting
  a naked single-file evaluator panel.
argument-hint: "<repo-relative .tsx path>"
user-invocable: true
disable-model-invocation: true
allowed-tools: Read, Skill
---

# /a11y-review-file

Naked-substrate composability demo. Takes one `.tsx` path; spawns
`evaluator-a11y` via `/guild-validate`; returns the verdict.

## Argument

`<file-path>` — repo-relative path to a `.tsx` file.

## Process

1. **Read the target file** via the `Read` tool. Hold the contents
   for inclusion in the evaluation packet.
2. **Build a minimal evaluation packet** with three sections:
   - `## How to evaluate efficiently` — one paragraph telling the
     evaluator the packet is minimal by design; spot-check the file
     directly; emit `VERDICT:` on its own line.
   - `## Contract (paraphrased)` — one sentence: "Review
     `<file-path>` for a11y antipatterns per `evaluator-a11y`'s
     rubric. No remediation expected; verdict + findings only."
   - `## Artifact` — the file contents inline, fenced.
   - `## Original ask` — one sentence: "Single-file a11y review;
     naked-substrate composability proof."
3. **Invoke `/guild-validate`** via the `Skill` tool with
   `agents=evaluator-a11y` and the packet from step 2.
4. **Return the structured verdict** (the `{verdict,
   blocking_findings, advisory_findings, cli_runs, conflicts}` shape)
   verbatim to the caller.

## Rules

- **Single-file scoped.** No multi-file batching; that's ev-loop's
  confidence-loop territory.
- **Read-only.** No remediation, no Edit/Write, no auto-fix.
- **No ev-loop composition.** No unit contract, no whiteboard, no
  checkin, no `.guild-findings.jsonl` append, no `bin/loom phase update`,
  no `bin/loom pr open|update`. The substrate's `guild-*` primitives
  are the only ones composed.
- **Single-evaluator panel.** No conflict resolution path runs.
- **No emojis.**
