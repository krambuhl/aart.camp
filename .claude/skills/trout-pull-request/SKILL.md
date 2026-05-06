---
name: trout-pull-request
description: >-
  Author or update a GitHub PR from the set of numbered checkins on a branch.
  Idempotent — uses an HTML marker in the PR body to detect staleness and
  only rewrites when the checkin set on disk has changed. Supports both
  single-checkin and multi-checkin PRs. Leads with motivation; if PLAN.md
  and the checkin Goals don't supply enough "why," the skill stops and
  asks the user. Use when a loop decides it is time to checkpoint, or when
  the user wants to reconcile a PR with the latest checkins.
argument-hint: "<project-slug-or-path> <branch> [--motivation=<text>]"
allowed-tools: Read, Write, Edit, Bash(git:*), Skill, mcp__github__list_pull_requests, mcp__github__create_pull_request, mcp__github__update_pull_request, mcp__github__pull_request_read
---

# /trout-pull-request

Author or update the PR for a branch so its description matches the current
set of checkins on that branch. Idempotent: stale → rewrite; fresh → no-op.
Lead with motivation; if motivation source material is thin, stop and ask
the user. This is the only skill that talks to GitHub about PRs for a
project.

**Format reference**: `projects/CONVENTIONS.md` (§ PR marker, § Checkin
format, repo-relative).

## Arguments

Positional: `$1 = <project-slug-or-path>`, `$2 = <branch>`.

- `$1` (`<project-slug-or-path>`) — resolved like `.claude/scripts/trout/autosave.ts`
  (exact slug → suffix match → full path).
- `$2` (`<branch>`) — the git branch the PR is tied to. May contain
  slashes (`claude/adopt-biome-v1`).

Optional flag:

- `--motivation=<text>` — supplied by the caller on re-invocation after
  the why-check prompt has fired. See § 3.

If either positional argument is missing, stop and ask the caller for the
project slug/path and branch — do not guess from cwd.

## Process

### 1. Resolve inputs

- Resolve the project directory.
- Confirm the branch exists locally: `git rev-parse --verify <branch>`.
- Enumerate `checkins/<branch>/` for every file matching `NN.md`. Parse
  each (read at minimum the front matter and the Contract section). The
  set of checkin numbers on disk is `D`.
- If `D` is empty, stop. Report `pr: empty, no checkins on branch`.

### 2. Find the existing PR, if any

Derive `<owner>/<repo>` from `config.md` (the `## PR settings` block;
fall back to the `origin` remote URL via
`git config --get remote.origin.url` if unset). Use
`mcp__github__list_pull_requests` (or `search_pull_requests`) scoped to
that repo with `head=<owner>:<branch>` and state `open`.

If a PR exists:

- Read its body via `mcp__github__pull_request_read`.
- Parse the marker. Two forms accepted on read:
  - **Plural (canonical)**: `<!-- project-pr-checkins: NN[,NN,...] -->`.
    The comma-separated list is the marker set `M`.
  - **Singular (backward-compat)**: `<!-- project-pr-checkin: NN -->`.
    Interpreted as `M = {NN}`. Only the plural form is written.
- If no marker is present (or it is unparseable), treat as `M = ∅` —
  effectively stale (rewrite path).
- Compare `M` to `D`:
  - `M == D` → **fresh**. Stop. Report `pr: no-op`. Do not rewrite.
  - `M ⊂ D` (proper subset, including `M = ∅`) → **stale**. Rewrite (§ 6).
  - `M ⊃ D` (marker references checkins not on disk), OR sets disjoint
    or overlapping in both directions → **drift**. Stop and report.

If no PR exists → **new** (§ 5).

### 3. Why check

Run before authoring (whether new or stale). Confirm there is enough
motivation content to write a substantive `## Motivation` section.

Source material to read:

