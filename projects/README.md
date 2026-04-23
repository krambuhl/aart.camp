# Projects — substrate for multi-PR work

A coordination system for long-running, multi-phase, multi-PR efforts.
Use it when a piece of work is too big for a single PR but too small to
be its own repo. Migrations, audits, big refactors, long-form writing,
research — anything where you need a record of what's planned, what
shipped, what the reviewer said, and what's left.

## The three-layer model

```
/ev-run                    ← branded router (thin)
    ↓
/ev-loop-confidence        ← branded loops (peers, don't compose each other)
/ev-loop-interactive
    ↓
/project-*                 ← universal substrate (state + I/O primitives)
  + evaluator subagent     ← universal infrastructure
```

- **Substrate** (`/project-*`) is universal — it would work equally well
  for migrations or for running a book draft. It owns the manifest, the
  checkins, the PR authoring, the PR-response classifier, and the
  archive ritual.
- **Branded loops** (`/ev-*`) are one opinionated execution strategy.
  You could build other peer loops that compose the same substrate.
- **The router** is thin: it reads state, picks the next actionable
  phase, and dispatches.

Format and layout details live in
[`CONVENTIONS.md`](./CONVENTIONS.md).

## Quickstart

```
# Birth
/project-plan adopt-biome
    → interview → PLAN.md → config.md → scaffold → initial manifest

# Work (every session)
/ev-run adopt-biome
    → autoload state → pick next phase → dispatch a loop
    → loop does: contract → execute → evaluate → checkin → maybe PR

# Session end
/project-save-session adopt-biome
    → narrative handoff in sessions/YYYY-MM-DD-a.md

# Feedback arrived on a PR
/ev-run adopt-biome address feedback on #14
    → classify comments → response plan → loop iterates → PR refreshed

# Death (all phases merged)
/project-archive adopt-biome
    → retrospective interview → dispositions → relocate to archive/
```

## The loop contract

Every unit of work inside a loop passes through four stages:

1. **Negotiate** — write the unit's contract into a new numbered checkin
   before touching any code. (Goal, acceptance criteria, rules applied,
   disqualifiers, inputs.)
2. **Execute** — do the work.
3. **Evaluate** — spawn the isolated `evaluator` subagent with a packet
   of (contract, artifact, original ask). It returns `approved` or
   `flagged` with specific reasons.
4. **Iterate or commit** — address flags (max 2 retries, then escalate),
   or finalize the checkin and call `/project-autosave`.

The loop owns the cadence of when to checkpoint to a PR. The PR skill
is idempotent: if the latest checkin hasn't moved past the marker, it's
a no-op.

## Commands

### Universal substrate (`/project-*`)

| Command | When to use |
|---------|-------------|
| `/project-plan <topic>` | Start a new project. Interviews you, produces PLAN.md + config.md + initial manifest. |
| `/project-autoload <slug>` | Get a one-screen orientation briefing. Called automatically by `/ev-run`. |
| `/project-autosave <slug> --event=<name> ...` | Write one event row to the manifest. Loops call this per unit; you rarely call it directly. |
| `/project-save-session <slug>` | Narrative handoff at end of session. Run this when you stop for the day. |
| `/project-pull-request <slug> <branch>` | Author or update the PR for a branch from the latest checkin. Idempotent. |
| `/project-pr-respond <slug> <pr>` | Classify PR feedback into a response plan file. The loop consumes the plan. |
| `/project-archive <slug>` | Retrospective + disposition classification + relocation to `projects/archive/`. |

### Branded execution layer (`/ev-*`)

| Command | When to use |
|---------|-------------|
| `/ev-run <slug> [message]` | Router. Default entry for making progress. Accepts an optional redirect message. |
| `/ev-loop-confidence <slug> <phase>` | Tiered-transform strategy. Good for bulk transforms, audits, find-replace-style work across many files. |
| `/ev-loop-interactive <slug> <phase>` | Human-paired strategy. Good for exploratory, creative, or judgment-heavy work. |

All of these have `disable-model-invocation: true` — they only run when
you (or a composing skill) invokes them explicitly. Claude won't auto-
trigger them.

