# What Claude produced

**Step 1 — Read current Evaluate prose.** Both loops' Step 2.3 use near-identical wording: "Invoke `/guild-validate` via the `Skill` tool... `packet`: the Contract section verbatim, plus the artifact, plus the original ask." Verbatim contract inclusion is the main shape change.

**Step 2 — Author dense-packet wording.** Same wording in both loops with one-word swap (deliverable vs unit). Each Evaluate step now opens with: efficiency framing aimed at the evaluator agent (not the loop); the packet structure spelled out (Contract paraphrased + checkin path link, Artifact with pre-computed verification, Original ask); explicit "spot-check ONE or TWO criteria, then emit VERDICT" instruction; budget-exhaustion fallback (`VERDICT: flagged` + `parse-failure: budget-exhausted`).

**Step 3 — Verification.** `npm run lint` clean; `npm run build` clean; `npm run test` 75/75 pass (no script touched).

**Step 4 — Pre-evaluation `git status`** (carry-over lesson): revert `next-env.d.ts`. Confirm tree state.
