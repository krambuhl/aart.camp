# Triggering prompt (distilled)

## Unit

Extract /trout-pull-request plumbing into .claude/scripts/trout/pr-plumbing.ts (script + tests)

## Goal

Author `.claude/scripts/trout/pr-plumbing.ts` and sibling `pr-plumbing.test.ts`. The script extracts the deterministic CRUD/plumbing operations from `/trout-pull-request` (inspect state, commit pending work, push with retry, create-or-update PR via `gh`) into a Node 24 strip-types TypeScript script invoked via Bash from the skill body. The skill body itself stays unchanged in this checkin — the SKILL.md rewrite that consumes the script lands in checkin 08. This staging keeps each checkin under the loop's natural-pause threshold (~3 files, ~200 lines of new code) and keeps `/trout-pull-request` working as-is until both halves land at PR-merge time.

## Acceptance criteria

1. `.claude/scripts/trout/pr-plumbing.ts` exists with four verb-style subcommands invoked positionally:
   - `inspect <slug> <branch>` — emits one JSON document to stdout with this shape:
     ```
     {
       state: 'fresh' | 'stale' | 'drift' | 'new',
       disk: number[],                          // checkin numbers on disk (D)
       markerSet: number[] | null,              // parsed marker (M); null if no PR
       checkins: [{number, path, phase, unit, goal}],
       pr: {number, body, url} | null,
       whyCheck: {thin: boolean, sourceSummary: {planContext, phaseLead, checkinGoalsRationale}},
       repo: {owner, name},
       base: string                             // from config.md, default 'main'
     }
     ```
     No prose. Failures emit JSON `{error: <code>, message: <prose>}` and exit non-zero.
   - `commit <slug> <branch> --message=<commit-msg> [--no-push]` — runs `git status --porcelain`; if changes exist, stages substrate-pattern paths only (changed code files + new checkin files under `projects/<slug>/checkins/<branch>/` + `projects/<slug>/MANIFEST.md`) and commits with the supplied message. Then, **by default, immediately pushes** with the standard retry policy. `--no-push` flag skips the push (caller is responsible for catching up via `push` later — this is the escape-hatch for stacking commits intentionally). Emits the new commit SHA + `pushed` (or `commit-only` if `--no-push`) on stdout, or `no-op` if nothing was pending. Never `git add -A` / `git add .`.
   - `push <branch>` — escape-hatch standalone push. Runs `git push [-u] origin <branch>` with the standard retry policy (4 retries, 2/4/8/16s backoff on network errors only — auth/perm errors fail fast). Emits `pushed <branch> @ <sha>` on success; surfaces git error verbatim and exits non-zero on failure.
   - `submit <slug> <branch> --title=<title> --body-file=<path> [--phase-update=<...>]` — atomic from caller's POV. Sequence:
     1. `gh pr create --base <base> --head <branch> --title <title> --body-file <path>` if no open PR exists for `<branch>`, else `gh pr edit <number> --title <title> --body-file <path>`.
     2. `node .claude/scripts/trout/autosave.ts <slug> --event=pr-opened|pr-updated --detail=#<N> [--phase-update=...]` — writes MANIFEST update.
     3. `git add projects/<slug>/MANIFEST.md` (the only path autosave is allowed to touch).
     4. `git commit -m "Track PR #<N> [re-author] for checkin <NN list> in MANIFEST"` (commit message reflects whether new or updated, and which checkin set).
     5. Push the tracking commit with the standard retry policy.
     6. Emit `pr: created #<N>` or `pr: updated #<N>`.
