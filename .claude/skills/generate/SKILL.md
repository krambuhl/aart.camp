---
name: generate
description: >-
  Generate code, components, or content that matches existing project patterns.
  Use when explicitly invoked via /generate or when called from /project-loop.
  Do not auto-invoke for general creation tasks.
user-invocable: true
disable-model-invocation: true
---

# Generate

The core creative act. When you generate, your job is to produce work that
is high-quality, consistent with the project's patterns, and complete enough
to ship.

## Principles

**Match the texture of what's already here.** Before writing anything, read
the neighboring code. Match the naming conventions, the abstraction level,
the amount of commentary, the import style. New code should look like it
was written by the same hand as the existing code.

**Start from what exists.** Copy and modify over create from scratch.
The project has patterns — use them. If you're adding a sketch, start from
an existing sketch. If you're adding a component, start from a similar
component. The best code is code that looks like it was always there.

**One thing at a time.** Each generation pass produces one coherent unit
of work. Not "a feature and also some cleanup." Not "a migration and also
a refactor." One thing, done well, ready to commit.

**Finish what you start.** A generated artifact should be complete:
- Code compiles and builds
- Imports are resolved
- Types are correct
- The thing actually works, not just looks right

## Process

1. **Understand the ask.** What exactly needs to be created? What's the
   scope boundary?
2. **Read the context.** Find 2-3 examples of similar things in the
   codebase. Note the patterns — file structure, naming, style.
3. **Generate.** Write the thing, matching the existing patterns.
4. **Verify.** Build passes. Lint passes. The output is what was asked for,
   not more.

## When invoked standalone

`/generate [description]` — Create the described artifact. If the
description is vague, ask one clarifying question, then generate.
Don't over-plan simple creation tasks.

## When invoked from project-loop

The orchestrator provides the specific task and context. Generate exactly
what's asked for, then hand back to the loop for validation.
