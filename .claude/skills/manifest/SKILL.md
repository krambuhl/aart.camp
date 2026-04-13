---
name: manifest
description: >-
  Scope projects, track progress, and checkpoint work. Use when starting
  a project to establish scope, after each work unit to checkpoint, or
  standalone to check a project's current status. Writes STATUS.md.
user-invocable: true
disable-model-invocation: true
---

# Manifest

Scope and checkpoint projects. Manifest is the skill that knows where a
project stands — what's done, what's next, what's blocked, what changed
since the plan was written.

## Responsibilities

### Scoping

When a project starts, manifest establishes the boundaries:
- What's in scope and what's explicitly out of scope
- What "done" looks like — the acceptance criteria
- The known unknowns — things we'll learn along the way

### Checkpointing

After each meaningful unit of work, manifest captures the state:
- What was just completed
- What's next
- Any scope changes or discoveries
- Whether the plan needs updating

### Progress tracking

Manifest maintains a running status in the project directory:

```
projects/[name]/
├── PLAN.md          # the strategy (create-plan writes this)
├── STATUS.md        # current state (manifest writes this)
└── ...              # subplans, prompts, etc.
```

**STATUS.md format:**
```markdown
# [Project Name] — Status

## Current phase
[Which phase we're in, what's actively happening]

## Completed
- [x] Task description (commit hash or PR link)

## Next
- [ ] Task description

## Discoveries
- [Anything learned that affects the plan]

## Scope changes
- [Anything added or removed from scope, and why]
```

### Knowing when to stop

Manifest is the skill that says "this is done" or "this has grown beyond
the original scope." It's the counterweight to momentum — the thing that
notices when a cleanup task has become a refactor, or when a quick fix
has become a feature.

## When invoked standalone

`/manifest [name]` — Show the current status of the named project.
If no project exists, ask what to scope.

## When invoked from project-loop

The orchestrator calls manifest to:
- Initialize the project scope at the start
- Checkpoint after each generate/validate cycle
- Determine if the project is complete
