# Checkin 04 — ev.agent-guilds.phase-1-5-substrate-cleanup-2

**Created**: 2026-05-06 17:55
**Phase**: 1.5 — Substrate primitive cleanup
**Unit**: Restore interactive `/griot-capture` + switch script to `--correction-text`

## Contract

**Goal**: Two refinements responding to PR #13 review feedback on checkin 03's structural retreats. (1) Restore an interactive `/griot-capture` skill — kept thin, LLM-driven, in-session craft-work flow that uses the live transcript + capture gate; writes the 5 files directly via the Write tool (no script roundtrip). The from-checkin path stays in the script; the two modes are now cleanly separated by primitive (skill = interactive, script = programmatic). (2) Switch the script's correction-selection argument from `--correction-index=<N>` (fragile; reordering correction lines silently re-pairs captures) to `--correction-text=<exact text>` (safe; whitespace-tolerant exact match against the extracted correction lines). Update `/trout-save-session` to pass `--correction-text` instead of `--correction-index`.

**Acceptance criteria**:

- New `.claude/skills/griot-capture/SKILL.md` exists, scoped to **interactive mode only**. Frontmatter: `user-invocable: true`, `allowed-tools: Bash, Read, Write`. Body covers: capture gate (the "would a reasonable Claude have gotten this wrong?" decision); the 5-file folder structure with the same content shape as the script (prompt.md, wrong.md, correction.md, full_transcript.md, learning.md); LLM writes the files directly via Write tool; UTC-ts + slug derivation matching the script's format. Explicit pointer to `Bash(node .claude/scripts/griot/capture.ts --from-checkin=...)` for programmatic captures.
- Script argument surface changes: `--correction-index=<N>` removed, `--correction-text=<text>` added. Both `--correction-text` and `--slug` remain optional. Behavior:
  - If `--correction-text` is provided: find the correction line that matches (after whitespace normalization on both sides). If no match, fail with `correction text not found in checkin; available: <comma-separated first-30-chars-each>`.
  - If `--correction-text` is omitted AND the checkin has exactly one correction: use that one (zero-config single-correction case).
  - If `--correction-text` is omitted AND the checkin has multiple corrections: fail with `ambiguous: checkin has <N> correction lines; pass --correction-text=<one of: ...>` listing the first 60 chars of each.
- `/trout-save-session` step 4 + "Capturing corrections" detail block updated: argument moves from `--correction-index=<n>` to `--correction-text="<exact text>"`. Quoting in the prose example uses double quotes since correction text may contain shell metacharacters.
- Capture script tests updated:
  - Remove the `--correction-index=0` and `--correction-index=1` and `--correction-index out of range` cases (they tested the old API).
  - Add cases for: `--correction-text=<exact match>` happy path; `--correction-text` with whitespace-normalized match (e.g. text passed without internal newlines matches a wrapped correction); `--correction-text` no match → fail with informative error listing available corrections; multi-correction checkin without `--correction-text` → fail with ambiguous error; single-correction checkin without `--correction-text` → succeeds (zero-config).
