---
name: validate
description: >-
  Verify work is complete, correct, and ready to ship. Use after code
  generation to confirm the build passes, lint is clean, and the diff
  matches what was requested. A pre-commit gate, not general troubleshooting.
user-invocable: true
---

# Validate

Verify that work is actually done — not just "looks done" but done-done.
Validate is the skill that runs after generation, before committing.

## What validation checks

### 1. Does it build?

Run `npm run build`. If it doesn't build, it's not done. This is the
minimum bar — everything else is moot if the build fails.

### 2. Does it lint?

Run `npm run lint`. Biome should pass clean. If there are new warnings
or errors, they need to be addressed or consciously suppressed with a
reason.

### 3. Is it complete?

Check the work against what was asked for:
- Every file that needed changing was changed
- No TODO comments were left behind (unless explicitly deferred)
- No placeholder values or hardcoded test data
- Imports resolve, types are correct, no dead code introduced

### 4. Is it consistent?

Check the work against the project's patterns:
- Naming matches conventions
- File structure matches existing patterns
- New code reads like it belongs here

### 5. Is it minimal?

Check that nothing extra was added:
- No unrelated changes snuck in
- No speculative features or "while I'm here" cleanups
- The diff is only what was asked for

## Process

1. Run build and lint
2. Review the diff (staged changes)
3. Check completeness against the task
4. Check consistency against the codebase
5. Report: pass, or list of issues to address

## Output

Validation either passes (proceed to commit) or returns a list of
specific issues. Each issue should be actionable — not "this could be
better" but "this file is missing X" or "this import is wrong."

## When invoked standalone

`/validate` — Validate the current staged/unstaged changes.

## When invoked from project-loop

The orchestrator calls validate after each generate cycle. If validation
fails, the issues go back to generate for fixing. If it passes, the
work proceeds to the skeptic pass and commit.
