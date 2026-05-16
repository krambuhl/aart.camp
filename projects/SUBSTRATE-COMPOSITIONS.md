# Substrate compositions

Recipes for composing the substrate's four CLI families (`bin/loom`,
`bin/draft`, `bin/griot`, `bin/guild`) into named operations cited from
loop bodies and other substrate prose.

## How citations work

Loop bodies cite recipes from this catalog by name — `§ State refresh`,
`§ Compose PR`, etc. The `§` marks the citation as a reference into
this file. A body that opens with a preamble pinning the namespace to
this file may use the bare form (`§ Compose PR`); a body without that
preamble should qualify the citation as
`SUBSTRATE-COMPOSITIONS.md § <Recipe>` so the target is unambiguous on
a mid-document read.

The recipes are deliberately flat — no per-family grouping in the
section namespace. The consumer cites a verb-shaped operation, not a
family's internal API. Today's catalog covers the recipes lifted from
the ev-loop bodies' prior duplicated `## Substrate compositions`
block; griot- and guild-shaped recipes (Load rollup, Capture finding,
Append finding, Derive panel) will be added in subsequent work.

For loom verb shapes, event vocabulary, and JSON schema details, see
`projects/LOOM-CONVENTIONS.md`. This catalog is a layer above that
reference — recipes here compose loom (and the other three families)
into named gestures, but the wire-level contracts live there.

## State refresh

At pre-flight or whenever orientation is needed:

```
bin/loom project read <slug> --pretty
bin/loom events read <slug> --limit=20 --pretty
bin/loom project status --pretty   # if cwd is inside the project
```

Use the manifest to confirm phase state (status, branch, latest
checkin). Use the event tail to spot recent activity.

## Phase update

Whenever the phase's state changes:

```
bin/loom phase update <slug> <N> --status=<state> [--branch=<b>] [--pr=<n>]
```

`<state>` is one of `not-started` | `in-progress` | `blocked` |
`completed`. The CLI auto-emits the corresponding phase-* event. Never
append events manually.

## Checkin write

Compose a Checkin JSON object matching the schema in `LOOM-CONVENTIONS.md`
(Contract / Execution / Verdict / Phase / Notes-for-PR substructure).
Write to `/tmp/loom-checkin-<slug>-<branch>-<NN>.json`, then:

```
bin/loom checkin write <slug> --checkin-file=<path>
```

The CLI validates, persists at `checkins/<branch>/<NN>.json`, and
auto-emits `checkin-created`. Checkins are immutable; subsequent
edits require a new numbered file.

## Compose PR

Author or refresh a GitHub PR for a branch.

1. **Discover state.**

   ```
   bin/loom pr discover <slug> --branch=<branch>
   ```

   Returns `{checkins, marker_state, pr}`. Dispatch on `marker_state`:
   - `fresh` — stop, no-op (PR body matches disk).
   - `drift` — stop, refuse to overwrite (PR body has checkins disk
     doesn't).
   - `new` or `stale` — proceed.

2. **Read the checkin corpus.** For each `NN` in `checkins`:

   ```
   bin/loom checkin read <slug> --branch=<branch> --number=<NN>
   ```

3. **Compose title.** Always prefix with the project's plan-name (the
   date-less slug) — never the phase number. Phase number lives in the
   body's orientation callout instead.
   - Single-checkin: `[<plan-name>] <unit name>` (unit from
     `checkin.unit`). Trim under 70 chars.
   - Multi-checkin sharing one phase: `[<plan-name>] <phase name>`
     (phase from `checkin.phase.name`).
   - Multi-checkin spanning phases: stop and ask the user.

4. **Compose body.** First line is the marker comment
   `<!-- loom-pr-checkins: NN[,NN,...] -->` — discover's staleness
   detection depends on this. Then sections in order:

   - Orientation NOTE (links to `projects/<slug>/PLAN.md`, names phase
     `<N><letter>` of `<total>`).
   - **Motivation** (2-4 sentences distilled from
     `checkin.contract.goal` + PLAN.md `## Context`. Why this work
     matters now, not what it does. If thin, stop and ask.)
   - **Summary** (3-5 one-line bullets distilled from
     `checkin.notes_for_pr` arrays across all checkins).
   - **Reference** (single) or **Units** (multi): for single, Goal +
     checkin link. For multi, a table with one row per checkin.
   - **Verification** (one line per command from
     `checkin.contract.rules_applied` or manifest config; just commands
     and results).
   - **Notes** (3-5 reviewer-relevant items: trade-offs, open questions,
     `correction:` lines from `checkin.execution.corrections[]`).
   - Trailer: `Tracked by project substrate: <manifest path> — checkin{s} <list>`.

   Body caps at 500-600 words total; section caps are hard. Acceptance
   criteria, execution detail, and verdict are NOT pasted — they live in
   the linked checkin file. **No manual line-wrapping in body prose** —
   GitHub renders single newlines as line breaks, so each paragraph is
   one long line, separated by blank lines. Lists, tables, headings,
   and the marker comment follow normal markdown.

5. **Write and dispatch.** Body file at
   `/tmp/loom-pr-body-<branch>-<NN-list>.md`.

   ```
   # new
   bin/loom pr open <slug> --title=<t> --body-file=<path> --branch=<b>

   # stale
   bin/loom pr update <slug> --pr=<N> --body-file=<path>
   ```

   The CLI emits `pr-opened` or `pr-updated`.

