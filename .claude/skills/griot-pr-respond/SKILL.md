---
name: griot-pr-respond
description: >-
  Fetch PR comments and reviews, classify them, and produce a response plan
  that the originating loop can execute. Does not write code or reply on
  GitHub. Use when the user wants to address feedback on an open project
  PR.
argument-hint: "<project-slug-or-path> <pr-number>"
disable-model-invocation: true
allowed-tools: Read, Write, Glob, Bash(ls:*), Bash(git branch:*), mcp__github__pull_request_read, mcp__github__list_pull_requests
---

# /griot-pr-respond

Turn a pile of PR feedback into a structured response plan. Does not
modify code or reply; its output is consumed by the originating loop.

## Arguments

- `<project-slug-or-path>` — resolved like `/griot-autosave`.
- `<pr-number>` — the PR to respond to. Must belong to the project
  (cross-check via branch → `checkins/<branch>` existence).

## Process

### 1. Fetch

- Resolve the project directory from `$1`:
  - If `$1` is a path, use it directly.
  - Otherwise treat as a slug under `projects/<slug>/`.
  - Confirm `projects/<slug>/checkins/` exists; if not, stop and report.
- Fetch PR metadata for `$2` via `mcp__github__pull_request_read`
  (with method variants for `getComments`, `getReviews`,
  `getReviewComments` as needed):
  - Issue comments on the PR conversation
  - Review summaries (approved, changes requested, comment-only)
  - Inline review comments on code
  - CI check status (if available)
- Record the PR's branch name. Verify
  `projects/<slug>/checkins/<branch>/` exists — if not, the PR belongs
  to a different project; stop and report.

### 2. Classify each item

Use this taxonomy:

| Class | Meaning | Response style |
|-------|---------|----------------|
| **Blocker** | Reviewer says "change X before merge" or CI is red | Fix in new checkin; do not merge |
| **Suggestion** | Reviewer offers an alternative or improvement | Evaluate; adopt, counter, or decline with reason |
| **Question** | Reviewer is asking for clarification | Reply; no code change unless the answer implies one |
| **Nit** | Style or micro-polish | Apply if trivial; otherwise batch and decline politely |
| **Praise / ack** | Positive, informational | No action |
| **Off-topic** | Not about this PR's scope | Park for follow-up project or defer |
| **CI failure** | A required check is failing | Treat as Blocker; one item per failing check |

When the same issue is raised by multiple reviewers, collapse to one row
and note the multiplicity.

### 3. Produce the response plan

Write the plan to
`projects/<slug>/checkins/<branch>/response-<NN>.md` where `NN` is
two-digit zero-padded, computed as
`max(existing NN in checkins/<branch>/) + 1` considering both `<NN>.md`
and `response-<NN>.md` files. This is a **plan**, not a checkin — when
the loop executes the plan and finishes a unit of work, it writes a
fresh checkin at the same `<NN>.md` with the usual contract. The paired
`response-<NN>.md` and later `<NN>.md` intentionally share the number.

Structure:

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

End the plan with a "Recommended next unit" line: the single most
important work item the loop should take up next.

### 4. Route

Do not execute the plan. Do not post replies. Report the plan path and
the recommended next unit to the caller. The router (`/ev-run`) or the
originating loop is responsible for picking it up.

## Quality bar

- Classify **every** item. Never leave comments uncategorized.
- If a reviewer's point is ambiguous, mark it a Question and draft a
  clarifying reply — do not guess.
- Keep the plan short enough to scan in 30 seconds. Defer deep
  engineering analysis to the checkin that follows execution.

## Failure modes

- PR not found or belongs to a different project → stop and report.
- Zero feedback on the PR → produce a trivially short plan noting that,
  and recommend no action.
- CI is red with no human comments → create a Blocker item for each
  failing check.
- MCP fetch error or partial result → stop, report which endpoints
  failed, do not write a partial plan.
