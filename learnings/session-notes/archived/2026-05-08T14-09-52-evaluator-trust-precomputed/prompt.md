# Triggering prompt (distilled)

## Unit

Codify dense-packet pattern in both ev-loop skills' Evaluate step

## Goal

Promote the dense-packet pattern observed across this PR's evaluator panel runs (3 → 1 tool uses across checkins 01 → 05) from session-specific tactic to substrate convention. Both `/ev-loop-confidence` and `/ev-loop-interactive` Step 2 "Evaluate" wording updates: the packet's Contract section becomes a paraphrased inline summary (not verbatim) with a path-link to the checkin file for depth; the Artifact section includes pre-computed verification results so the evaluator doesn't re-run them; an opening framing tells the evaluator to trust pre-computed results and spot-check at most one or two criteria; an explicit budget-exhaustion fallback ("if you can't reach a verdict, emit `VERDICT: flagged` with `parse-failure: budget-exhausted`") so the loop escalates rather than no-ops on timeout.

## Acceptance criteria

- `/ev-loop-confidence` Step 2.3 "Evaluate" rewritten with the dense-packet shape: framing on efficiency at the top of the packet; paraphrased contract inline (with checkin-file path link for depth); pre-computed verification results inline (lint/build/test outcomes + relevant grep results + smoke-test outputs); explicit "spot-check at most ONE or TWO criteria with targeted reads, then emit VERDICT" instruction; budget-exhaustion fallback.
- `/ev-loop-interactive` Step 2.3 "Evaluate" updated identically. The two loops share the packet shape — only differ in what they call the unit (tier/batch vs deliverable).
- The substrate convention is named ("dense packet") so future updates can reference it. Brief justification cites the empirical evidence (PR #13 checkin 01 → 05 efficiency curve under maxTurns=5).
- Both edits stay scoped to the Evaluate step. No changes to other steps, no broader ev-loop refactor, no `/guild-validate` skill changes (the script and skill are agnostic to packet shape — that's a caller concern).
- Self-documenting: this checkin's own evaluator panel run uses the new dense-packet pattern. If the new pattern works, this checkin approves on run 1 with low tool-use count.
- `npm run lint` clean, `npm run build` clean, `npm run test` 75/75 pass (no script changes).
