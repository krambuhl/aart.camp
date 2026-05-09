---
name: trout-plan
description: >-
  Interview the user about a new project, synthesize PLAN.md, collect config
  values, and scaffold ./projects/<date>-<slug>/. This is how a project is
  born. Use when the user wants to start a new long-running, multi-PR
  effort that should be tracked by the project substrate.
argument-hint: "<topic or short description>"
allowed-tools: Read, Bash
---

# /trout-plan

Birth a new project. Interview → PLAN.md → config.md → scaffold directory
→ init manifest. Stop there. Execution happens in a separate loop.

**Format reference**: `projects/CONVENTIONS.md` (repo-relative).

## Process

### 1. Frame the interview

Treat `$ARGUMENTS` as the topic. If it's empty or thin, ask the user
what they want to accomplish. Otherwise summarize back what you heard in
one sentence and ask the user to confirm or refine before proceeding.

### 2. Interview (conversational, not a form)

You are trying to produce enough context to write PLAN.md. Ask one or
two questions at a time. Cover:

- **Scope**: what's in, what's out, what's explicitly deferred
- **Phases**: how the work naturally breaks into merged chunks. Aim for
  2–5 phases. Each phase should map to one PR.
- **Dependencies**: which phases must merge before others can start
- **Verification**: commands or signals that prove each phase's changes
  are safe (lint, build, tests, manual checks)
- **PR cadence**: one PR per phase (default), or batches within a phase?
- **Loop strategy**: which loop does this project want by
  default — confidence (tiered-transform, good for bulk transforms and
  audits) or interactive (human-paired, good for exploratory or
  creative work)?
- **Risks** worth naming up front
- **Rules** to apply throughout (rule files, style guides, conventions)

Don't pad. If the user answers tersely, the plan should be terse.

### 3. Propose the slug

Generate a kebab-case slug from the topic. If `$ARGUMENTS` was a long
phrase, derive the slug from the 2–4 most salient nouns — not the whole
string. Before confirming with the user, run `ls projects/` and check
for existing directories ending in `-<slug>`; if any match, surface them
(they may be the same project, a branched variant, or a name collision)
and ask the user how to proceed. The full directory name will be
`<YYYY-MM-DD>-<slug>` where the date is today. Get today's date via
`date '+%Y-%m-%d'`.

### 4. Draft PLAN.md

Synthesize the interview into a PLAN.md. Structure:

```markdown
# <Human title>

## Context
<what we know, why this project exists>

## Scope
<in / out / deferred>

## Phases

### Phase 1: <name>
<what this phase accomplishes; what PR it produces; verification>

### Phase 2: <name>
<...>

## Dependencies
- <phase ordering constraints>

## Verification
- <commands>

## Risks
- <named up-front>

## Open questions
- <unresolved; flagged for later>
```

Show it to the user for review. Iterate until they approve. Don't
proceed to scaffolding until they say go.

### 5. Collect config.md values

Ask for, in one batch:
- Base branch (default: `main`)
- Reviewers (optional)
- Labels (optional)
- Verification commands (default from PLAN)
- Preferred loop (confidence or interactive)

### 6. Scaffold

1. Get today's date via `date '+%Y-%m-%d'`. Directory name is
   `<date>-<slug>`.
2. Author three temp files:
   - `/tmp/plan-scaffold-plan-<slug>.md` — approved PLAN.md from Step 4.
   - `/tmp/plan-scaffold-config-<slug>.md` — config.md from Step 5
     (Verification, PR settings, Worker bindings).
   - `/tmp/plan-scaffold-manifest-<slug>.json` —
     `{title, started, strategy, phases:[{name, dependencies?}]}`.
     `strategy` is a one-paragraph distillation of PLAN.md Context+Scope.
3. `Bash("node .claude/scripts/trout/plan-scaffold.ts <date>-<slug>
   --plan-file=<plan-tmp> --config-file=<config-tmp>
   --manifest-init-file=<manifest-tmp>")`. The script creates
   `projects/<date>-<slug>/` + subdirs, writes all three artifacts, and
   seeds the `project-initialized` manifest event. Stdout returns the
   relative path for Step 7.

### 7. Report

Tell the user what was created, where it lives, and what to run next in
this shape:

```
Created project: <title>
Location: ./projects/<date>-<slug>/
Files: PLAN.md, config.md, MANIFEST.md, sessions/, checkins/
Loop: <confidence|interactive>
Next: /ev-run <slug>
```

## Rules

- **Do not start execution.** `/trout-plan` stops at scaffold. Actual
  work happens in a loop, invoked separately.
- **Do not guess the loop strategy.** Ask.
- **Do not write files until the plan is approved.** The interview can
  be long; the write should be a single committed act once the user is
  happy.
- **Slug uniqueness.** If `./projects/<date>-<slug>/` already exists,
  append `-2`, `-3`, etc. Do not overwrite.
- **No emojis.**

## Failure modes

- The topic is too small for a project (one PR, no phases) → suggest the
  user just do the work directly and skip the substrate.
- The topic is already an active project → `ls ./projects/` shows
  matching directories; surface that and ask whether they want to
  resume, branch, or create a new one with a different slug.
