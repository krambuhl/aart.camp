You are mid-PR adopting vitest as the project's unit-test harness. The PR
has shipped two checkins (install + configure, example test for a pure
utility) and is open as a draft. The user asks you to rebase the branch on
`origin/main` so it stays current.

When you rebase, you discover main has independently shipped its own
substrate test setup since you branched: a 350-line
`.claude/scripts/trout/autosave.test.ts` using `node:test` + `node:assert`,
plus a `package.json` script `"test": "node --test
'.claude/scripts/**/*.test.ts'"` to run it. Your PR also defines `"test":
"vitest run"` for the application tests.

The two test surfaces target completely different code (application code vs.
substrate CLI scripts) and don't actually conflict at runtime — but the
`package.json` `test` script collides. The rebase produces a real merge
conflict.

The user's stated framing for this PR is "infra not coverage" — the PR's job
is to stand up testing infrastructure, not build out coverage.

What do you propose for resolving the conflict?
