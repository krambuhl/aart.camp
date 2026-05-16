---
name: ev-loop-confidence
description: >-
  Execution loop for tiered-transform work. Runs a phase as a
  sequence of tiers, each tier processing a batch of files under a tier
  contract, gated by evaluator verdicts and pre-flight checks. Writes
  tactical retros between tiers. Dispatches to bin/loom and bin/draft
  CLIs directly; composes /guild-validate; composes no other loop. Use
  when a phase is a bulk transform, audit, or find-replace-style
  operation across many files.
argument-hint: "<project-slug-or-path> <phase-number>"
allowed-tools: Read, Write, Edit, Bash, Agent, Skill, mcp__github__get_file_contents
---

# /ev-loop-confidence

Execute one phase of a project as a confidence loop: tiered transforms,
ratcheting from small/safe to large/risky, with an evaluator verdict per
unit and a tactical retro per tier.

**Composes**: `bin/loom` and `bin/draft` CLIs (via Bash) for substrate
operations; `/guild-validate` (via the Skill tool) for the antagonist
panel.
**Does not compose**: other loops. Peer loops are invoked by the router,
not by each other. No ambient `/loom-*` or `/draft-revise` skills —
substrate plumbing dispatches directly to the CLIs (see § Substrate
compositions).

**Format reference**: `projects/LOOM-CONVENTIONS.md` (repo-relative).

Skill invocations like `/guild-validate` below mean
`Skill(skill: <name>, args: "…")`. CLI invocations like
`bin/loom phase update` mean `Bash("bin/loom phase update <args>")`.
Antagonist evaluation runs through `/guild-validate`, which spawns
evaluator agents in parallel via `/guild-spawn`; the loop itself never
calls the `Agent` tool directly.

## Substrate compositions

