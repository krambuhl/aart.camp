---
name: loom-archive
description: >-
  Close out a loom-managed project. Interview the user for color,
  synthesize a project-type retrospective from the corpus, write the
  retro via `bin/loom retro write --type=project`, then relocate the
  project to `archive/` via `bin/loom project archive`. Stops there —
  composing the archive PR is a separate concern.
argument-hint: "<project-slug-or-path>"
user-invocable: true
allowed-tools: Read, Write, Bash(bin/loom *), AskUserQuestion
---

# /loom-archive

Retire a finished loom-managed project. Use when every phase has
shipped and merged, the user is ready to put the project to bed,
and you want a structured retrospective on disk before the
directory moves to `archive/`.

The retrospective is a **structured Retro JSON** with categorized
findings, not a markdown prose RETROSPECTIVE.md. Categories are
`kept-well` / `improvement` / `process-change` / `follow-up`
(from `RetroFindingCategory`). Robots filter; humans expand via
`bin/loom retro read --type=project --pretty`.

**Format reference**: `projects/LOOM-CONVENTIONS.md` (§ Retro
storage, repo-relative). Pairs with `bin/loom retro write` and
`bin/loom project archive`, both of which append their respective
events (`retro-written`, `archived`).

## Arguments

- `<project-slug-or-path>` — resolved by loom's standard slug
  resolution.

## Process

### 1. Pre-flight

- `bin/loom project read <slug> --pretty` — current state.
- Verify every phase is `completed`. If any phase isn't,
  stop and report the open ones. Archiving a project with open
  work is allowed only via explicit user override (next paragraph).

### 2. Read the corpus

Corpus-first: the model needs the same context the user has before
asking grill-me questions. Read everything before § 3.

- `bin/loom checkin list <slug>` — every checkin file.
- `bin/loom events read <slug>` — full event log.
- `bin/loom session corrections <slug>` — every correction across
  the project.
- `bin/loom retro list <slug> --type=session` — every session-tier
  retro shipped during confidence-loop work (if any).
- Read `PLAN.md` directly via `Read` for the original framing.

### 3. Grill-me interview (one dimension at a time)

The corpus gives the model an opinionated draft on each retro
dimension. The user's job is to confirm, extend, replace, or skip.
Use `AskUserQuestion` for each dimension; one question at a time.
Match `/draft-plan`'s grill-me pace: recommended answer first,
discrete options, structured turn.

For each of the four retro dimensions, follow this shape:

1. **Draft a recommendation from the corpus.** One or two sentences,
   opinionated. Reference specific PRs / checkins / corrections by
   number when the corpus supports them. Don't hedge — the user
   redirects when they disagree.
2. **Ask the user via `AskUserQuestion`** with these options
   (always in this order; first option is the recommended path):
   - `Looks right — capture as-is` (the model's draft becomes the
     finding)
   - `Yes, and add more` (user extends with one or more additional
     findings in this category)
   - `Replace with mine` (user provides the actual content)
   - `Skip this dimension` (no finding in this category for this
     project)
3. **Capture the resolved finding(s)** into the in-progress
   `findings[]` array. Don't write to disk yet — that's § 4.

The four dimensions, asked in order:

- **What worked unexpectedly well?** → `kept-well` finding(s).
  At least 2 by the end of this dimension and the next.
- **What was harder than expected, and why?** → `improvement`
  finding(s). At least 2.
- **Any patterns that should change in future projects** (substrate
  conventions, decomposition style, panel composition, etc.)? →
  `process-change` finding(s). Often zero or one.
- **Anything carried as a follow-up vs dropped on the floor?** →
  `follow-up` finding(s). Include unresolved corrections as
  evidence when relevant.

Open-ended follow-up exchanges within a single dimension (the user
elaborates, the model asks a clarifying natural-language question)
stay outside `AskUserQuestion` — that's the standard grill-me
posture from `/draft-plan` § 2.

### 4. Compose the project retro JSON

Build a single object matching `ProjectRetro`:

```json
{
  "schema_version": 1,
  "type": "project",
  "created": "<ISO-8601 UTC>",
  "findings": [
    {
      "category": "kept-well" | "improvement" | "process-change" | "follow-up",
      "description": "<one-line description>",
      "evidence": "<optional citation>"
    },
    ...
  ]
}
```

Composition rules:

- Aim for 6-12 total findings across categories. Less means
  thin retro; more means losing focus.
- **kept-well** — what worked. At least 2.
- **improvement** — what didn't, but should be done differently
  next time. At least 2.
- **process-change** — substrate-level changes (convention
  updates, new lint rules, panel-composition tweaks, etc.).
- **follow-up** — work that's open but not blocking the archive.
  Include unresolved corrections here as evidence.
- `evidence` is optional but valuable — a specific PR number,
  checkin reference, or quoted correction line.

Write to a temp file at `/tmp/loom-retro-<slug>-project.json`.

### 5. Write the retro

```
Bash("bin/loom retro write <slug> --retro-file=<temp-path>")
```

This appends the `retro-written` event with
`detail: {type: 'project'}` and writes `retros/project.json`.

### 6. Archive the project

```
Bash("bin/loom project archive <slug>")
```

This is non-atomic by design (manifest flips, event appends, dir
relocates). If the rename fails, the next `loom doctor` run will
surface the drift; recovery is manual.

### 7. Report

One paragraph naming the archive destination path, the retro
location (under archive/retros/project.json after the move), and
any follow-up findings worth surfacing immediately.

The skill stops here. Authoring the archive PR is a separate
concern — compose the body inline per the PR-composition recipe
in `ev-loop-confidence` / `ev-loop-interactive` § Compose PR (or
just run `bin/loom pr open` directly with a hand-written body),
then squash-merge.

## Rules

- **Phases must be completed.** Archiving an in-progress project
  is the user's explicit call, not the skill's default.
- **Findings are categorized, not prose.** Each finding is a one-line
  description in one of four categories. If a thought is longer
  than a line, split it or compress it.
- **Compose `bin/loom`.** Never node-invoke loom directly.
- **Grill-me pace.** Corpus-first, then one dimension at a time
  via `AskUserQuestion`. Recommended answer first, discrete options
  second. The user redirects; the model doesn't ask open-ended
  questions before drafting from the corpus.
- **Stops at archive.** PR authoring is downstream.
- **No emojis.**

## Failure modes

- Slug unresolved → forward loom's error, stop.
- Phases incomplete and user declined override → stop, report
  the open phases.
- `retro write` returns `retro-already-exists` → the project
  already has a project retro; refuse to overwrite. The user can
  delete the existing one if they want a fresh retro.
- `project archive` rename fails after retro write + manifest
  flip → surface the drift (status says archived but dir
  remains). User runs `loom doctor` and resolves manually.