## Lifecycle walkthrough

### 1. Birth — `/project-plan`

Start with a topic. The skill interviews you to cover scope, phases,
dependencies, verification, PR cadence, and loop strategy. When you
approve the draft, it scaffolds `projects/<YYYY-MM-DD>-<slug>/` with:

- `PLAN.md` — the human-readable plan
- `config.md` — base branch, reviewers, verification commands, loop preference
- `MANIFEST.md` — ground-truth state
- `sessions/`, `checkins/` — empty directories ready to receive work

No execution happens here. That comes next.

### 2. Work — `/ev-run`

Each session starts with `/ev-run <slug>`. The router:

1. Calls `/project-autoload` to get an orientation briefing.
2. Picks the next actionable phase (respecting dependencies).
3. Dispatches to the loop named in `config.md` (or the default
   `/ev-loop-confidence`).

The loop runs units until it hits a checkpoint. At a checkpoint it
calls `/project-pull-request`, which commits the accumulated work, pushes
the branch, and opens or updates the PR. Its description embeds a
marker like `<!-- project-pr-checkin: 07 -->` — that's how the skill
detects staleness on the next run.

### 3. Session end — `/project-save-session`

Not automatic. When you stop for the day, run it. It reads the events
emitted since the last `session-saved`, reads the checkins touched, and
writes a narrative handoff file — what moved, what's brittle, what's
blocking. The next session's `/project-autoload` surfaces this under
"Open threads".

### 4. PR feedback — redirect to `/ev-run`

When a reviewer leaves comments or CI fails, run:

```
/ev-run <slug> address feedback on #<pr>
```

The router recognizes the redirect, calls `/project-pr-respond` to turn
the feedback pile into a classified response plan (Blocker /
Suggestion / Question / Nit / CI failure / Off-topic), and hands the
plan to the owning loop. The loop picks up Blocker items as new units,
iterates through the usual contract/execute/evaluate cycle, and
re-opens the PR for review.

### 5. Death — `/project-archive`

When all phases have merged, `/ev-run` will suggest archiving. The
archive skill reads the full corpus, interviews you for color,
drafts a `RETROSPECTIVE.md`, and classifies each finding:

- **Inline** — trivial fix, apply in the archive PR
- **Follow-up** — medium fix, dispatch as a separate PR or project
- **New project** — large discovery, invoke `/project-plan` on it
- **Defer** — record and forget

After you approve dispositions, the project directory is moved to
`projects/archive/<slug>/` and the archive PR is authored. Archived
projects are read-only.

## Invariants worth knowing

1. **Manifest is ground truth.** Every state question starts with
   `MANIFEST.md`.
2. **Checkins are immutable.** New information produces a new numbered
   file. Never edit a previous checkin.
3. **Every unit has a contract; every contract has an evaluation.** No
   exceptions. The generator does not self-approve.
4. **The evaluator never sees the generator's reasoning.** It gets the
   contract, the artifact, and the original ask — nothing else. That's
   the point.
5. **Commits align with PR boundaries.** The loops deliberately don't
   commit per unit. Writes are immediate; commits happen at
   checkpoint time inside `/project-pull-request`.
6. **PR description is authoritative for the checkin in its marker.**
   If you change a checkin after a PR is open, run
   `/project-pull-request` again to reconcile.
7. **Peer loops don't compose each other.** If a phase needs both
   strategies, split it into two phases in PLAN.md.

## Building your own loop

The substrate is meant to be reused. A new branded loop is just a skill
that:

- Accepts `<slug> <phase>` arguments (plus optional redirect message).
- Reads/writes checkins in `projects/<slug>/checkins/<branch>/` using
  the format in `CONVENTIONS.md`.
- Calls `/project-autosave` with events from the closed vocabulary.
- Spawns the `evaluator` subagent with the (contract, artifact, ask)
  packet after every unit.
- Calls `/project-pull-request` at its own checkpoint cadence.

No substrate change required. The router picks it up if `config.md`
names it under `## Worker bindings`.
