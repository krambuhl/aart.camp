---
name: learnings-capture
description: >-
  Capture a correction as a candidate learning. Use ONLY when explicitly
  invoked via /learnings-capture. Fast, synchronous, writes files only — no
  LLM panel at capture time. Gate: "did something happen here a reasonable
  Claude would have gotten wrong by default?"
user-invocable: true
disable-model-invocation: true
allowed-tools: Bash, Read, Write
---

# Learnings Capture

Write a new `session-notes/<ts>-<slug>/` folder with the five input files the
judge panel will later need. This skill is **synchronous and fast**. It does
not call any LLMs. It does not write `rubric.md` — that's the rubric-author
agent's job during `/learnings-compact`.

## When this runs

The user invokes `/learnings-capture` explicitly after Claude got something
wrong and they corrected it. Never auto-invoke.

## Gate — apply this first

Before writing anything, decide: **would a reasonable Claude have gotten this
wrong by default?**

Capture if:
- The mistake reflects a non-obvious project convention (e.g., "we migrated
  off `SpacerWithCss` to `Stack` — Claude used the old one").
- The mistake reflects a subtle invariant a reasonable reader would miss.
- The correction contradicts something Claude would say by default.

**Do not capture** if:
- It's a typo or a local state issue Claude couldn't have known.
- It's an established, well-documented pattern Claude already follows
  elsewhere in the session.
- It's a preference the user never stated before and couldn't be inferred.

If in doubt, ask the user: "This looks like X. Should I capture it, or is it
one-off?" If they say skip, stop — don't write files.

Signal-over-volume. A shallow capture pollutes the corpus.

## What to write

Create the folder:

```bash
ts=$(date -u +"%Y-%m-%dT%H-%M-%S")
slug="spacerwithcss-migration"   # fill in: 3-5 word kebab-case summary
mkdir -p "learnings/session-notes/${ts}-${slug}"
```

- `<ts>` — UTC ISO-ish with colons replaced by dashes, e.g.,
  `2026-04-23T14-32-01`.
- `<slug>` — 3-5 word kebab-case summary of the correction. Not the lesson
  title; the situation. Examples: `spacerwithcss-migration`,
  `stack-over-manual-flex`, `tokens-not-hex-codes`.

Write exactly five files in that folder:

### `prompt.md`

The triggering user turn, **distilled for replay**. This is the single
Claude-facing prompt a future judge panel will use to reproduce the failure.

- Include enough context for a blind Claude to produce the same wrong answer.
- Strip irrelevant chatter and scrollback.
- If the real prompt depended on tool output or file contents, inline the
  essential bits as code blocks or quotes.
- Aim for 50-300 words. Longer only if the task genuinely requires it.

### `wrong.md`

What Claude said or did. Be faithful — don't paraphrase the failure mode.
If Claude wrote code, include the code. If Claude gave a suggestion, include
the suggestion verbatim.

### `correction.md`

The user's correction, verbatim or near-verbatim. This is the ground truth.
If the correction came across multiple turns, concatenate the relevant
corrective bits.

### `full_transcript.md`

The full session chunk from the triggering turn through the correction.
Debugging aid only — nothing reads this automatically. Include turn markers.

### `learning.md`

A draft of the lesson. One or two paragraphs. Concrete, actionable. Name the
forbidden thing and the preferred thing. Do not explain the surrounding
architecture — a good learning is narrow.

Good shape:

> Use `Stack` with a `spacing` prop for vertical layout — do not use
> `SpacerWithCss`. The codebase migrated off `SpacerWithCss` in Q4 2025 and
> new instances should not be introduced. `Stack` is imported from
> `@patreon/studio-ui`.

Bad shape (too general):

> Follow the project's layout conventions.

Bad shape (narrates the correction):

> The user pointed out that I used SpacerWithCss when I should have used Stack.

This draft is rewritable. The rewriter agent will likely propose a better
version during compaction if the judges don't accept this one.

## Do not write

- `rubric.md` — the rubric-author agent writes this during `/learnings-compact`
  with fresh context. Do not pre-write it, and do not suggest assertions.
- Any file outside the new folder.

## After writing

Tell the user:

```
Captured to learnings/session-notes/<folder>/.

Run /learnings-compact when you want to process pending captures.
```

Then stop. Do not continue to other work unless asked.

**Done when:** the five files exist in the new folder and the user has been
told where. Do not also write `rubric.md`.

## Notes

- If `/learnings-capture` is invoked when there's nothing to capture (user
  made a mistake, no clear correction), say so and stop. Don't invent.
- Paths are relative to the repo root. Use `git rev-parse --show-toplevel`
  if the cwd is ambiguous.
