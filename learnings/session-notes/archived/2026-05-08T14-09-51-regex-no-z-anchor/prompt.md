# Triggering prompt (distilled)

## Unit

Extract `guild-validate` parser to `.claude/scripts/guild/parse-and-aggregate.ts`

## Goal

Deliverable 5 of Phase 1.5 — shell extraction for `/guild-validate`. The skill stays as a skill (it's orchestration: composes `guild-spawn` via Skill + Agent in shared context, addressable as the panel coordinator handle), but its parse + aggregate epilogue extracts to a Node script. The parsing is pure CRUD: take an array of `{agent, output}` entries, walk each verdict per the documented rules, return the locked output shape. Bootstraps the `.claude/scripts/guild/` family (first script there); adds `Bash(node .claude/scripts/guild/*)` family permission. Last unit on this PR before merge.

## Acceptance criteria

- New `.claude/scripts/guild/parse-and-aggregate.ts` reads a JSON array of `{agent, output}` entries from stdin, returns the locked Result shape on stdout (`{verdict, blocking_findings, advisory_findings, cli_runs, conflicts}`). Verdict precedence per the skill spec: `conflicts` non-empty → `flagged-conflict`; else `blocking_findings` non-empty → `flagged`; else `approved`. v1 conflict detection is documented no-op (always returns `conflicts: []`).
- Verdict parsing per the existing skill rules: locate `VERDICT:` line; `approved` → no findings; `flagged` → extract Reasons section bullets as findings + optional Suggested remedies (paired by index); missing/unparseable VERDICT → record one `parse-failure` blocking finding for that evaluator. Severity: default `blocking`; explicit `BLOCKING:` / `ADVISORY:` prefix on a reason line routes accordingly.
- Each finding object has shape `{evaluator, code, evidence, remedy}`. `code` defaults to `criterion-unmet`; if the evidence text starts with `<word>(-<word>)*: ...` (kebab-style code prefix), the prefix becomes `code` and the rest becomes `evidence`.
- Sibling `.claude/scripts/guild/parse-and-aggregate.test.ts` with at least 12 cases. Coverage: empty stdin fail; non-JSON fail; non-array fail; invalid entry shape fail; single-evaluator approved → verdict approved; single-evaluator flagged with one reason → blocking finding emitted; reason with `BLOCKING:` / `ADVISORY:` prefix routed correctly; reason with `code: evidence` shape extracted; missing VERDICT line → parse-failure blocking; multiple evaluators mixed → aggregated correctly; suggested remedies pair with reasons by index; output shape locked (all five fields always present).
- Errors: `parse-and-aggregate-error: <reason>` to stderr, non-zero exit. Mirrors the substrate convention.
- `/guild-validate` SKILL.md updated: process steps 3 + 4 collapse to a single step that builds the JSON array from `guild-spawn`'s outputs and invokes the script via Bash with stdin (heredoc pattern). The existing prose describing the parsing rules stays as the SPEC the script implements (now lives in the SKILL.md as documentation; the script IS the implementation). Step numbering becomes 1, 2, **3 (parse and aggregate via script)**, 4 (return) — old step 5 renumbers.
- `.claude/settings.json` gains `Bash(node .claude/scripts/guild/*)` family permission (first guild script).
- `npm run lint` clean, `npm run build` clean, `npm run test` 60→72+ pass.
- The skill is NOT deleted — it remains the addressable orchestration handle that loops compose. Only its CRUD epilogue moves to the script.
