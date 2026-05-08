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
allowed-tools: Read, Write, Edit, Skill, Bash(node .claude/scripts/trout/*)
---

# /trout-pull-request

Author or update the PR for a branch so its description matches the current
set of checkins on that branch. Idempotent: stale → rewrite; fresh → no-op.
Lead with motivation; if motivation source material is thin, stop and ask
the user. This is the only skill that talks to GitHub about PRs for a
project.

Plumbing (git, gh, marker parsing, state comparison, why-check, push
retry, autosave, MANIFEST tracking commit) lives in
`.claude/scripts/trout/pr-plumbing.ts`. The skill orchestrates: invoke
the script's verbs (`inspect`, `commit`, `submit`) via Bash, author title
and body in between. The script's tests (`pr-plumbing.test.ts`) lock the
verb contracts; this skill's invariants ride on top.

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
  the why-check prompt has fired (see § 1 Why check).

If either positional argument is missing, stop and ask the caller for the
project slug/path and branch — do not guess from cwd.

## Process

### 1. Inspect

Run `Bash("node .claude/scripts/trout/pr-plumbing.ts inspect <slug> <branch>")`.
The script emits one JSON document on stdout:

```json
{
  "state": "new" | "fresh" | "stale" | "drift",
  "disk": [<NN>, ...],
  "markerSet": [<NN>, ...] | null,
  "checkins": [{"number", "path", "phase", "unit", "goal"}],
  "pr": {"number", "body", "url"} | null,
  "whyCheck": {"thin": <bool>, "sourceSummary": {...}},
  "repo": {"owner", "name"},
  "base": "<branch>"
}
```

Dispatch on `state`:

- `fresh` → stop. Report `pr: no-op, #<N> current @ checkins <NN list>`.
- `drift` → stop. Report `pr: drift, marker <M> diverges from disk <D> — no action`.
- `new` or `stale` → proceed to the why check, then to § 2.

Empty branch (script emits `disk: []` with no PR present) → stop and
report `pr: empty, no checkins on branch`.

#### Why check

Gate on `whyCheck.thin` before authoring:

- `false` → proceed (motivation is sourced from PLAN.md Context, phase
  lead, or checkin Goal rationale).
- `true` AND `--motivation=<text>` passed → use the supplied text as the
  Motivation source. Proceed.
- `true` AND no `--motivation` → stop and output exactly:

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

  Wait for re-invocation with `--motivation=<text>`.

The thin-vs-not heuristic itself (Context length, phase-lead substance,
rationale-word matching) lives in `analyzeWhyCheck` in the script.

### 2. Author the title and body

#### 2.1 Title

- **Single-checkin** (`|disk| = 1`): `[Phase N] <unit name>`. Phase
  number and unit name come from `checkins[0].phase` and
  `checkins[0].unit` in the inspect JSON. Trim to under 70 characters.
- **Multi-checkin** (`|disk| ≥ 2`):
  - If all entries in `checkins[]` share the same `phase` AND that phase
    has a name in PLAN.md → `[Phase N] <phase name>`.
  - Else stop. Report `pr: paused, awaiting title input — checkins span phases <list>`.
- Always under 70 characters.

#### 2.2 Body — common shell

PR descriptions are reviewer-facing **summaries**, not exhaustive specs.
The checkin file in the repo IS the exhaustive spec — the PR body's job
is orientation. Every section has a hard cap, and the body itself caps
at **500-600 words total**. If the body wants to grow past 600 words,
the unit is doing too much — either split it into multiple checkins
shipping in a multi-checkin PR (the table gives reviewers a navigable
overview) or compress the body harder.

```markdown
<!-- project-pr-checkins: <comma-separated NN list> -->

> [!NOTE]
> Part of the **<project title>** project — see
> [PLAN.md](projects/<slug>/PLAN.md) for context. Full acceptance
> criteria, scope, execution, and evaluator verdict live in the
> linked checkin file(s) in the Reference / Units section below —
> the body is intentionally a summary.

## Motivation
<2–4 sentences. The "why" at conceptual level — design philosophy,
constraint, prior incident, problem being solved. Not "we need X" — the
underlying reason X is worth doing now.>

## Summary
<3–5 one-line bullets. Each bullet is one conceptual change, not one
file. Distilled from Contract Goal + Execution across all checkins.>

<Reference section — varies by single vs multi, see § 2.3 / § 2.4>

## Verification
<One line per command. Just the commands run, with the result if it's
not "clean". E.g.: `npm run lint` clean / `npm run test` 117/117 pass.>

## Notes
<3–5 most-reviewer-relevant items. Pick: the trade-offs reviewers
should pressure-test, the open questions, any `correction:` lines.
Skip implementation details, restated motivation, victory laps.>

---
Tracked by project substrate: <path to MANIFEST.md> — checkin{s} <NN list>
```

The marker MUST be the first line of the body — staleness detection
depends on it. The `> [!NOTE]` callout is required (Invariant 8); the two
templated slots — project title and PLAN.md link — come from the project
MANIFEST's `# Project: <title>` line and the resolved slug. Other GitHub
alerts (`[!WARNING]`, `[!CAUTION]`) go in `## Notes`, not as replacements
for the substrate-orientation callout.

**Section caps are hard** (Invariant 7). If source material wants to
balloon a section, the PR is doing too much — split it or compress.

**Write the authored body to a temp file** at
`/tmp/pr-body-<branch>-<NN-list>.md`. The path is consumed by
`submit --body-file=<path>` in § 3.

#### 2.3 Single-checkin Reference section

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

#### 2.4 Multi-checkin Units section

Use a heading `## Units` instead of `## Reference`. Same conciseness
rule as single-checkin — link to checkins, don't paste their bodies.

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

### 3. Submit

Two Bash invocations. The script handles all git, gh, and autosave
plumbing; the skill assembles the inputs.

**Step 3.1 — Commit pending work.** Compose the commit message from the
checkin set:

- Single-checkin: `[Phase N] <unit name> (checkin NN)`.
- Multi-checkin: `[Phase N] <phase name> (checkins NN, NN, ...)`.

Then run:

```
Bash("node .claude/scripts/trout/pr-plumbing.ts commit <slug> <branch> --message='<msg>'")
```

The script stages substrate-pattern paths only (changed code files, new
checkin file(s) under `projects/<slug>/checkins/<branch>/`,
`MANIFEST.md`), commits, and pushes by default with the standard retry
policy (4 retries, 2/4/8/16s backoff on network errors). If nothing is
pending the script emits `no-op` and exits 0 — proceed to § 3.2.

**Step 3.2 — Submit the PR.** Compose the `--phase-update` argument:

- New PR (`state == 'new'`): `<N>:in-progress:pr=#<N> (open)`. The PR
  number is unknown until `gh pr create` returns; the script resolves
  `<N>` from the gh response and substitutes it before invoking
  autosave. Pass the template literally: `1.5:in-progress:pr=#<N> (open)`.
- Stale PR (`state == 'stale'`): omit `--phase-update`. The script emits
  a `pr-updated` event without mutating the phase row.

Then run:

```
Bash("node .claude/scripts/trout/pr-plumbing.ts submit <slug> <branch> \
  --title='<title>' \
  --body-file='/tmp/pr-body-<branch>-<NN-list>.md' \
  [--phase-update='<N>:in-progress:pr=#<N> (open)']")
```

`submit` is atomic: it chains gh → autosave → MANIFEST tracking commit
→ push. When it exits 0, the working tree has no uncommitted MANIFEST
changes and the branch is fully pushed. On any sub-step failure the
script surfaces the error verbatim and exits non-zero, leaving the
working tree in whatever state it was when the failure hit — the user
resolves. The full verb contract (tracking-commit message convention,
atomicity invariant, sub-step ordering) lives in the script's tests
(`pr-plumbing.test.ts`) and was specified in checkin 07.

Report on success: `pr: created #<N>, authored from checkin{s} <NN
list>` or `pr: updated #<N>, re-authored from checkin{s} <NN list>`.

## Invariants

1. Every PR opened by this skill carries the marker (plural form).
2. Title and body are always authored from the current set of checkins
   on the branch — never carried forward from a prior version.
3. On `state: 'fresh'`, do nothing; return `pr: no-op`.
4. The skill never edits or writes checkin files. If the caller wants
   the PR to look different, the caller writes a new checkin first.
5. On `state: 'drift'` (marker-disk divergence other than `M ⊂ D`),
   refuse and report.
6. **Motivation is sourced or asked, never invented.** When
   `whyCheck.thin` and no `--motivation`, stop and ask. Do not
   synthesize from acceptance criteria or execution notes.
7. **Concise over exhaustive.** Section caps in § 2.2 are hard;
   total body caps at 500-600 words. Acceptance criteria, scope,
   execution, evaluator verdict are NOT pasted into the body — they
   live in the checkin file, linked from Reference / Units. A body
   that wants more than 600 words means the unit is doing too much.
8. **The substrate-orientation `> [!NOTE]` callout is always present**,
   between the marker and `## Motivation`. Two templated slots
   (project title from MANIFEST, PLAN.md link from slug); the
   structural wording is fixed — it onboards reviewers unfamiliar
   with the substrate to "body is a summary, depth is one click away."
9. **All git, gh, and autosave actions flow through `pr-plumbing.ts`
   verbs.** The skill body never invokes git, gh, or autosave directly.
   Push retry, marker parsing, state comparison, why-check analysis,
   tracking-commit message format, and `submit` atomicity all live in
   the script and are enforced by `pr-plumbing.test.ts`.

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

- `inspect` returns `state: 'fresh'` → `pr: no-op`. Stop.
- `inspect` returns `state: 'drift'` → `pr: drift`. Refuse.
- `inspect` returns `disk: []` and no PR → `pr: empty, no checkins on branch`. Stop.
- `whyCheck.thin == true` and no `--motivation` → `pr: paused, awaiting motivation input`. Stop.
- Multi-checkin spans phases with no single phase name → `pr: paused, awaiting title input`. Stop.
- `commit` exits non-zero (push retry exhausted, etc.) → surface the
  script's error verbatim; do not invoke `submit`.
- `submit` exits non-zero → surface the script's error verbatim. The
  failure mode (gh failure, autosave failure, tracking-commit failure,
  push failure) is reported by the script with its full stderr; the
  working tree's state at exit is intact (no auto-rollback). The user
  resolves and may re-invoke once the underlying issue is fixed.
