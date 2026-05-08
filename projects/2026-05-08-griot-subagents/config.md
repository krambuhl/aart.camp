# Project config

## Verification
- `npm run lint`
- `npm run build`
- Phase 2 only: real subagent run on a small batch of session-notes,
  rollup diff reviewed manually

## PR settings
- Base branch: main
- Reviewers: —
- Labels: —

## Worker bindings

**Loop:** interactive

This project is architectural rewrite work — defining new subagent
types, redesigning the judge panel, dissolving a Node orchestrator
into a skill. Each phase has real design judgment, not mechanical bulk
transformation. The interactive loop is the right shape: human-paired,
deliverable-by-deliverable, with evaluator checkpoints between each
phase.
