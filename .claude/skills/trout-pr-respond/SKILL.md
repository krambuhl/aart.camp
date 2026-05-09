---
name: trout-pr-respond
description: >-
  Fetch PR comments and reviews, classify them, and produce a response plan
  that the originating loop can execute. Internal — invoked by /ev-loop-*
  skills when feedback arrives on a project PR. Produces a plan; does not
  execute it. Does not write code or reply on GitHub.
argument-hint: "<project-slug-or-path> <pr-number>"
user-invocable: false
allowed-tools: Read, Bash(node .claude/scripts/trout/*)
---

# /trout-pr-respond

Turn a pile of PR feedback into a structured response plan. Does not
modify code or reply; its output is consumed by the originating loop.

The gh CLI plumbing (PR fetch, item normalization, response-NN.md
write) lives in `.claude/scripts/trout/pr-respond-plumbing.ts` —
verbs `fetch` and `write-plan`. This skill orchestrates: invoke
`fetch`, classify per the taxonomy, author the plan, invoke
`write-plan`.

## Arguments

- `<project-slug-or-path>` — resolved like `.claude/scripts/trout/autosave.ts`.
- `<pr-number>` — the PR. Must belong to the project; the script's
  cross-project guard refuses if the PR's branch has no
  `checkins/<branch>/` directory under the resolved project.

## Process

### 1. Fetch

`Bash("node .claude/scripts/trout/pr-respond-plumbing.ts fetch <slug> <pr>")`.
The script emits one JSON document with `pr` (number, url, state,
branch, title), `items[]` (kind ∈ issue-comment | review |
review-comment | ci-failure; source, body, location, url),
`next_response_number`, and `response_path`. Items are emitted in
deterministic order: issue-comments → reviews → review-comments →
ci-failures. Only failure-class CI conclusions (FAILURE / CANCELLED /
TIMED_OUT) appear; SUCCESS and NEUTRAL are filtered out.

### 2. Classify each item

| Class | Meaning | Response style |
|-------|---------|----------------|
| **Blocker** | Reviewer says "change X before merge" or CI is red | Fix in new checkin; do not merge |
| **Suggestion** | Reviewer offers an alternative or improvement | Evaluate; adopt, counter, or decline with reason |
| **Question** | Reviewer is asking for clarification | Reply; no code change unless the answer implies one |
| **Nit** | Style or micro-polish | Apply if trivial; otherwise batch and decline politely |
| **Praise / ack** | Positive, informational | No action |
| **Off-topic** | Not about this PR's scope | Park for follow-up project or defer |
| **CI failure** | A required check is failing | Treat as Blocker; one item per failing check |

When the same issue is raised by multiple reviewers, collapse to one
row and note the multiplicity. `kind: "ci-failure"` items are
auto-Blockers; the LLM still chooses how to address them.

### 3. Author and land the response plan

**3a (LLM).** Author content using the template below. Write to a
temp file at `/tmp/pr-respond-plan-<slug>-<pr>-<timestamp>.md`.

```markdown
# PR #<N> response plan — generated <YYYY-MM-DD HH:MM>

## Items

### Item 1 — <short label>  [Blocker | Suggestion | Question | Nit | Off-topic]
- **Source**: <reviewer handle, comment link if available>
- **Summary**: <1–2 sentences>
- **Proposed action**: <Fix in code | Reply only | Decline with reason | Defer>
- **If code change**: <files, approach>
- **If reply only**: <draft reply, 1–3 sentences>

### Item 2 — …
```

End the plan with a "Recommended next unit" line.

**3b (script).** `Bash("node .claude/scripts/trout/pr-respond-plumbing.ts write-plan <slug> <pr> --content-file=<temp-file>")`.
The script computes the next NN (max across `<NN>.md` and
`response-<NN>.md`; defaults to 01) and writes to
`projects/<slug>/checkins/<branch>/response-<NN>.md`. The
`response-<NN>.md` file is intentionally distinct from the eventual
`<NN>.md` checkin — plan and executed work share the number, separate
files. The loop writes the matching `<NN>.md` after executing.

### 4. Route

Do not execute or post replies. Report the plan path and recommended
next unit to the caller. The router or originating loop picks it up.

## Quality bar

- Classify every item from `items[]`. No entries uncategorized.
- Ambiguous reviewer point → mark Question and draft a clarifying
  reply; do not guess.
- Plan scannable in 30 seconds; deeper analysis goes in the checkin.

## Failure modes

- Project not found, or PR's branch has no matching
  `checkins/<branch>/` directory → script refuses; stop and report.
- PR not found in repo → script surfaces gh's stderr verbatim.
- Zero feedback → trivially short plan recommending no action.
- gh CLI not on PATH → install GitHub CLI and re-invoke.
- `write-plan` fails → temp file is preserved at the path the skill
  authored; user can recover.
