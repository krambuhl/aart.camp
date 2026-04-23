---
name: project-pull-request
description: >-
  Author or update a GitHub PR from the latest numbered checkin on a branch.
  Idempotent — uses an HTML marker in the PR body to detect staleness and
  only rewrites when the latest checkin has moved past the marker. Use
  when a loop decides it is time to checkpoint, or when the user wants to
  reconcile a PR with the latest checkin.
argument-hint: "<project-slug-or-path> <branch-name>"
disable-model-invocation: true
allowed-tools: Read, Write, Edit, Bash, Skill, mcp__github__get_file_contents, mcp__github__list_pull_requests, mcp__github__create_pull_request, mcp__github__update_pull_request, mcp__github__pull_request_read, mcp__github__search_pull_requests
---

# /project-pull-request

Author or update the PR for a branch so its description matches the latest
checkin. Idempotent: stale → rewrite; fresh → no-op. This is the only skill
that talks to GitHub about PRs for a project.

**Format reference**: `./projects/CONVENTIONS.md` (§ PR marker, § Checkin
format).

## Arguments

- `<project-slug-or-path>` — resolved like `/project-autosave`.
- `<branch-name>` — the git branch the PR is tied to. May contain slashes
  (`claude/adopt-biome-v1`).

## Process

### 1. Resolve inputs

- Resolve the project directory.
- Confirm the branch exists locally: `git rev-parse --verify <branch>`.
- Identify `checkins/<branch-name>/` and find the highest-numbered file.
  That is "the latest checkin". Read it.

### 2. Find the existing PR, if any

Use `mcp__github__list_pull_requests` (or `search_pull_requests`) scoped
to `krambuhl/aart.camp` with `head=<owner>:<branch>` and state `open`.

If a PR exists:
- Read its body via `mcp__github__pull_request_read`.
- Parse the marker: a line matching `<!-- project-pr-checkin: NN -->`.
  If no marker, treat as stale.
- If `marker == latest checkin NN` → **fresh**. Stop. Report "PR #X is
  current as of checkin NN". Do not rewrite.
- If `marker < latest checkin NN` → **stale**. Rewrite (step 4).
- If `marker > latest checkin NN` → data drift. Stop and report; do not
  overwrite. Something is wrong upstream.

If no PR exists → **new** (step 3).

### 3. New PR

1. **Commit pending work.** If `git status --porcelain` shows
   modifications, stage the code changes, the new checkin file(s), and
   `MANIFEST.md`, then commit with message `<phase tag> <unit name>
   (checkin NN)`. One commit per checkpoint — the loops deliberately do
   not commit per-unit. If nothing is pending, skip this step.
2. Ensure the branch has commits ahead of `main` (or the base from
   `config.md`). If not, stop and report "no commits to open a PR with".
3. Push the branch with `git push -u origin <branch>`. Retry on network
   errors up to 4 times with 2s/4s/8s/16s backoff.
4. Author the title and body from the latest checkin (§ 5).
5. Create the PR via `mcp__github__create_pull_request` with base from
   `config.md` (default `main`).
6. Invoke `/project-autosave` with `--event=pr-opened --detail=#<N>`
   and `--phase-update` reflecting the new PR number on the appropriate
   phase row.

### 4. Stale PR

1. **Commit pending work** (same as § 3 step 1).
2. **Push** any new commits: `git push origin <branch>` with the same
   retry policy.
3. Author fresh title and body from the latest checkin (§ 5).
4. Update via `mcp__github__update_pull_request`.
5. Invoke `/project-autosave` with `--event=pr-updated --detail=#<N>`.

### 5. Authoring from a checkin

The PR title comes from the checkin's unit name, prefixed with the phase
number in square brackets: `[Phase 2] Uninstall ESLint dependencies`.
Keep under 70 characters. Trim as needed.

The PR body is:

```markdown
<!-- project-pr-checkin: NN -->

## Summary
<1–3 bullets, distilled from the checkin's Contract goal and Execution>

## Contract
- **Goal**: <from checkin>
- **Acceptance criteria**:
  - <list>

## Verification
<from checkin's Rules applied, filtered to the commands>

## Notes
<from checkin's "Notes for the PR" section — verbatim if short, summarized
if long; omit if empty>

---
Tracked by project substrate: <path to MANIFEST.md> — checkin <NN>
```

The marker **must** be the first line of the body. It is how staleness is
detected on the next invocation.

### 6. Do not commit or merge

This skill only writes to GitHub and records the event via autosave. It
does **not** commit checkin files, merge the PR, or modify local state
beyond pushing the branch. The loop owns commits; the human owns merges.

## Invariants

1. Every PR opened by this skill carries the marker.
2. Title and description are **always authored from the current latest
   checkin** — never carried forward from a prior version.
3. If marker equals latest checkin NN, the skill does nothing and returns
   a "no-op" message.
4. The skill never edits checkin files and never writes new checkins. If
   the caller wants the PR to look different, the caller writes a new
   checkin first.
5. On marker-ahead-of-disk, refuse to act and report the drift.

## Failure modes

- Branch has no commits → report and stop.
- Branch not pushed and push fails after retries → report the network
  error; do not create the PR.
- `checkins/<branch>/` is empty → stop. There is nothing to author from.
- PR marker present but unparseable → treat as stale.
- GitHub returns a 4xx on create/update → surface the error verbatim; do
  not swallow.
