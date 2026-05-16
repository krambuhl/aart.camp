---
name: ev-run
description: >-
  Thin router over a project. Loads the manifest, picks the next
  actionable phase (or routes a message like "address feedback on #14"),
  and dispatches to the appropriate loop. Does no work itself —
  the loops own execution and the substrate owns state. Use when the
  user wants to make progress on a project without picking the phase
  by hand.
argument-hint: "<project-slug-or-path> [<free-form message>]"
user-invocable: true
disable-model-invocation: true
allowed-tools: Read, Skill
---

# /ev-run

Router. Reads state via `bin/loom`, decides what to run next, invokes
the right loop. Owns no work of its own.

## Arguments

- `<project-slug-or-path>` — resolved by loom's standard slug resolution
  (full slug → date-less suffix → relative or absolute path).
- Optional free-form message — if present, interpret it as a redirect
  (e.g. "address feedback on #14", "pause and save session", "start
  phase 3 even though phase 2 isn't merged yet").

Invocations of `/ev-loop-*` and `/loom-archive` and `/draft-plan` skills
below mean `Skill(skill: <name>, args: "…")` — the Skill tool is how
the router dispatches. CLI invocations like `bin/loom project read`
mean `Bash("bin/loom project read <args>")`.

## Process

### 0. Parse arguments

Treat the first whitespace-delimited token of `$ARGUMENTS` as the
project slug/path. Everything after it (if any) is the free-form
message. If `$ARGUMENTS` is empty, stop and ask for a slug.

### 0.5. Sync git state

Refresh git state before orientation so the autoload briefing reflects
what's actually merged on the remote — not a stale local snapshot.
This is the single point in the substrate where the working tree gets
synced; downstream loops trust the result.

1. `git fetch origin` — always; never modifies the working tree.
2. If currently on the base branch (typically `main`):
   `git pull --ff-only origin <base>`. If non-fast-forward (local has
   commits not on origin), stop and surface the error rather than
   auto-resolving — local main with unexpected commits is suspicious.
3. If currently on a feature branch: do not auto-rebase or auto-checkout.
   If `origin/<base>` has new commits ahead of local `<base>`, note the
   gap in the dispatch report so the user knows the next branch-cut
   should pull first.
4. `git status --porcelain` for tracked-modified files. Filter out
   `.claude/settings.local.json` (permitted user-local carry-over).
5. If any tracked-modified files remain, they are loose changes from a
   prior session that should have shipped with their original PR.
   Surface them as a one-line summary AND stop. Ask the user to choose:
   - **discard**: `git checkout -- <files>` and proceed.
   - **commit**: pause for the user to commit (then re-invoke the router).
   - **continue anyway**: proceed without resetting (escape hatch for
     intentional WIP).
   Never auto-discard — destructive actions require explicit consent.

Untracked files (`??` in `git status --porcelain`) are not surfaced —
they may be intentional WIP, substrate config, or scratch the user is
working with.

### 1. Orient

Refresh state via the loom CLI:

```
bin/loom project read <slug> --pretty
bin/loom events read <slug> --limit=20 --pretty
bin/loom session list <slug> --pretty   # for the last session's open_threads
```

Take in the manifest, recent events, and the latest session handoff.
This tells you:
- Current phase status (from `phases[].status`)
- Latest checkin (from manifest's `latest_checkin`)
- Open PRs (from `pr-opened` / `pr-updated` / `pr-merged` events; the
  latest event for each phase's branch is authoritative)
- Suggested next action (inferable from phase statuses)
- Open threads from the last session handoff (read it via
  `bin/loom session read <slug> --filename=<latest>`)

**PR-merged reconciliation**: if a PR was merged between sessions but
no `pr-merged` event has been recorded, the router should append one
via the upstream loop's checkpoint flow rather than auto-emit. (Loom
emits `pr-merged` only from explicit reconciliation, not a CLI verb
today — see the open question in projects/2026-05-15-trout-sunset/PLAN.md
about whether `bin/loom pr reconcile` should ship.) For now, surface
suspected drift as a one-line warning and let the user decide.

### 1.5. Load learnings

Run `Bash("bin/griot use --as=llm")`. The verb reads
`learnings/rollup.json` and renders it as LLM-friendly prose, prints
the status line and (if loaded) the content + citation contract to
stdout — the Bash result lands the load in conversation context. Do
this once per `/ev-run` invocation — the rollup is session-scoped,
not per-dispatch. The `--as=llm` flag is the default render mode and
is currently the only mode shipped; `/ev-run` calls the CLI directly
via Bash rather than composing the `/griot-load` skill, to keep the
loader-step path skill-composition-free.

Handle the three outcomes the verb's `griot-use:` status line reports:
- **`loaded N learnings`** — note it in the dispatch report.
- **`rollup empty`** — note "no rollup entries" in the dispatch report
  and proceed.
- **`no rollup yet`** — note "no rollup yet — `/griot-compact` has
  not run" and proceed. Do not stop.

A format-detection error from the verb (exit 1, stderr names
`learnings/rollup.md` as a legacy artifact requiring migration)
indicates a mid-flight session running an older skill body against
post-cutover on-disk state, or vice-versa. Surface the verb's stderr
message to the user verbatim and stop — the remedy is in the message
(run `node .claude/scripts/migrate-rollup-md-to-json.ts` and restart).

Do not read `learnings/session-notes/` or `learnings/nightly/` from the
router — the tier separation is a hard rule of the learnings system,
and the substrate must respect it.

### 2. Handle explicit redirects

If the user provided a message, parse its intent:

| Intent | Action |
|--------|--------|
| "address feedback on #N" | Verify #N belongs to this project. Dispatch to the loop that owns the branch, passing the redirect message. The loop's § Triage PR comments handles the rest. |
| "save session" / "wrap up" | Compose and write a session handoff per the ev-loop's § Save session recipe (`bin/loom session corrections` + `bin/loom events read` → compose Session JSON → `bin/loom session write`), then stop. |
| "archive" / "close out" | Verify all phases are complete (every `phases[].status == "completed"`). Invoke `/loom-archive <slug>`. |
| "skip to phase N" | Warn if dependencies aren't satisfied. Confirm with the user. If confirmed, dispatch to the loop for phase N. |
| "pause" | Stop and report. Do not dispatch. |
| ambiguous | Ask the user one clarifying question; do not guess. |

### 3. Pick the next actionable phase

With no message, pick the phase using this policy:

1. If any phase is `in-progress`, that's the next phase.
2. Otherwise, pick the lowest-numbered `not-started` phase whose
   dependencies are all satisfied (all named prior PRs merged).
3. If no phase qualifies, surface the blocker: "waiting on PR #X to
   merge" or "all phases completed — run `/loom-archive`."

### 4. Dispatch

Determine which loop to invoke:
- Per-phase override in PLAN.md wins.
- Otherwise, use the preferred loop from `config.json`
  (`worker_bindings` field, e.g. `{"default": "ev-loop-interactive"}`).
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
- `Loaded N learnings from rollup.json (citation contract active).`
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

- Project not found → forward the loom error; suggest `/draft-plan`
  to scaffold a new one.
- Manifest inconsistent with git state → stop, report the drift, let
  the user resolve.
- No actionable phase and not all phases done → list open blockers and
  stop.
- All phases done → recommend `/loom-archive` and stop.
