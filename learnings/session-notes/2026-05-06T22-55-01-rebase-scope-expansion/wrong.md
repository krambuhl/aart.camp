The default reaction is to treat the conflict as a coexistence problem and
ship two test harnesses side by side, since "infra not coverage" framing
seems to forbid converting the substrate tests:

- Rename main's script to `"test:substrate": "node --test
  '.claude/scripts/**/*.test.ts'"`
- Keep our `"test": "vitest run"` as the application test runner
- Document in the PR: "vitest is the project's primary test runner; substrate
  tests run via a separate script. Consolidation under one runner is a
  follow-up."

This "preserves the user's infra-not-coverage framing" by not touching
substrate test contents — but it leaves the project with two competing test
runners (`node:test` for substrate, `vitest` for application), two assertion
styles, two CI invocations, and the inevitable follow-up PR to consolidate.
The PR also dodges the easy answer: porting `node:test` → `vitest` is a
3-line edit (env annotation + import swap) that vitest's `test()` API makes
trivially mechanical.
