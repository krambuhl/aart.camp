---
name: loom-pr-respond
description: >-
  Fetch PR comments via `bin/loom pr comments`, classify each by
  severity (blocker / advisory / question / nit / ignore), draft a
  response per actionable comment, and write them via
  `bin/loom pr respond`. Stops at the local response files —
  posting back to GitHub is the caller's responsibility.
argument-hint: "<project-slug-or-path> <pr-number>"
allowed-tools: Read, Write, Bash(bin/loom *)
---

# /loom-pr-respond

Triage PR comments and draft responses for a loom-managed project.
Output is a set of local response JSON files under
`checkins/<branch>/responses/`. The skill stops there; the user
(or a follow-up loop) is responsible for actually posting via
`gh pr comment` or the GitHub web UI.

The classification step is the LLM-shaped value-add. The CLI
returns comments verbatim from gh; this skill decides which ones
need responses and what to say.

**Format reference**: `projects/LOOM-CONVENTIONS.md`. Pairs with
`bin/loom pr comments` and `bin/loom pr respond`.

## Arguments

- `<project-slug-or-path>` — resolved by loom's standard slug
  resolution.
- `<pr-number>` — the GitHub PR number.

## Process

### 1. Fetch

```
Bash("bin/loom pr comments <slug> --pr=<N>")
```

Returns `{pr, branch, comments: [{id, author, body, createdAt}, ...]}`.
The `branch` field is critical — it tells the respond verb where
to write response files.

### 2. Classify

For each comment, assign one of:

- **blocker**: must address before merge. Code-correctness issue,
  contract violation, security flag, broken acceptance criterion.
- **advisory**: should address but doesn't block. Style, naming,
  pattern-suggestion, refactor opportunity.
- **question**: requesting clarification or info. Response is an
  answer, not a fix.
- **nit**: trivial preference. Acknowledge and optionally fix.
- **ignore**: off-topic, already-addressed-elsewhere, auto-bot
  spam.

The classification informs the response shape but doesn't get
written to disk per-comment — the response itself is what's
written.

### 3. Draft responses

For each actionable comment (blocker / advisory / question / nit),
draft a one-paragraph response. Tone matches the substrate's
voice (terse, direct, no fluff). Patterns:

- **blocker**: "Acknowledged. Will fix in <next unit>." Or, if
  the reviewer is mistaken, explain why concisely.
- **advisory**: "Good call, will fold in." Or "Tradeoff is X;
  keeping it as-is."
- **question**: Direct answer with a checkin or file reference if
  applicable.
- **nit**: "Got it." Or fix and confirm.

Skip drafts for **ignore** comments.

### 4. Compose responses-file

Build a single JSON file at
`/tmp/loom-pr-responses-<slug>-pr<N>.json`:

```json
{
  "pr": <number>,
  "branch": "<branch from comments fetch>",
  "responses": [
    { "comment_id": <id>, "body": "<your draft>" },
    ...
  ]
}
```

Include only comments you drafted a response for (skip ignore).

### 5. Write the response files

```
Bash("bin/loom pr respond <slug> --responses-file=<path>")
```

Returns `{paths: [...]}` listing the per-response files under
`checkins/<branch>/responses/`.

### 6. Report

Brief summary:
- Number of comments fetched.
- Breakdown by classification.
- Paths of written response files.
- Suggested next step: post responses via `gh pr comment <N>
  --body-file=<path>` for each, or surface in the PR UI directly.

## Rules

- **Classify every comment.** Even `ignore` is an explicit
  decision — don't silently skip.
- **Responses are one paragraph.** Longer means you should
  probably author a new checkin instead.
- **Compose `bin/loom`.** No `gh` invocations from this skill —
  comments go through `pr comments`, posting (if any) is
  user-driven downstream.
- **Don't auto-post.** The skill stops at local writes.
- **Match substrate tone.** Terse, direct, no fluff. Acknowledge
  what's right; defend with evidence what isn't.
- **No emojis.**

## Failure modes

- `pr comments` returns `gh-failed` → forward the error; usually
  auth-related. Stop.
- `pr comments` returns empty comments → stop: nothing to respond
  to.
- A comment is genuinely ambiguous about whether to fix or push
  back → ask the user one clarifying question rather than guess.
- `pr respond` returns `invalid-responses-file` → debug the
  composed JSON before re-running.
