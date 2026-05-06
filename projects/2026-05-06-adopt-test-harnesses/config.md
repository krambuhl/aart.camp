# Project config

## Verification
- `npm run lint`
- `npm run build`
- `npm test` (available after Phase 1)
- `npm run test:e2e` (available after Phase 3)

## PR settings
- Base branch: main
- Reviewers: —
- Labels: project/adopt-test-harnesses

## Worker bindings

**Loop:** interactive

This project is a sequence of distinct setup PRs (vitest, Storybook,
Playwright, CI), each requiring exploratory configuration work rather than
mechanical bulk transformation. The interactive loop is the right shape:
human-paired, deliverable-by-deliverable, with evaluator checkpoints between
each harness install.
