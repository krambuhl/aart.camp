---
name: learnings-compact
description: >-
  Run the nightly learnings validation pipeline. Use ONLY when explicitly
  invoked via /learnings-compact. Expensive — spends real API tokens.
  Processes every session-note in learnings/session-notes/, runs the judge
  panel, promotes IMPROVED learnings, rewrites UNCHANGED/REGRESSED, flags
  DID_NOT_REPRODUCE, regressions tests the full rollup, appends bench
  history, and opens a PR.
user-invocable: true
disable-model-invocation: true
allowed-tools: Bash, Read
---

# Learnings Compact

Kick off the expensive nightly pipeline. This skill is **idempotent** — if
there are no unprocessed session-notes, the orchestrator runs only the
regression suite.

## Prerequisites

- `ANTHROPIC_API_KEY` must be set in the environment.
- `npm install` must have been run (the orchestrator uses `@anthropic-ai/sdk`
  and `js-yaml`).
- `learnings/config.yaml` should have final model IDs — check for `TODO`
  comments on previous-gen entries before the first real run.

## Procedure

### 1. Pre-flight

```bash
if [ ! -d learnings/session-notes ]; then
  echo "no session-notes dir yet — nothing to compact"
else
  echo "unprocessed session-notes:"
  ls learnings/session-notes | grep -v '^archived$' || echo "(none)"
fi
```

If there are none AND the rollup is empty, there's nothing to compact or
regress. Tell the user and stop.

### 2. Run the orchestrator

```bash
npm run learnings:compact
```

The script prints progress per note, runs the regression suite, appends a
bench-history line, and emits the filled-in PR body between
`========== PR BODY ==========` markers on stdout.

### 3. Handle the output

- **If the orchestrator succeeded:**
  - Extract the PR body from the markers.
  - `git add learnings/rollup.md learnings/bench-history.jsonl learnings/regressions.jsonl learnings/operator-log.jsonl learnings/judge-calibration.json learnings/session-notes/archived/` (files are gitignored but the user may be in Phase 3+ and want a local diff view — ignore the `add` errors silently).
  - Show the PR body to the user and ask: "Ready to commit this and open a PR, or want to review first?"
- **If the orchestrator failed:**
  - Surface the error. Common causes: `ANTHROPIC_API_KEY` missing, judge
    model ID not yet confirmed in `config.yaml`, rubric-author refused a
    specific note.
  - Do not retry automatically. Show the user the error and ask how to
    proceed.

### 4. Escalations

For every note whose outcome was `escalated`:
- The orchestrator logged an operator intervention in `operator-log.jsonl`
  with the diagnosed failure pattern.
- A human-review PR body can be generated from
  `learnings/pr-templates/human-review.md` by filling in the evidence from
  `learnings/runs/<learning-id>/`.
- Do NOT batch escalations into the nightly PR. One human-review PR per
  stuck learning.
- In Phase 1, it's fine to just list them in chat and let the user decide
  whether to open PRs. Don't automate human-review PR creation on this
  pass — the operator already did the work of diagnosing; the human just
  needs to decide.

## Do not

- Do not invoke this automatically. The user triggers it.
- Do not edit rubric.md files. They are immutable after rubric-author
  writes them.
- Do not hand-promote a learning to rollup.md. Only `IMPROVED` via the
  judge panel gets in.
- Do not modify `learnings/bench-history.jsonl` — only the orchestrator
  appends to it.
- Do not un-gitignore data files. That's a Phase 3 decision.

## After a successful run

Remind the user: `/learnings-report` gives a one-pager on trend, cost, and
judge calibration. Skim that before the next run if you want to see how
`corrections_per_session` is moving.
