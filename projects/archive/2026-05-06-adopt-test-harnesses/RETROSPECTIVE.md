# Retrospective — Adopt Test Harnesses

**Archived**: 2026-05-08
**Duration**: 2026-05-06 → 2026-05-08 (~48 hours wall-clock, three chat sessions)
**PRs**: #11 (vitest), #14 (Storybook), #15 (Playwright), #17 (GitHub Actions CI)

## What we set out to do

Stand up four testing harnesses (vitest, Storybook, Playwright, GitHub
Actions CI) on a Next.js generative-art portfolio that had zero test
infrastructure. Build coverage is **explicitly out of scope** — each
phase ships exactly one example test as a smoke screen, just enough
to prove the harness works. Coverage grows organically from a future
working position, not from a gated migration.

## What actually happened

Four phases, four PRs, mostly linear: Phase 1 (vitest) and Phase 2
(Storybook) were independent setup PRs, Phase 3 (Playwright) needed
Phase 2's stories to screenshot, Phase 4 (CI) wired everything into
a GitHub Actions workflow. Each phase preserved its smoke-screen
discipline — no phase tried to ship coverage along with the harness.

Three structural decisions held throughout: (a) the "consolidate over
coexist" pattern showed up at every integration boundary —
`postcss.config.js` array-vs-object format for Vite/Next compatibility,
`node:test`-vs-vitest for substrate vs application tests, two-config
vs one config for Storybook PostCSS handling — and we always picked
one config that worked for both surfaces; (b) deviations from PLAN
were features, not failures — Phase 3 D2 swapped PLAN's
`@storybook/test-runner` for vanilla Playwright + index.json
iteration, getting the same auto-discovery behavior with less
tooling; (c) when contract violations surfaced mid-flight, the right
move was to raise the fork as A/B/C options to the user rather than
pick unilaterally — Phase 4 D1 used this pattern to surface the
substrate-test port as a precursor commit decision.

Phase 4's "matrix-for-observability" decision worked cleanly. Wall
times across the four parallel jobs (lint 23-29s, vitest 36-48s,
build 64-68s, e2e 1m 51s - 4m 53s) immediately answered the
performance question — e2e is the long pole, everything else is
rounding error. The first run after merge surfaced two non-Phase-4
issues that the harness caught before they could grow: another
`node:test`-based substrate test landed from the agent-guilds project
right as Phase 4 was opening (one-line port, fixed in a follow-up
commit), and a flaky timing-race test in `capture.test.ts` only
manifested under CI's slower subprocess startup (fixed by
pre-creating a 5-second window of collision folders). Both were
pre-existing substrate bugs that adopt-test-harnesses' CI surface
exposed.

The substrate flow itself was honest about the mid-PR session-save
gap. Phases 2 and 3 had five `correction:` lines in their checkin
notes that never went through `/griot-capture` because their chat
sessions ended without `/trout-save-session`. Those captures were
back-filled during this archive ritual.

## What went well

- **Smoke-screen-per-phase held under pressure.** Every phase
  preserved the "one test, harness only" discipline. No coverage
  creep, no scope dilution.
- **Three-phase pattern fit the work.** Each harness was a
  setup/gate PR; Phase 4 was the satisfying close-the-loop cleanup.
  Aligned cleanly with the user's PR philosophy without forcing it.
- **Tool-deviation-from-PLAN paid off.** Phase 3 D2's vanilla-
  Playwright pivot delivered the same capability with zero new
  test-runner deps, no `jest-image-snapshot`, no `.storybook/test-runner.ts`
  config layer.
- **Evaluator panel caught a real bug.** Phase 3 D2's first pass
  approved structurally but flagged that the committed baseline image
  was Storybook's "No Preview" error panel rather than rendered Stack —
  visual content inspection caught what the verification command list
  alone would have missed.
- **Matrix-for-observability validated immediately.** Phase 4's CI
  shape made e2e's wall-time dominance obvious on first run, with
  zero ambiguity about where to optimize if CI runtime ever becomes
  a problem.

## What didn't

- **agent-guilds peer project keeps shipping `node:test`-based
  substrate tests.** Phase 1 D3, Phase 4 precursor, and a Phase 4
  follow-up commit all reactively ported the same pattern (4 file
  changes total over the project). The right fix is upstream — a
  lint rule or CLAUDE.md note in the agent-guilds project — but never
  got dispatched.