Every substrate operation this loop performs dispatches directly to
`bin/loom` or `bin/draft` — no ambient skills, no trout scripts. The
unit/tier loop steps below cite these by name (e.g. "checkpoint per
§ Compose PR"). The format reference for every operation is
`projects/LOOM-CONVENTIONS.md`.

### State refresh

At pre-flight or whenever orientation is needed:

```
bin/loom project read <slug> --pretty
bin/loom events read <slug> --limit=20 --pretty
bin/loom project status --pretty   # if cwd is inside the project
```

Use the manifest to confirm phase state (status, branch, latest
checkin). Use the event tail to spot recent activity.

### Phase update

Whenever the phase's state changes:

```
bin/loom phase update <slug> <N> --status=<state> [--branch=<b>] [--pr=<n>]
```

`<state>` is one of `not-started` | `in-progress` | `blocked` |
`completed`. The CLI auto-emits the corresponding phase-* event. Never
append events manually.

### Checkin write

Compose a Checkin JSON object matching the schema in `LOOM-CONVENTIONS.md`
(Contract / Execution / Verdict / Phase / Notes-for-PR substructure).
Write to `/tmp/loom-checkin-<slug>-<branch>-<NN>.json`, then:

```
bin/loom checkin write <slug> --checkin-file=<path>
```

The CLI validates, persists at `checkins/<branch>/<NN>.json`, and
auto-emits `checkin-created`. Checkins are immutable; subsequent
edits require a new numbered file.

### Compose PR

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

### Triage PR comments + draft responses

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

### Save session

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

### Revise PLAN.md

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

### Retro write

When a tier or phase closes, write a structured retro:

```
bin/loom retro write <slug> --type=session|project --retro-file=<path> [--phase=<N>] [--tier=<M>]
```

`--phase` and `--tier` are required for `--type=session` and ignored for
`--type=project` (one project retro per project, written at archive
time). The CLI validates, persists under `retros/`, and auto-emits
`retro-written`. Compose the retro JSON inline (terse fields:
what_went_smoothly, what_bit_us, adjustment_for_next).

## Arguments

- `<project-slug-or-path>` — resolved by loom's standard slug resolution
  (full slug → date-less suffix → relative or absolute path).
- `<phase-number>` — which phase of the project to run. Must exist in
  the manifest and not be in `completed` state.

If `<phase-number>` is missing, already `completed`, or the slug does
not resolve, stop and ask the user rather than guessing.

## Scope directory

This loop creates and uses a scope directory at
`./projects/<slug>/<phase-slug>/` where `<phase-slug>` is a kebab-case
form of the phase name. Inside:

- `inventory.md` — the full list of files in scope, generated in step 1

Create this directory if it doesn't exist. Phase state lives in the
project's `manifest.json` (via § Phase update); tactical retros live
in the project's `retros/` directory (via § Retro write). The scope
directory is now just the inventory home.

## Phase-level process

### Whiteboard

Every phase runs a multi-engineer design pass **once before Step 0**
(pre-flight). The whiteboard output becomes shared reference material
for every tier in the phase (cited in each tier contract's `Inputs:`
line). This step is **always-on**: the loop invokes
`/guild-whiteboard` at phase start regardless of explicit
configuration; an optional PLAN.md block overrides defaults.

**Default behavior** (no `**Whiteboard**:` block in PLAN.md):
- `engineers` = all currently registered `whiteboard-*` agents,
  resolved via glob of `.claude/agents/whiteboard-*.md`.
- `topic` = the phase name.
- `rounds` = 1.

**Override** — optional PLAN.md block, placed immediately under the
phase's prose paragraph:

```
**Whiteboard**: engineers=<comma-separated names>; topic=<one-line topic>; rounds=<N>
```

Any field in the block overrides the corresponding default. Partial
blocks are allowed.

**Whiteboard artifact path**:
`projects/<slug>/whiteboards/<phase-number>-<topic-slug>.md`. Create
the parent directory if it doesn't exist.

**Per-round invocation**: for each round 1..N, invoke
`/guild-whiteboard` via the `Skill` tool with `engineers=<list>`,
`brief=<topic + any phase context>`, `whiteboard=<path>`. The skill
auto-detects round number from existing file state, so re-running is
idempotent (a re-invocation with the same whiteboard file detects
existing rounds and appends a NEW round). For round 2+, the skill
constructs `per_agent_context` from prior round state so engineers
can address contradictions.

**Bootstrapping case (no engineers registered)**: if the
`.claude/agents/whiteboard-*.md` glob returns zero matches AND no
explicit `engineers=` override is given, log a one-line note ("no
whiteboard engineers registered — skipping whiteboard step") and
proceed directly to Step 0.

**L-004 session-boundary**: if any of the resolved `whiteboard-*`
engineers were authored in the current session, drop them from the
effective list manually and surface the override in the next tier's
first checkin Notes for the PR. The runtime registry is loaded once
per Claude Code process start; `/clear` is NOT a session boundary.

### Step 0. Pre-flight

Before any work:
- Refresh state per § State refresh.
- Confirm working tree is clean (`git status --porcelain`). If not,
  stop and ask the user to commit or stash.
- Confirm current branch matches the phase's branch in the manifest. If
  not, stop and ask whether to switch.
- Run the verification commands from `config.json` as a baseline.
  Record exit status. A red baseline before any work means the loop
  stops — you are not making a red build redder.

### Step 1. Coverage before transforms

Build `inventory.md` listing every file or item in scope for this phase.
The phase description in PLAN.md or `config.json` tells you the pattern
(e.g. "all .ts/.tsx files using ESLint disable comments"). Use `git ls-files`,
`grep`, `find`, or equivalent to enumerate. Include counts.

Format:

```markdown
# Scope inventory — Phase <N> <name>

**Generated**: YYYY-MM-DD HH:MM
**Total items**: <count>
**Pattern**: <description of what makes an item in-scope>

## Items
- [ ] path/to/file-1.ts  (tier: <tier>)
- [ ] path/to/file-2.tsx  (tier: <tier>)
```

Tier assignment is a judgment call (see Tier assignment below). Assign
tiers as you build the inventory, or leave them unassigned and prompt
the user.

**Do not begin transforms until the inventory is complete.** Partial
inventory = unknown blast radius.

### Step 2. Tier assignment

Divide inventory items into tiers of increasing risk/complexity:

- **Tier 1** — mechanical, obvious, identical across items
- **Tier 2** — same shape with small variations, low risk
- **Tier 3** — requires judgment, possible side effects
- **Tier 4+** — bespoke, high risk, may need human-paired work

If tier 4+ items appear, consider routing them to `/ev-loop-interactive`
rather than handling here. Surface this to the user and ask.

### Step 3. Execute tiers in order

For each tier, run a **tier loop** (see Tier-level process below).
Between tiers, write a tactical retro and re-run pre-flight.

### Step 4. Phase close

When all tiers in this phase are complete:
- Verify every inventory item is checked off.
- Run full verification.
- Ensure the latest checkin exists.
- Refresh the PR per § Compose PR so it reflects the final state.
- Update the phase per § Phase update with `--status=completed`.
- Return control to the router.

## Tier-level process

Each tier runs as a sequence of **units**. A unit is one batch of
inventory items transformed together — sized so that one checkin covers
it cleanly.

### Batch sizing

- Tier 1: batch of 10–30 items (mechanical, cheap to redo)
- Tier 2: batch of 5–15 items
- Tier 3: batch of 1–5 items
- Tier 4+: batch of 1 item

Size down if verification grows slow or evaluator flags pile up.
Size up if you're burning checkins on trivial changes.

### Tier contract (a specialization of unit contract)

Before the first unit of a tier, write a **tier contract** as the first
checkin of that tier. The Contract section includes tier-wide rules
that every unit in the tier must satisfy:

```markdown
## Contract
- **Goal**: apply <transform> to all Tier <N> items
- **Acceptance criteria**:
  - Every item in this tier is updated
  - `<verification command>` passes after each batch
  - No unrelated files modified
- **Rules applied**:
  - <style/lint rules>
  - Verification: `<command>`
- **Disqualifiers**:
  - Any regression in <area>
  - Any file in scope left untouched
- **Inputs**: inventory.md Tier <N> items
```

Subsequent units inside the tier can reference the tier contract instead
of restating it, as long as the unit's checkin contract says
`Rules applied: tier-<N> contract (see checkin <NN>)` and lists only
unit-specific deltas.

### Unit loop

For each unit inside a tier:

1. **Negotiate.** Compose a Checkin JSON with just the Contract
   substructure populated and write it per § Checkin write. Pick the
   items for this batch from inventory.md (mark them with a tier tag if
   not already). Execution / Verdict / Notes-for-PR substructures stay
   empty for now — they're filled in by a later checkin once the work
   resolves. (Loom checkins are immutable, so the "fill it in later"
   pattern is "write a new numbered checkin," not "edit the existing
   one." The negotiation checkin and the resolution checkin together
   tell the story.)
2. **Execute.** Do the transform on the batch. Keep to scope.
3. **Evaluate.** Invoke `/guild-validate` via the `Skill` tool to run
   the antagonist panel against this unit. Compose the panel by
   auto-derivation from the unit's file list (see § Panel
   auto-derivation below) — the result is contextual to the artifact
   rather than a fixed list. `evaluator-contract-fit` is always
   included as the baseline. The spec (file-type → evaluator mapping,
   precedence list, tokens-vs-naming boundary) lives in
   `.claude/agents/PANEL-COMPOSITION.md`; the derivation logic is
   `.claude/scripts/guild/derive-panel.ts`.
   - `agents`: comma-separated output of
     `node .claude/scripts/guild/derive-panel.ts --files=<paths>`
     (see § Panel auto-derivation for `<paths>` composition).
   - `packet`: build a **dense packet** (see shape below). The substrate
     default is dense — verbose packets correlate with budget-exhaustion
     failures under `evaluator-*`'s `maxTurns=5`. Live examples in
     PR #13's checkins 02-06.

   **Dense packet shape** (three sections, in this order):

   ```
   ## How to evaluate efficiently

   You have a tight tool-use budget (maxTurns=5). Pre-computed
   verification below is authoritative — do not re-run lint/build/
   test/grep unless you find specific evidence the artifact summary
   contradicts itself. Spot-check at most ONE or TWO criteria with
   targeted reads, then emit `VERDICT:`. If you cannot reach a verdict
   within budget, emit `VERDICT: flagged` with `parse-failure:
   budget-exhausted` so the loop escalates rather than no-ops.

   ## Contract (paraphrased)

   <Goal in 1-3 sentences. Acceptance criteria as a numbered list,
   condensed (full text in <checkin path>). Disqualifiers as a
   single-line summary. Inputs as a bulleted list of paths.>

   ## Artifact

   **Files** (in scope for this batch): <bulleted paths>

   **Pre-computed verification (authoritative — do not re-run)**:
   - `npm run lint` → <result>
   - `npm run build` → <result>
   - `npm run test` → <result>
   - <other verification: tier-specific checks, codemod diff samples, etc.>

   **Direct mappings to acceptance criteria** (for spot-check
   efficiency): <AC N → file:line ranges or section pointers>

   **Iteration story** (if applicable): <prior panel runs and what
   was addressed; helps the evaluator avoid re-flagging fixed issues>

   ## Original ask

   <verbatim from PLAN.md phase description or the triggering message>

   ## Suggested spot-check (one tool use)

   <the most efficient single read for confirming the most-suspicious
   criterion; optional but reduces investigation thrashing>
   ```

   Pass the contract as a paraphrased summary plus the checkin file
   path link, not verbatim — the checkin file is in the repo and
   renders one click away. The packet's job is orientation; the depth
   is one click away.

   The skill returns a structured verdict (`approved` | `flagged` |
   `flagged-conflict`) with `blocking_findings`, `advisory_findings`,
   `cli_runs`, and `conflicts` lists. See
   `.claude/agents/evaluator-base.md` for the per-evaluator verdict
   shape that `/guild-validate` parses and aggregates.
4. **Iterate or commit.**
   - If flagged: write a new resolution checkin (per § Checkin write)
     recording the remedy in Execution + Verdict (still flagged from
     the panel's view; the resolution checkin documents what changed).
     Re-invoke `/guild-validate`. Maximum 2 re-iterations per unit —
     on the third flag, stop and escalate to the user.
   - If approved: write a finalization checkin with Execution / Verdict
     `approved` / Notes-for-PR populated. Check off the inventory
     items.
5. **Scope-shift detection (restrictive default).** Runs only on
   approved units (flagged-and-iterating units skip this step). Look
   for signals that PLAN.md is stale; offer a plan revision (per
   § Revise PLAN.md) ONLY on two-signal concurrence.

   **Signal sources**:
   - **Evaluator finding** mentioning a missing or changed phase,
     deliverable, or load-bearing decision (in either blocking or
     advisory findings).
   - **User comment during the unit** that proposed a change to
     plan structure (not just tactical refinement of this unit's
     contract).
   - **Whiteboard contradiction** (round 2+ whiteboard surfaces a
     disagreement between engineers that current PLAN doesn't
     resolve).
   - **Phase boundary** (this unit is the last in its phase OR
     the next phase is about to start).

   **Two-signal-concurrence rule**: offer a plan revision only when 2+
   signal sources fire for the same shift. Single signals get a note
   (see below); the loop does NOT interrupt.

   **Offer flow**: surface a short paragraph naming the two signals
   and a proposed one-line rationale. Use `AskUserQuestion` (or
   natural-language confirm) for accept/decline/defer. Default: decline
   (no interrupt unless the user explicitly accepts).

   **On accept**: integrate the change per § Revise PLAN.md. After the
   revision lands, proceed to step 6 (Phase update). Do not re-execute
   the unit.

   **On single signal** (no concurrence): append the signal to the
   unit's `notes_for_pr` array in the checkin JSON:
   ```
   signal: <signal type>: <one-line description> (single signal; no revise offered)
   ```
   Loop continues normally.

   **On zero signals**: no action. Loop continues.

6. **Phase update.** After a checkin lands, the checkin-created event
   auto-fires from § Checkin write. Then update phase state per
   § Phase update with `--status=in-progress --branch=<branch>` (no
   need to set `--pr` here; the PR reference lives on the phase only
   after § Compose PR runs).
7. **Checkpoint?** Evaluate the should-checkpoint policy (below). If
   any condition holds, refresh the PR per § Compose PR so it tracks
   the latest state. Otherwise continue to the next unit.

### Panel auto-derivation

The `agents` list passed to `/guild-validate` is computed from the
unit's file list at evaluation time, not hardcoded. The composition
rules (file-type → evaluator mapping, precedence ordering, conflict
policy) live in `.claude/agents/PANEL-COMPOSITION.md` and are the
source of truth.

1. **Collect file paths.** Take the unit's changed and created files
   from the tier batch. Practical recipe: `git status --short` minus
   deletions and substrate carryovers, plus any freshly-authored
   untracked paths.
2. **Derive the panel.** Run
   `node .claude/scripts/guild/derive-panel.ts --files=<comma-
   separated paths>`. The script prints a comma-separated list of
   `subagent_type` names on stdout, precedence-ordered, with
   `evaluator-contract-fit` always first.
3. **Pass to `/guild-validate`.** Use the script's stdout as the
   `agents=` argument verbatim. Confidence-loop tiers tend to touch
   a single file family (a codemod over .module.css, a rename over
   .tsx imports, etc.), so the derived panel is typically narrower
   than the interactive loop's — common case is contract-fit plus
   one or two domain lenses.

Edge cases follow the same shape as `/ev-loop-interactive`'s § Panel
auto-derivation:

- Empty file list → contract-fit only.
- Substrate-only files → contract-fit only.
- L-004 session-boundary: if the derive-panel output includes an
  evaluator authored during this session, drop it from `agents=`
  manually and note the override in the checkin's Notes section.

### Specialist-evaluator gate-then-review (Phase 4)

When a tier's panel includes a **specialist evaluator** paired with
a `generator-*` agent (e.g. `evaluator-css-architecture` paired
with `generator-css-codemod`), the specialist runs as part of the
parallel panel with **elevated precedence** per PANEL-COMPOSITION.
No control-flow change is needed.

**Fail-fast on specialist rejection**: when the aggregated tier
verdict shows a specialist's finding in `blocking_findings`, treat
that as a strong fail-fast signal — surface the specialist's
remedy more prominently in the tier retro and consider whether the
tier's overall approach needs reshaping. The loop's verdict-
handling already does the right thing structurally (any blocking
finding → flagged); this section documents the *why* for tier
retros and future per-specialist tier budgets.

### Should-checkpoint policy

Checkpoint (refresh the PR per § Compose PR) when any of the following
hold. All are read off state — there is no callable function.

- A full tier has just finished.
- The number of units since last PR update ≥ 5.
- Verification is currently green and we're about to start a riskier
  tier.
- The user has explicitly asked for a checkpoint.

Do **not** checkpoint mid-tier unless verification is green.

### Tactical retro between tiers

Immediately after the last unit of a tier is approved, before moving to
the next tier:

1. Re-run pre-flight (working tree, verification).
2. Compose the retro JSON (terse fields: `items_processed`, `units`,
   `verification_at_close`, `what_went_smoothly`, `what_bit_us`,
   `adjustment_for_next`) and write per § Retro write with
   `--type=session --phase=<N> --tier=<M>`.

Tactical retros are short and specific. Strategic retrospection happens
at `/loom-archive`, not here.

### Gate-and-ratchet

Before starting tier N+1, the gate closes if:
- Any tier N unit is still flagged.
- Verification is red.
- The tier retro identified a blocker for tier N+1.

A closed gate stops the loop and reports to the user. The user decides
whether to resume, re-tier, or bail.

## Message-driven redirects

If the router passes a message like "address feedback on #14", this
loop:
1. Triage the PR's comments per § Triage PR comments + draft responses
   to get a classified list.
2. Treats each `blocker` comment as a new unit in the current tier (or
   a new tier if the feedback rewrites scope).
3. Iterates the unit loop. When done, refreshes the PR per § Compose PR.

## Rules

- **Coverage before transforms.** Do not start tier 1 without a
  complete inventory.
- **Pre-flight before any tier.** Every tier starts from a known-good
  state.
- **One contract per tier, restated per unit only for deltas.**
- **Evaluator always runs.** No exceptions. Never self-approve.
- **Scope discipline.** Fixes outside this phase's pattern get noted in
  "Notes for the PR" and are deferred — not absorbed silently.
- **Record corrections in the checkin.** If the user redirects a unit
  mid-flight, overrides a decision, or the evaluator flags something
  the generator defaulted to incorrectly, note it verbatim in the
  checkin JSON's `execution.corrections[]` array. The session handoff
  (§ Save session) surfaces unresolved corrections into `open_threads`;
  `griot-capture` (via `node .claude/scripts/griot/capture.ts
  --from-checkin=...`) promotes notable ones into
  `learnings/session-notes/` at session close, and `/griot-compact`
  decides which get promoted further. The loop itself never writes
  to `learnings/`.
- **No emojis.**

## Output to router

On any termination — phase close, closed gate, or escalation — return:

- **Status**: completed | gated | escalated | aborted
- **Phase**: `<N>` `<name>`
- **Tiers run**: list with counts (e.g., `1: 3 files, 2: 7 files`)
- **Last checkin**: `<NN>`
- **Last PR update**: `<url>` or `none`
- **Reason** (if not completed): one-line cause
- **Next action**: what the router or user should do next

## Failure modes

- Pre-flight fails → stop, report, do not proceed.
- Evaluator flags 3× → stop, escalate to user, do not auto-merge or
  force-approve.
- Inventory shrinks mid-phase (items disappear) → stop; something moved
  under you. Regenerate inventory and reconcile.
- Working tree dirty at boundary → stop; do not stash silently.
