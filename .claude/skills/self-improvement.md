---
name: self-improvement
description: Reflect on session signals, generate skills, update rules, and improve the Claude system
user_invocable: true
---

# Self-Improvement

You are the **generator** in a generator/antagonist pair. Your job is to look
at what happened in this session (or a specified past session) and produce
concrete improvements to the Claude system — new skills, updated CLAUDE.md
rules, new memory entries, or workflow changes.

## When this fires

This is **ambient behavior**, not a ceremony. It runs naturally:

- **Before every commit**: check if anything from the work just done is
  worth encoding — a new habit, a corrected assumption, a pattern that
  should be a rule. Most commits will have nothing. That's fine.
- **At the end of a session**: if meaningful work happened, do a fuller
  reflection and propose improvements.
- When the user explicitly invokes `/self-improvement`

The pre-commit pass should be **quick and silent when there's nothing** —
don't force insights where there aren't any. Only surface improvements
that are genuinely worth the user's attention.

## Process

### 1. Gather signals

Look at the current session for:
- **Mistakes**: things you got wrong, had to redo, or took multiple attempts
- **Surprises**: things that turned out differently than expected
- **Friction**: places where you were slow, verbose, or took a roundabout path
- **Wins**: approaches that worked well and should be encoded
- **User corrections**: anything the user redirected or pushed back on
- **Patterns**: recurring decisions that could be automated or codified

### 2. Classify each signal

For each signal, decide what kind of improvement it suggests:
- **Skill**: a reusable workflow that should be a slash command
- **Rule**: a behavioral guideline for CLAUDE.md
- **Memory**: a persistent fact about the user or project
- **Habit**: a check or step to add to an existing workflow
- **Nothing**: the signal was situational and doesn't generalize

### 3. Draft improvements

For each non-trivial improvement:
- Write the actual artifact (skill file, CLAUDE.md addition, memory entry)
- Explain *why* — what signal prompted it and what failure it prevents
- Rate the confidence: high (clear pattern), medium (happened twice), low (one-off but worth encoding)

### 4. Present for review

Show the user:
- A summary of signals found
- The proposed improvements, grouped by type
- Any improvements you're *not* making and why (the antagonist skill
  can evaluate these separately)

**Do not commit improvements automatically.** Present them for the user to
accept, modify, or reject. The user is the final arbiter of what gets
encoded into the system.

## What makes a good improvement

- **Specific over general.** "Check the installed version before writing
  config" is better than "be more careful."
- **Actionable over aspirational.** A new step in a workflow beats a
  vague principle.
- **Tested by experience.** Only encode things that actually happened,
  not hypothetical best practices.
- **Decays gracefully.** If the improvement becomes irrelevant, it should
  be easy to find and remove.

## Anti-patterns

- Don't generate improvements for things the code or tooling already catches
- Don't duplicate what's in the global CLAUDE.md
- Don't create skills for one-off tasks
- Don't add rules that are obvious from context
- Don't be sycophantic about what went well — focus on what's learnable
