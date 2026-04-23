---
name: ev-run
description: >-
  Thin router over a project. Loads the manifest, picks the next
  actionable phase (or routes a message like "address feedback on #14"),
  and dispatches to the appropriate branded loop. Does no work itself —
  the loops own execution and the substrate owns state. Use when the
  user wants to make progress on a project without picking the phase
  by hand.
argument-hint: "<project-slug-or-path> [<free-form message>]"
disable-model-invocation: true
allowed-tools: Read, Bash(git:*), Bash(ls:*), Skill
---

# /ev-run

Router. Reads state via `/project-autoload`, decides what to run next,
invokes the right loop. Owns no work of its own.

## Arguments

- `<project-slug-or-path>` — resolved like `/project-autosave`.
- Optional free-form message — if present, interpret it as a redirect
  (e.g. "address feedback on #14", "pause and save session", "start
  phase 3 even though phase 2 isn't merged yet").

Invocations of `/project-*` skills and `/ev-loop-*` skills below mean
`Skill(skill: <name>, args: "…")` — the Skill tool is how the router
dispatches.

## Process

### 0. Parse arguments

Treat the first whitespace-delimited token of `$ARGUMENTS` as the
project slug/path. Everything after it (if any) is the free-form
message. If `$ARGUMENTS` is empty, stop and ask for a slug.

### 1. Orient

Invoke `/project-autoload <slug>`. Take in the briefing. This tells you:
- Current phase status
- Latest checkin
- Open PRs and their freshness
- Suggested next action
- Open threads from the last session handoff

### 1.5. Load learnings

Invoke `/learnings-use` via the Skill tool (no arguments). This reads
`learnings/rollup.md` and installs the session-long citation contract
(the session appends `Applied: L-NNN` when a learning actually shaped a
response). Do this once per `/ev-run` invocation — the rollup is
session-scoped, not per-dispatch.

Handle the three outcomes the skill can return:
- **Loaded N learnings** — note it in the dispatch report.
- **Rollup empty** — note "no rollup entries" in the dispatch report
  and proceed.
- **Rollup missing** — note "no rollup yet — `/learnings-compact` has
  not run" and proceed. Do not stop.

Do not read `learnings/session-notes/` or `learnings/nightly/` from the
router — the tier separation is a hard rule of the learnings system,
and the substrate must respect it.

### 2. Handle explicit redirects

If the user provided a message, parse its intent:

| Intent | Action |
|--------|--------|
| "address feedback on #N" | Verify #N belongs to this project. Dispatch to the loop that owns the branch, passing the redirect message. |
| "save session" / "wrap up" | Invoke `/project-save-session <slug>` and stop. |
| "archive" / "close out" | Verify all phases are complete. Invoke `/project-archive <slug>`. |
| "skip to phase N" | Warn if dependencies aren't satisfied. Confirm with the user. If confirmed, dispatch to the loop for phase N. |
| "pause" | Stop and report. Do not dispatch. |
| ambiguous | Ask the user one clarifying question; do not guess. |

### 3. Pick the next actionable phase

With no message, pick the phase using this policy:

1. If any phase is `in-progress`, that's the next phase.
2. Otherwise, pick the lowest-numbered `not-started` phase whose
   dependencies are all satisfied (all named prior PRs merged).
3. If no phase qualifies, surface the blocker: "waiting on PR #X to
   merge" or "all phases completed — run `/project-archive`."

### 4. Dispatch

Determine which loop to invoke:
- Per-phase override in PLAN.md wins.
- Otherwise, use the preferred loop from `config.md` (`## Worker
  bindings`).
- Otherwise, default to `/ev-loop-confidence`.

Invoke the loop with `<slug> <phase-number>` and, if a redirect message
is in play, pass it through.

Do **not** pass control back and forth. Once dispatched, the loop owns
the session until it returns or yields. If the user wants a different
loop mid-phase, they stop the current one explicitly.

### 5. Report briefly before dispatching

One paragraph in this shape:

```
Dispatching <slug> → phase <N> "<phase-title>" via <loop-name>.
<Dependency-check sentence.> <Learnings-loaded sentence.>
<Caveats or "No caveats.">
```

The learnings-loaded sentence is one of:
- `Loaded N learnings from rollup.md (citation contract active).`
- `No rollup yet — proceeding without citation contract.`
- `Rollup empty — proceeding without citation contract.`

Then dispatch. Don't ask for permission unless a redirect or drift
warrants it. Example dispatch:

```
Skill: ev-loop-confidence
args: "<slug> <phase-number> [<redirect-message>]"
```

## Rules

- **Thin.** The router reads state and dispatches. No code changes, no
  file writes, no evaluator calls.
- **No cross-loop composition.** If a phase needs both loops, split it
  into two phases in PLAN.md.
- **Respect manifest state.** If the manifest says a phase is blocked,
  do not dispatch to it. Surface the blocker and stop.
- **No emojis.**

## Failure modes

- Project not found → forward the autoload error; suggest
  `/project-plan`.
- Manifest inconsistent with git state → stop, report the drift, let
  the user resolve.
- No actionable phase and not all phases done → list open blockers and
  stop.
- All phases done → recommend `/project-archive` and stop.