## Triage PR comments + draft responses

When PR feedback arrives:

1. **Fetch.**

   ```
   bin/loom pr comments <slug> --pr=<N>
   ```

   Returns `{pr, branch, comments: [{id, author, body, createdAt}, ...]}`.
   The `branch` field is critical — it tells `respond` where to write.

2. **Classify each.**
   - `blocker` — must address before merge (correctness, contract
     violation, security, broken acceptance criterion).
   - `advisory` — should address but doesn't block (style, naming,
     refactor opportunity).
   - `question` — requesting clarification; response is an answer, not
     a fix.
   - `nit` — trivial preference; acknowledge, optionally fix.
   - `ignore` — off-topic, already addressed elsewhere, bot spam.

3. **Draft responses.** One paragraph per actionable comment (blocker /
   advisory / question / nit). Tone matches substrate voice — terse,
   direct, no fluff. Skip drafts for `ignore`.
   - blocker: "Acknowledged. Will fix in <next unit>." Or, if the
     reviewer is mistaken, explain why.
   - advisory: "Good call, will fold in." Or "Tradeoff is X; keeping
     it as-is."
   - question: direct answer with checkin or file reference.
   - nit: "Got it." Or fix and confirm.

4. **Compose responses-file** at
   `/tmp/loom-pr-responses-<slug>-pr<N>.json`:

   ```json
   {
     "pr": <number>,
     "branch": "<branch from comments fetch>",
     "responses": [
       { "comment_id": <id>, "body": "<draft>" }
     ]
   }
   ```

5. **Write.**

   ```
   bin/loom pr respond <slug> --responses-file=<path>
   ```

   Returns `{paths: [...]}` of per-response files under
   `checkins/<branch>/responses/`.

The loop stops at local writes — do not auto-post via `gh`. The user (or
a follow-up loop) posts later via `gh pr comment <N> --body-file=<p>`.
Each blocker becomes a new unit in the loop's next iteration.

## Save session

End-of-session handoff. Composes a structured Session JSON, not prose.

1. **Read state** (parallel):

   ```
   bin/loom events read <slug>
   bin/loom session corrections <slug>
   bin/loom session list <slug>
   bin/loom project read <slug>
   ```

2. **Compose Session JSON** matching the schema:

   ```json
   {
     "schema_version": 1,
     "date": "YYYY-MM-DD",
     "letter": "a",
     "phases_touched": [<numbers>],
     "checkins_written": ["NN", ...],
     "pr_activity": ["#N opened", "#N merged", ...],
     "what_happened": ["...", "..."],
     "open_threads": ["...", "..."],
     "notes": ["...", "..."]
   }
   ```

   - `date` is today's UTC date.
   - `letter` is the next unused for today (`session list` returns
     existing; pick the next; default `a`).
   - `phases_touched` deduplicates phase numbers from events since the
     prior session.
   - `checkins_written` lists every checkin number created this session.
   - `pr_activity` summarizes `pr-opened` / `pr-updated` / `pr-merged`
     events as one-line strings.
   - `what_happened`: 2-6 single-line bullets — story, not paragraphs.
   - `open_threads`: what next session should pick up. Include any
     unresolved entries from `session corrections`.
   - `notes`: substrate observations, friction, deferred decisions.

3. **Write** to `/tmp/loom-session-<slug>-<date>-<letter>.json`, then:

   ```
   bin/loom session write <slug> --session-file=<path>
   ```

   The CLI validates, persists at `sessions/<date>-<letter>.json`, and
   auto-emits `session-saved`. If `session-already-exists` returns,
   another session ran in parallel — pick the next letter and retry
   once.

## Revise PLAN.md

When the loop's scope-shift detection fires (two-signal concurrence,
user-confirmed), integrate the named change into PLAN.md.

1. **Read current PLAN.**

   ```
   bin/draft read <slug>
   ```

   The CLI emits `{path, content, plan: {slug, interview_path}}`.

2. **Compose revised content.** Preserve unrelated sections verbatim;
   touch only what the named scope shift affects (a phase's prose,
   dependencies, decisions, etc.). Do NOT pre-author the Revision log
   entry — the CLI appends it.

3. **Write** to `/tmp/loom-revision-<slug>.md`.

4. **Surface + confirm.** Show a 1-3 sentence summary to the user via
   `AskUserQuestion`. Default: decline. Accept paths only when the user
   explicitly confirms.

5. **Commit on confirm.**

   ```
   bin/draft revise <slug> --revision-file=<path> --rationale=<one-line summary>
   ```

   The CLI replaces PLAN.md, appends a `<YYYY-MM-DD> — <rationale>`
   entry to `## Revision log`, and commits with
   `[draft revise] <slug>: <rationale>`.

If declined, leave the temp file for inspection and report "revision
declined" back to the loop. Don't shell.

## Retro write

When a tier or phase closes, write a structured retro:

```
bin/loom retro write <slug> --type=session|project --retro-file=<path> [--phase=<N>] [--tier=<M>]
```

`--phase` and `--tier` are required for `--type=session` and ignored for
`--type=project` (one project retro per project, written at archive
time). The CLI validates, persists under `retros/`, and auto-emits
`retro-written`. Compose the retro JSON inline (terse fields:
what_went_smoothly, what_bit_us, adjustment_for_next).