- **Save-session-before-PR friction was real.** Five `correction:`
  lines from Phases 2 and 3 silently dropped because their chat
  sessions ended without `/trout-save-session`. The substrate
  expectation that captures fire from save-session is fragile —
  the user shouldn't have to remember to run save-session before
  closing a chat tab. (See Findings #2.)
- **`evaluator-contract-fit` substrate-name mismatch persisted.**
  Phase 3 and Phase 4 both fell back to the standalone `evaluator`
  subagent type because the named panel agent isn't registered on
  this machine. Same workaround applied twice with no follow-up.
- **`next-env.d.ts` checkin churn never resolved.** Flagged across
  three sessions. The file flips between `.next/dev/types/...` and
  `.next/types/...` based on which Next command ran most recently —
  not actually a bug, but constant cognitive overhead deciding
  whether to stage it or stash it on every checkin.
- **CI surfaced a flaky test only after merge.** The
  `capture.test.ts` collision test had a UTC-second timing race that
  passed on every fast local run and failed deterministically on the
  slower GH Actions runner. Cost: two extra rounds of CI validation
  on the Phase 4 PR after the user thought it was green-and-done.

## Findings

1. **agent-guilds substrate tests use `node:test`** — recurring,
   five reactive ports across this project. Right fix is upstream
   (lint rule on `import { test } from 'node:test'` in
   `.claude/scripts/**`, or a CLAUDE.md convention in the
   agent-guilds project's scope).
2. **Save-session-before-PR friction** — captures only fire on
   session-save, so unsaved sessions silently drop corrections.
   Substrate change wanted: `/trout-pull-request` should compose
   `/trout-save-session` (or call `/griot-capture --from-checkin`
   directly on the checkin set) so the capture pipeline runs before
   the PR opens.
3. **`evaluator-contract-fit` not registered on this machine** —
   substrate config drift; Phase 3 and Phase 4 both fell back to
   the standalone `evaluator` subagent type. One of the agent-*
   definition files needs registering for this name to resolve.
4. **Permission-prompt overhead** — every session asked for many
   permissions; the user explicitly flagged this as friction.
5. **`next-env.d.ts` checkin churn** — flips between `.next/dev/types/...`
   and `.next/types/...` based on which Next command ran last;
   creates per-checkin staging-vs-stashing micro-decisions.
6. **No Playwright browser cache in CI** — `~/.cache/ms-playwright`
   rebuilt every run via `--with-deps`, ~30s install per job.
7. **No HTML reporter for Playwright** — `playwright-report/` is
   empty on failure (project uses `'list'` reporter); only
   `test-results/` carries diffs.
8. **Next.js builds twice in parallel matrix** — Phase 4's e2e
   job re-builds Next.js inside its webServer config while the
   `build` matrix job builds it separately. ~2× the CPU for the
   same artifact.

## Dispositions

| # | Finding | Disposition | Detail |
|---|---|---|---|
| 1 | agent-guilds `node:test` recurrence | **Follow-up** | Belongs in agent-guilds project territory. Suggest small substrate PR adding lint rule + CLAUDE.md note, or add as next agent-guilds finding |
| 2 | Save-session-before-PR friction | **Follow-up** | Substrate change to `/trout-pull-request`. Belongs in agent-guilds project territory. Suggest `/trout-plan capture-on-pr-open` for a tiny project, or fold into the next agent-guilds substrate-cleanup PR |
| 3 | `evaluator-contract-fit` not registered | **Follow-up** | Substrate config in `.claude/agents/`. Trivial fix once the right hand is reviewing the agent registry; defer to next substrate-cleanup pass |
| 4 | Permission-prompt overhead | **Inline (applied)** | Ran `/fewer-permission-prompts` then re-evaluated the strict-skipped list with the user. Added 15 patterns to `.claude/settings.json`: 7 npm/npx test/build (`npm test *`, `npm run lint *`, `npm run build *`, `npm run build-storybook *`, `npm run test:agentic *`, `npm run test:e2e *`, `npx playwright test *`) + 8 git/fs (`git add *`, `git commit *`, `git stash *`, `git push origin *`, `git checkout -b *`, `git restore --staged *`, `npx playwright install *`, `mkdir -p *`). Added a `deny` section explicitly forbidding any force-push variant (`--force*`, `-f*`) so the user-CLAUDE.md rule "NEVER force push to main/master" survives a generous push allowlist. Skipped `gh pr create` (per user direction — keep manual PR creation gated), `npm install`/`uninstall` (lifecycle script attack surface), bare `git restore`/`git checkout <file>` (destroys uncommitted work), `git rebase` (history rewrite). |
| 5 | `next-env.d.ts` churn | **Defer** | Multiple sessions flagged it; no clean fix without committing one canonical version. Live with it |
| 6 | No Playwright browser cache in CI | **Defer** | Explicit "no" decision in Phase 4. Revisit when CI runtime hurts |
| 7 | No HTML reporter | **Defer** | One-line `playwright.config.ts` change. Revisit when first real e2e failure makes the empty UI annoying |
| 8 | Next.js double-build | **Defer** | Build-artifact sharing between matrix jobs is the natural fix. Revisit when e2e wall-time hurts |

### Inline findings applied
- Permission-prompts allowlist (Finding #4) — 7 patterns added to
  `.claude/settings.json`. Skipped mutating commands and auto-
  allowed read-only commands per the skill's rules.

### Follow-ups dispatched
- **#1, #2, #3** are all substrate concerns that belong in the
  `2026-05-02-agent-guilds` project's territory. The user can
  surface these during the next agent-guilds session, or invoke
  `/trout-plan` for a small substrate-cleanup-3 follow-up project
  if they prefer the discrete-PR path.

## Captured learnings

Eight `correction:`-derived learnings live under
`learnings/session-notes/` from this project (six back-filled
during this archive ritual). Run `/griot-compact` to triage them
into `learnings/rollup.md`.

- `2026-05-06T22-55-01-rebase-scope-expansion/` — consolidate-over-coexist
  pattern when rebase brings in overlapping tooling
- `2026-05-08T14-29-06-agent-guilds-node-test-recurrence/` — port
  pattern needs upstream fix
- `2026-05-08T14-29-27-mid-flight-scope-fork-pattern/` — raise the
  fork as A/B/C options when contract violation surfaces during execution
- `2026-05-08T16-04-24-postcss-array-to-object-consolidation/` —
  Phase 2 D1's PostCSS format consolidation
- `2026-05-08T16-04-25-latent-config-no-import-shallow-typecheck/` —
  smoke-import flushes latent type errors in config files
- `2026-05-08T16-04-27-carry-forward-restore-at-branch-boundary/` —
  `git restore` testing-artifact files at branch boundaries instead
  of carrying them forward
- `2026-05-08T16-05-59-tool-deviation-from-plan-as-feature/` — PLAN
  can name a tool but the same goal with less tooling is a feature
- `2026-05-08T16-06-37-settings-local-json-gitignore-convention/` —
  Claude Code's `*.local.json` gitignore convention
- `2026-05-08T16-06-40-evaluator-image-content-inspection/` —
  evaluator can flag visual content when verification list misses it