- New `/griot-capture` skill tested by structural review (no automated test for skill bodies — they're LLM-shaped). Manual sanity check: skill body covers gate, folder structure, file shapes, slug derivation, pointer to script for programmatic mode.
- `npm run lint` clean, `npm run build` clean, `npm run test` passes.

**Rules applied**:

- `projects/CONVENTIONS.md` substrate primitive shapes — interactive mode is LLM-shaped, lives in a skill. From-checkin mode is CRUD, lives in a script. Two clean primitives, not one split-brain.
- "Shell extraction" pattern from CONVENTIONS.md is *not* what's happening here — there's no shared CRUD epilogue between the two modes. The skill writes its own files via Write; the script writes its own files via fs.writeFileSync. They share only the format spec (which is documented in both places, since markdown docs are cheap and a shared module would over-engineer).
- The user's PR conventions: under 500 additions where feasible.
- Pre-evaluation `git status` for `next-env.d.ts` drift.

**Disqualifiers**:

- **Interactive skill drifts from script's file format**: the 5 files must match shape across modes (otherwise compaction sees inconsistent shapes). The skill body's prose for each file's content shape mirrors the script's builder functions.
- **Script silently accepts the old `--correction-index`**: backward-compat would invite ambiguity. The argument is removed cleanly; passing it now triggers the parseArgs unknown-option error.
- **Whitespace-normalization is too aggressive**: matching should tolerate line-wrap differences (newline → space) but not lose case sensitivity or substantively different content. Single-pass normalize-whitespace and strict equality on the result.
- **Ambiguous-without-text error is unhelpful**: must list the available corrections (truncated to 60 chars each) so the caller can copy-paste one of them as `--correction-text=`.
- **Skill body bloated**: the new griot-capture skill should be small. The OLD skill was ~190 lines covering both modes. Interactive-only should be ~80-120 lines. If the skill grows past that, it's likely keeping deleted from-checkin content.
- **`/trout-save-session` examples not updated**: the prose examples in step 4 + "Capturing corrections" detail must show the new argument form. Reviewers reading the skill rely on those examples.

**Inputs**:

- `.claude/scripts/griot/capture.ts` (target of edit; argument-surface change)
- `.claude/scripts/griot/capture.test.ts` (target of edit; test coverage for new arg surface)
- `.claude/skills/griot-capture/SKILL.md` (new file; interactive-mode skill)
- `.claude/skills/trout-save-session/SKILL.md` (target of edit; argument form in two places)
- `.claude/settings.json` (re-add `Skill(griot-capture)` permissions since the skill returns)
- The original deleted skill (commit 4e966f7) as reference for the gate + file-shape language

## Scope

Files modified:
- `.claude/scripts/griot/capture.ts` — `--correction-index` removed; `--correction-text` added with whitespace-tolerant matching; ambiguous-without-text error path
- `.claude/scripts/griot/capture.test.ts` — index-based tests removed; text-based tests added (5 cases covering happy path, whitespace tolerance, no-match error, ambiguous error, single-correction zero-config)
- `.claude/skills/trout-save-session/SKILL.md` — step 4 + "Capturing corrections" detail block both updated to use `--correction-text` with double-quoted shell example
- `.claude/settings.json` — re-add `Skill(griot-capture)` and `Skill(griot-capture:*)` since the skill returns (the `Bash(node .claude/scripts/griot/*)` family permission added in checkin 03 stays)

Files created:
- `.claude/skills/griot-capture/SKILL.md` — new interactive-only griot-capture skill (~100 lines)
- `projects/2026-05-02-agent-guilds/checkins/ev.agent-guilds.phase-1-5-substrate-cleanup-2/04.md` (this checkin)

External effects:
- None at commit time.

No source code in `app/`, `components/`, `sketches/`, `lib/`, `tokens/` touched.

## Execution

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

## Evaluator verdict

approved (panel run 1 of 1; 3 tool uses; verified the three branches of `selectCorrection`, confirmed `normalizeWhitespace` preserves case and punctuation, confirmed `parseArgs` rejects the removed `--correction-index` argument cleanly).

## Notes for PR

- Two cleanly-separated primitives now: skill for interactive (LLM-driven gate + transcript-reading + Write), script for programmatic (deterministic from-checkin derivation). They share the file-format spec (documented in both places — markdown is cheap, shared module would over-engineer for two callers). If a third caller needed the same format, that's the moment to extract.
- `--correction-text` is whitespace-tolerant (collapses runs of whitespace to single spaces on both sides, then strict equality) so callers don't have to reproduce exact line-wrap. Case and content otherwise preserved. Wrapped corrections in checkins (which the extractor joins into one logical line) match cleanly when the caller passes the joined form.
- The `--correction-index` removal is not backward-compat-friendly. Within this PR's branch, no caller uses the old form by the time this lands; outside the PR, no other repo uses it. The clean break is the right call.
- The interactive skill's gate (capture decision) is unchanged from the original: "would a reasonable Claude have gotten this wrong by default?" with the same capture-if and don't-capture-if rules. The gate is genuinely LLM-shaped (judgment, not rules) — keeping it in a skill is correct per the substrate primitive shapes convention.
- correction: Don't lose user-facing workflows when a migration target is "delete the skill" — the in-conversation `/griot-capture` for craft work was a real workflow that PLAN's deliverable wording missed. Restoring it as a thin interactive-only skill (with from-checkin moved to the script) is the cleaner shape than the original both-modes-in-one-skill design. Lesson for future migrations: when a skill has a craft-work mode AND a programmatic mode, split them by primitive (skill vs script) rather than collapsing both into one.
- correction: Index-based selection in scripts that pick from a list (e.g. `--correction-index=N`) is fragile when the list can be reordered. Text-based selection with whitespace-tolerant match is the safer default — if the source list changes, the script either still finds the text or fails loudly with the available options. Apply this pattern to similar situations in the substrate (e.g. picking a checkin from a branch).
- Reviewers should focus on: (1) is the interactive skill body's gate + file-shape prose tight enough, or has redundancy crept back in; (2) is `--correction-text` whitespace normalization correct (does it ever match too aggressively or fail too aggressively); (3) is the dual-callsite update in `/trout-save-session` (step 4 + detail block) consistent — both should show identical argument form.
