# Substrate conventions

Cross-family shape and rules for the project substrate. Covers the
"skills as interfaces vs workers" framing, the four-family CLI
taxonomy, the two-axis frontmatter rubric for skill authors, and the
parallel-work invariant that governs every mutating verb.

Sibling references:

- `projects/LOOM-CONVENTIONS.md` — the loom verb contract (JSON
  shapes, event vocabulary, slug resolution, settled design decisions).
- `projects/SUBSTRATE-COMPOSITIONS.md` — the recipe catalog cited from
  loop bodies by `§ Foo` references.

This file is the framing layer; the other two are the contract layer
(LOOM-CONVENTIONS) and the composition layer (SUBSTRATE-COMPOSITIONS).

## Skills as interfaces vs workers

Substrate work now flows through **two distinct surfaces**:

- **`bin/<family>` CLIs** — the workers. Pure stdlib TypeScript run
  natively under Node 24 (no transpilation, no runtime deps beyond
  `node:*`). They take args, do work, emit JSON to stdout or
  structured errors to stderr, and exit with a status code. They are
  composable from shell, from Node, from skills, and from each other.
- **`.claude/skills/<name>/SKILL.md`** bodies — the interfaces. Markdown
  prose that orchestrates one or more workers, surfaces decisions to
  the user, and shapes prose-style output. They are the addressable
  handle for any flow that needs LLM-shaped synthesis, multi-step
  user dialogue, or Agent-tool invocation (which Node CLIs cannot do).

The split is about capability, not preference:

| Capability | Worker (CLI) | Interface (skill) |
|---|---|---|
| Deterministic data shape (JSON in/out) | yes | sometimes |
| LLM synthesis / prose authoring | no | yes |
| Spawning `subagent_type` via the Agent tool | no | yes |
| Multi-step user dialogue (`AskUserQuestion`) | no | yes |
| Filesystem mutation via stdlib `fs.*` | yes | yes (rarer) |
| Composable from shell scripts and `Bash` | yes | indirect |

A skill that does pure CRUD with no synthesis is an antipattern — it
should be a CLI verb. A CLI that emits prose with embedded decisions
is also an antipattern — it should be a skill that calls one or more
CLI verbs.

## Four-family taxonomy

Every CLI under `bin/` belongs to exactly one family. The family
namespaces the verbs and bounds the worker's responsibility.

| Family | CLI | Responsibility |
|---|---|---|
| **loom** | `bin/loom` | Project substrate: manifest, events, checkins, sessions, PRs, retros, doctor. The structured state of a project. |
| **draft** | `bin/draft` | Plan substrate: PLAN.md authoring + revising, INTERVIEW.md scaffolding. The narrative state of a project. |
| **griot** | `bin/griot` | Learnings substrate: capture findings, render the rollup, mediate the judge panel, run operator checks. The post-session intelligence pipeline. |
| **guild** | `bin/guild` | Antagonist-panel substrate: derive evaluator panels, append + count findings, parse-and-aggregate verdicts, compose whiteboards. The orchestration primitives the loops compose. |

Adding a verb means picking the family it belongs to. If a verb feels
cross-family, it usually means the contract is wrong: split it into
two verbs that each live cleanly in one family.

## Surviving-skill count

The substrate target is **~12 skills total** across the four families,
plus the loop bodies. Today's count (post-Phase-5):

- **User-invocable orchestrators** (8): `/a11y-review-file`,
  `/draft-plan`, `/ev-run`, `/griot-compact`, `/griot-load`,
  `/loom-archive`, `/review-skill`, `/security-review` (registered
  by Claude Code itself).
- **Loop bodies** (2): `/ev-loop-confidence`, `/ev-loop-interactive` —
  user-invocable but typically dispatched by `/ev-run`.
- **Internal substrate primitives** (3): `/guild-spawn`,
  `/guild-validate`, `/guild-whiteboard` — never invoked by the user;
  composed by loops and by `/ev-run`'s panel-derivation step.

That's 13 substrate-core skills. The remaining slot in the budget
absorbs Claude Code's bundled meta-skills (`/init`, `/review`, etc.),
which sit alongside the substrate without being part of it.

Each new skill added beyond this set has to defend its existence
against the two-axis rubric — the default answer is "add a CLI verb,
not a skill."

## Two-axis frontmatter rubric

Every `.claude/skills/<name>/SKILL.md` declares two flags in its
frontmatter:

- **`user-invocable: true | false`** — does the user invoke this
  directly (typing `/name`) or does another skill compose it?
- **`disable-model-invocation: true | false`** — is the model
  permitted to discover and call this skill autonomously?

The four quadrants and what they mean:

| `user-invocable` | `disable-model-invocation` | Shape | Example |
|---|---|---|---|
| `true` | `true` | User-only, non-ambient | `/ev-run`, `/draft-plan`, `/loom-archive` |
| `true` | unset / `false` | User-invocable, model-composable | `/ev-loop-confidence`, `/ev-loop-interactive` |
| `false` | (any) | Internal primitive | `/guild-spawn`, `/guild-validate`, `/guild-whiteboard` |

