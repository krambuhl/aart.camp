---
name: project-loop
description: >-
  Orchestrate a full project lifecycle — plan, generate, validate, commit,
  learn. Use when the work has multiple steps, needs planning, or benefits
  from structured progress tracking. Only invoke via /project-loop.
user-invocable: true
argument-hint: "<project_name> <goal description>"
---

# Project Loop

`/project-loop [name] [goal]`

The orchestration loop. Takes a project name and a goal, then drives
the full lifecycle: plan → generate → validate → commit → learn, with
skepticism woven throughout.

## The loop

```
┌─────────────────────────────────────────────┐
│                                             │
│  1. PLAN        create-plan + manifest      │
│     ↓                                       │
│  2. GENERATE    generate (one task)         │
│     ↓                                       │
│  3. VALIDATE    validate                    │
│     ↓ (fail → back to generate)             │
│  4. SKEPTIC     natural-skeptic             │
│     ↓ (blocker → back to generate)          │
│  5. COMMIT      commit + self-improvement   │
│     ↓                                       │
│  6. CHECKPOINT  manifest                    │
│     ↓                                       │
│  ├─ more tasks? → back to 2                 │
│  └─ done? → final self-improvement pass     │
│                                             │
└─────────────────────────────────────────────┘
```

## Phase details

### 1. Plan

- If `projects/[name]/PLAN.md` exists, read it and resume
- If not, run **create-plan** to generate one from the goal
- Run **manifest** to establish scope and create STATUS.md
- Present the plan for user approval before proceeding

### 2. Generate

- Pick the next task from the plan
- Run **generate** to produce the work
- One task at a time — don't batch

### 3. Validate

- Run **validate** on the generated work
- If validation fails: fix the issues (back to generate), don't skip
- If validation passes: proceed

### 4. Skeptic

- Run **natural-skeptic** on the changes
- Blockers go back to generate for fixing
- Concerns get noted and presented to the user
- Nits get logged but don't block

### 5. Commit

- Commit the work with a clear message
- Run **self-improvement** — any learnings from this cycle?
- If there are learnings, write them to `.claude/learnings/` and
  include in the commit

### 6. Checkpoint

- Run **manifest** to update STATUS.md
- Mark completed tasks, note discoveries
- Determine if there are more tasks or if the project is done
- If more tasks: loop back to step 2
- If done: final self-improvement pass on the whole project

## Principles

**The user is in the loop.** Present the plan before executing. Pause
at decision points. Don't auto-pilot through a 10-task project without
checking in.

**One commit per task.** Each cycle through the loop produces one
commit. This keeps changes reviewable and revertable.

**Resume gracefully.** If the conversation ends mid-project, the next
session can pick up from STATUS.md and PLAN.md. The project state is
in the repo, not in the conversation.

**Stop when done.** Manifest says when the project is complete. Don't
generate work beyond the scope. If the scope needs to change, that's a
conversation with the user, not an autonomous decision.

## Example

```
User: /project-loop add-dark-mode "add a manual dark mode toggle to the site"

1. PLAN: Creates projects/add-dark-mode/PLAN.md
   - Phase 1: Add toggle component
   - Phase 2: Wire up to CSS custom properties
   - Phase 3: Persist preference

2. GENERATE: Build the toggle component
3. VALIDATE: Build passes, lint clean, component matches patterns
4. SKEPTIC: "Are we sure we need localStorage? The site already
   respects prefers-color-scheme."
5. COMMIT: "Add dark mode toggle component"
6. CHECKPOINT: Phase 1 complete, moving to Phase 2

... (loop continues)
```

## When to use this vs. just working

Use **project-loop** when:
- The work has multiple steps or phases
- You want structured progress tracking
- The goal is fuzzy and needs planning first
- You want the full skeptic/validate/learn cycle

Just work directly when:
- It's a single, clear task
- The user said "just do it"
- The overhead of the loop exceeds the complexity of the work
