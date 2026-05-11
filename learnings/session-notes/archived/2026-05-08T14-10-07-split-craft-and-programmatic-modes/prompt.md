# Triggering prompt (distilled)

## Unit

Restore interactive `/griot-capture` + switch script to `--correction-text`

## Goal

Two refinements responding to PR #13 review feedback on checkin 03's structural retreats. (1) Restore an interactive `/griot-capture` skill — kept thin, LLM-driven, in-session craft-work flow that uses the live transcript + capture gate; writes the 5 files directly via the Write tool (no script roundtrip). The from-checkin path stays in the script; the two modes are now cleanly separated by primitive (skill = interactive, script = programmatic). (2) Switch the script's correction-selection argument from `--correction-index=<N>` (fragile; reordering correction lines silently re-pairs captures) to `--correction-text=<exact text>` (safe; whitespace-tolerant exact match against the extracted correction lines). Update `/trout-save-session` to pass `--correction-text` instead of `--correction-index`.

## Acceptance criteria

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