The `(true, unset)` quadrant exists for **skills that are composed by
another slash command via the Skill tool** — the model needs to
discover them so `/ev-run` can dispatch them. The `(true, true)`
quadrant is for skills the user invokes directly and that should not
fire ambient from arbitrary prompts.

The `(false, *)` quadrant is for internal primitives: a skill that
only exists because the work needs LLM-shaped capability (Agent
tool, AskUserQuestion, prose synthesis) but is composed from another
skill, not invoked by the user. `disable-model-invocation` is moot for
these because `user-invocable: false` already blocks ambient and
direct invocation; the convention is to omit `disable-model-invocation`
and document the role explicitly in the description.

When in doubt, the rubric question is: "if a user typed `/<name>` cold,
would they be surprised by what happens?" If yes → it's an internal
primitive (`user-invocable: false`). If no → it's user-invocable, and
then ask: "should the model be able to fire this from any prompt?" If
yes → leave `disable-model-invocation` unset. If no → set it to `true`.

## Parallel-work invariant

Mutating verbs across all four families must fall into one of three
categories. Each category defines what concurrent-write safety means
for that verb. Verbs that don't fit any of the three categories are
hotspots and must either be refactored into one of the three or
declared explicit exceptions with a written reason.

### Category 1 — append-only

The verb's write uses `appendFileSync` semantics; concurrent writers
on the same path are safe because each write is a single atomic
append. New writes never modify prior content.

Examples in the substrate today:

- `bin/guild findings append` → `.guild-findings.jsonl` (one finding
  per line)
- `bin/loom event log` → `<project>/events.jsonl` (one event per line)
- `bin/griot operator-checks log-intervention` → operator-log files

### Category 2 — partitioned

Each invocation writes to a path no other concurrent invocation will
touch. The partition is encoded in the path itself — branch name,
capture timestamp, session date — so two callers never collide on
the same file.

Examples in the substrate today:

- `bin/loom checkin write` → `checkins/<branch>/<NN>.json`
  (branch-partitioned; NN is monotonically derived per branch)
- `bin/loom session write` → `sessions/<date>-<letter>.json`
  (date+letter-partitioned)
- `bin/griot capture` → `learnings/session-notes/<folder>/`
  (per-capture folder; each invocation creates a fresh directory)
- `bin/loom pr respond` → `checkins/<branch>/responses/<id>.md`
  (branch + comment-id-partitioned)

### Category 3 — single-writer-serialized

The verb is a read-modify-write of a shared file. Concurrent calls
are NOT safe at the filesystem level; safety depends on the
orchestrator never invoking the verb in parallel against the same
file.

Examples in the substrate today (declared exceptions — see below):

- `bin/draft revise` → `<project>/PLAN.md`
- `bin/loom phase update` (and other manifest writers) →
  `<project>/manifest.json`
- `bin/guild whiteboard append` → whiteboard markdown files

### Declared exceptions

Category-3 verbs are tolerated because the substrate's shape makes
parallel invocation impossible by construction. Each exception has a
reason written down here; new category-3 verbs require updating this
list.

- **`<project>/PLAN.md`** — one narrative file per project; `bin/draft
  revise` is the canonical mutation path; the `## Revision log` inside
  PLAN.md is itself append-only, which gives the audit trail back.
  Hand-editing PLAN.md is a substrate antipattern; PLAN.md is
  CLI-owned state.
- **`<project>/manifest.json`** — one project state file per project;
  loom verbs are the canonical mutation path; the sibling
  `events.jsonl` is append-only and records every state change, which
  gives the audit trail back. Bypassing loom verbs to write
  manifest.json directly is a substrate antipattern.
- **whiteboard markdown files** (`projects/<slug>/whiteboards/<file>.md`)
  — one whiteboard per phase question; `bin/guild whiteboard append`
  is the canonical mutation path; the orchestrator (`/guild-whiteboard`)
  serializes round-appends by invoking the verb once per round; engineer
  agents are read-only and never write the file directly. The verb
  reads, computes the next state, and writes the whole file back —
  category 3 — but the orchestrator's serialization makes this safe in
  practice.

Adding a fourth declared exception requires (a) updating this list
with a written reason, (b) confirming the orchestrator that calls the
verb serializes the writes, and (c) preferring refactor over exception
when the partition or append-only alternative exists.

## How this catalog is used

This file (`projects/CONVENTIONS.md`) is referenced from substrate
prose with fully-qualified citations like `CONVENTIONS.md § Two-axis
frontmatter rubric` — never bare `§`. Bare `§ Foo` references resolve
in `projects/SUBSTRATE-COMPOSITIONS.md` (the recipe catalog) by
convention; conventions docs use a different citation form so the
namespaces stay clean.
