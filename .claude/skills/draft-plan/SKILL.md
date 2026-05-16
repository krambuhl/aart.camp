---
name: draft-plan
description: >-
  Interview the user relentlessly about a plan or design — one decision
  at a time, recommendation each time, walking down every branch of the
  tree — then synthesize PLAN.md and INTERVIEW.md and commit them via
  `bin/draft plan` (which also auto-adopts the loom substrate so the
  project is loom + draft from minute zero). Use when the user wants to
  grill-me into a plan; for lighter "I know what I want" scaffolding,
  just answer the questions tersely.
argument-hint: "<topic or short description>"
user-invocable: true
disable-model-invocation: true
allowed-tools: Read, Write, Bash(bin/draft *), Bash(date *), AskUserQuestion
---

# /draft-plan

Birth a draft plan via relentless interview. The skill carries the
grill-me conversation; `bin/draft plan` carries the deterministic file
IO. Two artifacts land per invocation: a polished `PLAN.md` (the canonical
shape — Context / Scope / Phases / Dependencies / Verification / Risks /
Open questions, optionally Decisions) and an `INTERVIEW.md` next door
(the walked decision tree as transcript).

This is the canonical project-birth path. There's no lighter alternative
skill — when you "know what you want," just answer the interview's
questions tersely and the loop closes fast. `bin/draft plan` auto-adopts
the loom substrate by default; pass `--no-loom` if you genuinely want
planning artifacts only (rare).

**Format reference**: `projects/LOOM-CONVENTIONS.md` for PLAN.md
structure and the loom + draft pairing.

## Process

### 1. Frame the interview

Treat `$ARGUMENTS` as the topic. If it's empty or thin, ask the user
what they want to accomplish before grilling. Otherwise summarize back
what you heard in one sentence and ask the user to confirm or refine
before proceeding.

### 2. Grill-me interview (relentless, one decision at a time)

Walk the decision tree branch by branch. For every question:

- Provide a **recommended answer** before asking — opinionated, not
  neutral. The user redirects when they disagree.
- Ask **one** question at a time. Wait for the answer. Resolve that
  branch before moving to the next.
- Use `AskUserQuestion` when the choice is between 2-4 discrete
  options (the structured form sharpens the conversation).
- Use natural-language follow-ups when the branch is open-ended.
- If a question can be answered by exploring the repo, explore the
  repo instead of asking.

