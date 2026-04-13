---
name: create-plan
description: Turn loose thoughts and goals into structured, actionable plans
user_invocable: true
---

# Create Plan

Turn basic thoughts into detailed plans. The input is fuzzy — a goal, a
frustration, a half-formed idea. The output is a concrete plan with phases,
tasks, and decision points.

## Process

### 1. Listen and explore

Start from whatever the user gives you — it might be a sentence, a
paragraph, or a rambling train of thought. Don't rush to structure it.
Ask questions to understand:

- What's the desired end state?
- What's the motivation? (Why now? What's broken? What's the opportunity?)
- What are the constraints? (Time, risk tolerance, dependencies)
- What's already been tried or considered?

### 2. Survey the territory

Before planning, understand what exists:
- Read the relevant code and configuration
- Check for prior art — has something similar been done before?
- Identify the moving parts — what files, systems, and dependencies
  are involved?

### 3. Structure the plan

Write the plan as markdown, following the project's three-phase pattern
where it applies (setup/gate → bulk migration → cleanup). Include:

- **Context**: why this work is happening
- **Phases**: ordered groups of tasks, each with a clear boundary
- **Tasks**: specific, actionable items within each phase
- **Decision points**: places where the plan might fork based on
  what we learn
- **Verification**: how to know each phase is complete
- **Risks**: what could go wrong and how to mitigate it

### 4. Right-size the plan

Not everything needs three phases. A small task might be one phase with
three steps. A large migration might be twelve PRs across three phases.
Match the plan's weight to the work's weight.

**If the work takes < 30 minutes**: a few bullet points is fine.
**If the work takes hours**: phases with tasks and verification.
**If the work takes days**: full plan document with subplans.

## Output

Plans live in `projects/[project-name]/PLAN.md` for significant work.
Small plans can just be a message in the conversation.

## When invoked from project-loop

The orchestrator provides the goal. Create the plan, present it for
approval, then hand back to the loop to begin execution.