- `projects/<slug>/PLAN.md`'s top-level `## Context` section if present.
- The phase entry in PLAN.md for the phase the checkin set belongs to
  (the phase number is the checkin's `**Phase**:` field). Read its lead
  paragraph.
- Each checkin's Contract `**Goal**` field.

**Heuristic for "thin"** — motivation is thin when **all** of these hold:

- No project-level `## Context` section, OR the section is shorter than
  ~80 characters of substantive prose.
- No phase-level lead paragraph in PLAN.md for the relevant phase, OR
  the lead paragraph is a single restatement of the phase title.
- No checkin Goal contains rationale words: `because`, `so that`,
  `motivated by`, `to ensure`, `to avoid`, `to keep`, `the reason`,
  `prevent`, or a verb like `address`/`fix`/`resolve` followed by a
  problem reference.

If **not thin** → motivation is sourced (PLAN.md Context preferred;
checkin Goal rationale fills in if Context is project-level only).
Proceed to § 4.

If **thin** AND `--motivation=<text>` was passed → use the supplied text.
Skip the prompt. Proceed.

If **thin** AND no `--motivation` argument → stop. Output exactly:

```
pr: paused, awaiting motivation input

PLAN.md and the checkin Goal(s) on this branch don't supply enough
"why" to author a Motivation section.

What's the motivation for this PR? (1–3 sentences on the underlying
problem, constraint, or rationale — not just the requirement.)

Optional follow-up: should I append this back to PLAN.md's
`## Context` section / the relevant phase entry so future invocations
don't re-ask?
```

Do not write to GitHub. Do not commit. Wait for the caller to re-invoke
with `--motivation=<text>` (and optionally a follow-up PLAN.md edit if
the user said yes to the follow-up).

### 4. Author the title and body

#### 4.1 Title

- **Single-checkin** (`|D| = 1`): `[Phase N] <unit name>`. Phase number
  and unit name come from the checkin's `**Phase**:` and `**Unit**:`
  fields. Trim to under 70 characters.
- **Multi-checkin** (`|D| ≥ 2`):
  - If all checkins share the same `**Phase**:` field AND that phase
    has a name in PLAN.md → `[Phase N] <phase name>`.
  - Else stop. Report `pr: paused, awaiting title input — checkins span phases <list>`.
- Always under 70 characters.

#### 4.2 Body — common shell

PR descriptions are reviewer-facing **summaries**, not exhaustive specs.
The checkin file in the repo IS the exhaustive spec — the PR body's job
is orientation. Every section has a hard cap.

```markdown
<!-- project-pr-checkins: <comma-separated NN list> -->

## Motivation
<2–4 sentences. The "why" at conceptual level — design philosophy,
constraint, prior incident, problem being solved. Not "we need X" — the
underlying reason X is worth doing now.>

## Summary
<3–5 one-line bullets. Each bullet is one conceptual change, not one
file. Distilled from Contract Goal + Execution across all checkins.>

<Reference section — varies by single vs multi, see § 4.3 / § 4.4>

## Verification
<One line per command. Just the commands run, with the result if it's
not "clean". E.g.: `npm run lint` clean / `npm run test` 20/20 pass.>

## Notes
<3–5 most-reviewer-relevant items. Pick: the trade-offs reviewers
should pressure-test, the open questions, any `correction:` lines.
Skip implementation details, restated motivation, victory laps.>

---
Tracked by project substrate: <path to MANIFEST.md> — checkin{s} <NN list>
```

The marker MUST be the first line of the body. It is how staleness is
detected on the next invocation.

**Section caps are hard.** If the source material wants to balloon a
section, that's a sign the PR is doing too much — split it, or compress
to fit. The reviewer will click into the checkin file for detail; the PR
body's job is to make that click obvious and worth it.

#### 4.3 Single-checkin Reference section

```markdown
## Reference

- **Goal**: <1–2 sentence distillation of the checkin Goal — paraphrase
  if Goal is long. Strip "this is the first migration" framing if it's
  in the Motivation already.>
- **Checkin**: [<path to checkin file>](<path>) — full contract,
  acceptance criteria, disqualifiers, scope, execution, evaluator
  verdict.
```

Do **not** paste the acceptance criteria verbatim into the PR body. The
checkin file is in the repo and renders in GitHub one click away;
duplicating it doubles the surface area reviewers have to track. The
"Goal" sentence orients; the path link delivers depth.

#### 4.4 Multi-checkin Reference section

Use a heading `## Units` instead of `## Reference`. Same conciseness
rule as single-checkin — link to checkins, don't paste their bodies.

A `## Units` table for any `|D| ≥ 2`:

```markdown
## Units

| # | Unit | Goal | Checkin |
|---|------|------|---------|
| 01 | <unit name> | <1-line distillation> | [link](<path>) |
| 02 | <unit name> | <1-line distillation> | [link](<path>) |
```

Reviewers click into the checkin file for the full contract,
acceptance criteria, scope, execution, and evaluator verdict. The PR
body stays focused on what changed across the set.

### 5. New PR

1. **Commit pending work.** If `git status --porcelain` shows
   modifications, stage code changes, new checkin file(s), and
   `MANIFEST.md`, then commit with message
   `<phase tag> <unit-or-phase name> (checkin{s} NN[, NN, ...])`. One
   commit per checkpoint — the loops deliberately do not commit per-unit.
   If nothing is pending, skip.
2. Ensure the branch has commits ahead of `main` (or the base from
   `config.md`). If not, stop and report `pr: empty, no commits ahead of base`.
3. Push the branch with the standard push-retry policy (§ Retry policy).
4. Author the title and body per § 4.
5. Create the PR via `mcp__github__create_pull_request` with base from
   `config.md` (default `main`).
6. Run `Bash("node .claude/scripts/trout/autosave.ts <slug> --event=pr-opened --detail=#<N> --phase-update=<N>:in-progress:pr=#<N> (open)")`.

### 6. Stale PR

1. **Commit pending work** (same as § 5 step 1).
2. **Push** any new commits with the standard push-retry policy.
3. Author fresh title and body per § 4.
4. Update via `mcp__github__update_pull_request`.
5. Run `Bash("node .claude/scripts/trout/autosave.ts <slug> --event=pr-updated --detail=#<N>")`.

### Retry policy

The standard push-retry policy: `git push [-u] origin <branch>`; on
network errors retry up to 4 times with 2s / 4s / 8s / 16s backoff.

### 7. Do not commit or merge

This skill writes to GitHub and records the event via autosave. It does
**not** write new checkin files, merge the PR, or modify local state
beyond the checkpoint commit (§ 5/§ 6 step 1) and the branch push. The
loop owns commits; the human owns merges.

## Invariants

1. Every PR opened by this skill carries the marker (plural form).
2. Title and description are **always authored from the current set of
   checkins on the branch** — never carried forward from a prior version.
3. If the marker set equals the disk set, the skill does nothing and
   returns a "no-op" message.
4. The skill never edits checkin files and never writes new checkins. If
   the caller wants the PR to look different, the caller writes a new
   checkin first.
5. On marker-disk divergence other than `M ⊂ D`, refuse to act and
   report the drift.
6. **Motivation is sourced or asked, never invented.** When source
   material is thin, the skill stops and asks the user; it does not
   synthesize a Motivation paragraph from acceptance criteria or
   execution notes.
7. **Concise over exhaustive.** PR body sections obey the caps in § 4.2
   (Motivation 2-4 sentences; Summary 3-5 one-line bullets; Notes 3-5
   reviewer-relevant items). Acceptance criteria, scope, execution, and
   evaluator verdict are NOT pasted into the body — they live in the
   checkin file, linked from the Reference / Units section. A PR body
   that wants to be longer is signaling that the unit is doing too much
   or that the author is over-explaining.

## Report

Exactly one of these terminal states, one line:

```
pr: no-op, #<N> current @ checkins <NN list>
pr: created #<N>, authored from checkin{s} <NN list>
pr: updated #<N>, re-authored from checkin{s} <NN list>
pr: drift, marker <M> diverges from disk <D> — no action
pr: paused, awaiting motivation input from user
pr: paused, awaiting title input from user (checkins span phases <list>)
pr: empty, no checkins on branch
pr: empty, no commits ahead of base
```

## Failure modes

- Branch has no commits ahead of base → `pr: empty, no commits ahead of base`. Stop.
- Branch not pushed and push fails after retries → report the network
  error; do not create the PR.
- `checkins/<branch>/` is empty → `pr: empty, no checkins on branch`. Stop.
- PR marker present but unparseable → treat as missing (rewrite path).
- Marker references checkins not on disk → `pr: drift`. Refuse.
- Motivation source material thin and no `--motivation` argument →
  `pr: paused, awaiting motivation input from user`. Stop.
- Multi-checkin spans phases with no single clear phase name →
  `pr: paused, awaiting title input from user`. Stop.
- GitHub returns a 4xx on create/update → surface the error verbatim; do
  not swallow.