Cover, in roughly this order (skip what doesn't apply to the topic):

- **Scope**: what's in, what's out, what's explicitly deferred. Press
  hard on "out" — most plans suffer from unstated assumptions about
  what they're NOT.
- **Phases**: 2-5 phases, each mapping to a single PR (or
  per-deliverable PRs if the project wants that cadence). Each phase
  is one conceptual change.
- **Dependencies**: which phases must merge before others can start.
- **Verification**: commands or signals that prove each phase is safe
  (`npm run lint`, `npm test`, manual smoke, etc.).
- **PR cadence**: one PR per phase, per deliverable, or batched.
- **Loop strategy**: confidence (tiered-transform) or interactive
  (human-paired). Default to interactive unless the work is genuinely
  bulk-transform.
- **Risks**: 3-5 named up front. Each with a one-line mitigation.
- **Decisions**: load-bearing choices baked into the implementation.
  Worth pinning so revisions can preserve them.

Pacing: stop when the user says "approved" or the tree visibly
resolves. If you've been asking for more than ~20 minutes without
nearing the end, propose a checkpoint — show what's resolved so far
and ask if the user wants to defer the rest to open questions.

### 3. Propose the slug

Run `Bash("date '+%Y-%m-%d'")` for today's date. Derive a kebab-case
slug from the topic — 2-4 salient nouns, not the whole phrase.

Show the user the proposed full slug `<YYYY-MM-DD>-<kebab-slug>` and
the resulting project path `projects/<full-slug>/`. Confirm before
proceeding — the user often catches a better slug at this moment.

### 4. Synthesize PLAN.md

Compose PLAN.md from the resolved interview tree. Structure:

```markdown
# <Human title>

## Context
<what we know, why this project exists, who it serves>

## Scope
<in / out / deferred — each as a bullet list>

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
- <named up-front with one-line mitigation each>

## Open questions
- <unresolved; flagged for later>

## Decisions
- <optional; load-bearing choices worth pinning>
```

Use the PLAN.md shape documented in `projects/LOOM-CONVENTIONS.md`.
The shape is stable; the interview style is what this skill specializes
(one decision at a time, recommendation each turn).

### 5. Synthesize INTERVIEW.md

Compose INTERVIEW.md as the walked decision tree. Loose structure:

```markdown
# Interview trail: <topic>

## Frame
<one-paragraph summary of the topic as the user framed it>

## Q1: <question>
- **Recommendation**: <what you recommended>
- **Answer**: <what the user chose>
- **Why**: <one-line rationale if surfaced>

## Q2: <question>
...
```

Skip non-decision exchanges (back-and-forth refinements within a
single question are summarized into Q's final state). INTERVIEW.md
is the historical artifact — it explains _how_ the plan was reached,
not _what_ the plan is.

### 6. Show + approve

Surface the composed PLAN.md content to the user. They read it. They
either approve or redirect. **Do not shell to `bin/draft plan` until
they approve.** The grill-me posture is iterative — expect at least
one round of "let me adjust X" before approval.

### 7. Write temp files + commit via the CLI

Write both files to a temp location:

```
/tmp/draft-plan-<slug>.md       ← composed PLAN.md
/tmp/draft-interview-<slug>.md  ← composed INTERVIEW.md
```

Invoke:

```
Bash("bin/draft plan <slug-or-topic> --plan-file=/tmp/draft-plan-<slug>.md --interview-file=/tmp/draft-interview-<slug>.md")
```

If the user passed a clean topic (and slug derivation matched), use
the original topic as `<slug-or-topic>`. If the user picked a
custom slug at step 3, pass that.

The CLI emits a JSON envelope on success:

```json
{"slug": "<full-slug>", "path": "<absolute-path>", "committed": true}
```

If the CLI errors (`plan-exists-committed`, `missing-args`, etc.),
surface the error verbatim and stop. The user resolves and re-invokes
with the right argument.

### 8. Report

One short paragraph in this shape:

```
Created draft plan: <title>
Location: projects/<date>-<slug>/
Files: PLAN.md, INTERVIEW.md, manifest.json, config.json, events.jsonl, checkins/, sessions/
Next: run /ev-loop-interactive <slug> <phase> to execute a phase, or /ev-loop-confidence for bulk-transform work. Edit manifest.json / config.json first if the auto-synthesized defaults need tuning.
```

## Rules

- **The user is the source of truth.** Recommend opinionated answers
  but record what they choose, not what you wished they'd choose.
- **One question at a time.** Resolve before moving on.
- **No emojis.**
- **Do not write files into `projects/` directly.** All file IO goes
  through `bin/draft plan`. Bypassing the CLI defeats the collision
  check and the git seam.
- **Slug is a draft-cli substrate primitive.** The CLI derives it via
  `createSlug`; the skill confirms with the user. Don't try to write
  your own slug logic — let the CLI handle it; the skill just shows
  the proposed slug.
- **`/draft-plan` (skill) and `bin/draft plan` (CLI) are distinct
  surfaces serving distinct audiences.** Users invoke the skill;
  skills (and other tooling) invoke the CLI. The matched naming is
  intentional, the seam is documented here, the user reading this
  should not need to ask which is which.

## Failure modes

- Topic too small for a plan (one PR, no phases): suggest the user
  just do the work directly. Stop without shelling to the CLI.
- Slug collides with an existing project (the CLI returns
  `plan-exists-committed`): surface the error and stop. Suggest the
  user pick a different slug OR edit `PLAN.md` directly and run
  `bin/draft revise <existing-slug> --revision-file=<path> --rationale=<why>`
  if the intent was to update.
- Interview drags past ~20 questions without resolving: propose a
  checkpoint. Either commit what's resolved (with open questions
  pinned) or defer.
- User goes quiet mid-interview: don't fill the silence. Stop.
