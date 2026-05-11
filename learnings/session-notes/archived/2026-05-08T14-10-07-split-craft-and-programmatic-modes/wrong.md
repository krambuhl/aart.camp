# What Claude produced

**Step 1 — Interactive skill recreated.** Authored `.claude/skills/griot-capture/SKILL.md` from scratch, scoped to interactive mode only. Body covers: gate decision tree (capture if non-obvious convention / subtle invariant / contradicts default; skip if typo / established pattern / never-stated preference; ask if in doubt); folder structure (`learnings/session-notes/<UTC-ts>-<slug>/`); file content shapes mirroring the script's builders (prompt distilled from triggering turn, wrong verbatim, correction verbatim, full transcript with turn markers, learning draft narrow + actionable); slug derivation (3-5 word kebab-case from the situation); after-write tell-the-user message. Explicit pointer to `Bash(node .claude/scripts/griot/capture.ts --from-checkin=... --correction-text="...")` for programmatic from-checkin captures. Final length ~110 lines, well under the 190-line original.

**Step 2 — Script argument switch.** Removed `--correction-index` from `parseArgs` options; added `--correction-text`. Removed the index-validation logic. Added correction-selection function `selectCorrection(corrections, requestedText)`:
  - If requestedText is undefined and corrections.length === 1 → return corrections[0].
  - If requestedText is undefined and corrections.length > 1 → throw `ambiguous: checkin has N correction lines; pass --correction-text=<one of: ...>` with first 60 chars of each.
  - If requestedText is provided → normalize whitespace on both sides (collapse runs of any whitespace to a single space, trim) and exact-equality match. If no match → throw `correction text not found in checkin; available: <list>`.
  - The match function preserves case sensitivity and content; only whitespace varies.

**Step 3 — Test updates.** Removed three index-based test cases (`--correction-index=0`, `--correction-index=1`, `--correction-index out of range`). Added five text-based test cases:
  - `--correction-text exact match captures the correct correction` (multi-correction checkin)
  - `--correction-text matches a wrapped correction after whitespace normalization` (passes the joined-line text, matches the wrapped source)
  - `--correction-text not found fails with available list` (text doesn't match any correction)
  - `multi-correction checkin without --correction-text fails as ambiguous` (no auto-select)
  - `single-correction checkin without --correction-text succeeds (zero-config)` (auto-selects the only correction)

**Step 4 — Caller migration.** Updated `/trout-save-session` step 4: invocation form changes from `--correction-index=<n>` to `--correction-text="<exact text>"`. Updated the "Capturing corrections" detail block at line ~95-110 with matching wording. Both prose examples show double-quoted shell argument since correction text may contain spaces, backticks, parens.

**Step 5 — Settings restored.** Re-added `Skill(griot-capture)` and `Skill(griot-capture:*)` permission entries to `.claude/settings.json`. The `Bash(node .claude/scripts/griot/*)` family permission added in checkin 03 stays — both invocation paths are now valid.

**Step 6 — Verification.** `npm run lint` clean; `npm run build` clean; `npm run test` 59→61 (5 added, 3 removed = +2 net). All pass. The skill registry now lists `griot-capture` again (visible in system-reminder skill list after the file is written).

**Step 7 — Pre-evaluation `git status`** (carry-over lesson): revert `next-env.d.ts` from `npm run build`. Confirm working tree state.
