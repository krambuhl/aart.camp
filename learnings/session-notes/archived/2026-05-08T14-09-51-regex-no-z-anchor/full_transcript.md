# Checkin 05 — ev.agent-guilds.phase-1-5-substrate-cleanup-2

**Created**: 2026-05-06 19:10
**Phase**: 1.5 — Substrate primitive cleanup
**Unit**: Extract `guild-validate` parser to `.claude/scripts/guild/parse-and-aggregate.ts`

## Contract

**Goal**: Deliverable 5 of Phase 1.5 — shell extraction for `/guild-validate`. The skill stays as a skill (it's orchestration: composes `guild-spawn` via Skill + Agent in shared context, addressable as the panel coordinator handle), but its parse + aggregate epilogue extracts to a Node script. The parsing is pure CRUD: take an array of `{agent, output}` entries, walk each verdict per the documented rules, return the locked output shape. Bootstraps the `.claude/scripts/guild/` family (first script there); adds `Bash(node .claude/scripts/guild/*)` family permission. Last unit on this PR before merge.

**Acceptance criteria**:

- New `.claude/scripts/guild/parse-and-aggregate.ts` reads a JSON array of `{agent, output}` entries from stdin, returns the locked Result shape on stdout (`{verdict, blocking_findings, advisory_findings, cli_runs, conflicts}`). Verdict precedence per the skill spec: `conflicts` non-empty → `flagged-conflict`; else `blocking_findings` non-empty → `flagged`; else `approved`. v1 conflict detection is documented no-op (always returns `conflicts: []`).
- Verdict parsing per the existing skill rules: locate `VERDICT:` line; `approved` → no findings; `flagged` → extract Reasons section bullets as findings + optional Suggested remedies (paired by index); missing/unparseable VERDICT → record one `parse-failure` blocking finding for that evaluator. Severity: default `blocking`; explicit `BLOCKING:` / `ADVISORY:` prefix on a reason line routes accordingly.
- Each finding object has shape `{evaluator, code, evidence, remedy}`. `code` defaults to `criterion-unmet`; if the evidence text starts with `<word>(-<word>)*: ...` (kebab-style code prefix), the prefix becomes `code` and the rest becomes `evidence`.
- Sibling `.claude/scripts/guild/parse-and-aggregate.test.ts` with at least 12 cases. Coverage: empty stdin fail; non-JSON fail; non-array fail; invalid entry shape fail; single-evaluator approved → verdict approved; single-evaluator flagged with one reason → blocking finding emitted; reason with `BLOCKING:` / `ADVISORY:` prefix routed correctly; reason with `code: evidence` shape extracted; missing VERDICT line → parse-failure blocking; multiple evaluators mixed → aggregated correctly; suggested remedies pair with reasons by index; output shape locked (all five fields always present).
- Errors: `parse-and-aggregate-error: <reason>` to stderr, non-zero exit. Mirrors the substrate convention.
- `/guild-validate` SKILL.md updated: process steps 3 + 4 collapse to a single step that builds the JSON array from `guild-spawn`'s outputs and invokes the script via Bash with stdin (heredoc pattern). The existing prose describing the parsing rules stays as the SPEC the script implements (now lives in the SKILL.md as documentation; the script IS the implementation). Step numbering becomes 1, 2, **3 (parse and aggregate via script)**, 4 (return) — old step 5 renumbers.
- `.claude/settings.json` gains `Bash(node .claude/scripts/guild/*)` family permission (first guild script).
- `npm run lint` clean, `npm run build` clean, `npm run test` 60→72+ pass.
- The skill is NOT deleted — it remains the addressable orchestration handle that loops compose. Only its CRUD epilogue moves to the script.

**Rules applied**:

- `projects/CONVENTIONS.md` substrate primitive shapes — orchestration stays as skill ("Why orchestration stays a skill" subsection); shell extraction pattern applies for the deterministic CRUD epilogue.
- `autosave.ts` / `autoload.ts` / `capture.ts` as structural reference — same `parseArgs` + `fail()` + custom error class (though parseArgs is minimal here since input is stdin, not flags).
- The user's PR conventions: under 500 additions where feasible.
- Pre-evaluation `git status` for `next-env.d.ts` drift.

**Disqualifiers**:

- **Skill body deleted along with parse + aggregate**: orchestration must stay as skill — `/guild-validate` is composed by ev-loop and other loop styles via the Skill tool; deletion would break that composition path.
- **Locked output shape drifts**: downstream callers (loops, retry policies, PR builders) depend on `{verdict, blocking_findings, advisory_findings, cli_runs, conflicts}` being present even when empty. Tests must verify all five fields exist on every result.
- **Conflict detection prematurely implemented**: v1 explicitly leaves `conflicts: []`. Implementing detection now would couple to assumptions Phase 2 will revisit. Stay no-op per spec.
- **Parser drifts from documented rules**: the skill's process step 3 wording is the spec. Severity defaults, code-prefix extraction, remedy pairing — must match the prose exactly so existing evaluator outputs continue to parse correctly.
- **Stdin-handling fails on large inputs**: evaluator outputs can be 10-50KB each; aggregated across N evaluators, tens to hundreds of KB. `readFileSync(0)` blocks until EOF and handles that fine, but must not impose artificial size limits.
- **Permission entry forgotten**: `Bash(node .claude/scripts/guild/*)` must land in `.claude/settings.json`; otherwise loop invocations of guild-validate hit permission prompts on the new Bash call.

**Inputs**:

- `.claude/skills/guild-validate/SKILL.md` (target of edit; process steps 3+4 → script delegation; rules prose stays as documentation)
- `.claude/scripts/trout/autosave.ts` and recent siblings (structural reference)
- `.claude/agents/evaluator-base.md` (defines the verdict format the script parses; cross-referenced for spec fidelity)
- The skill's existing process step 3 + 4 prose (the spec)

## Scope

Files created:
- `.claude/scripts/guild/parse-and-aggregate.ts` (~165 lines, stdlib only)
- `.claude/scripts/guild/parse-and-aggregate.test.ts` (15 cases)
- `projects/2026-05-02-agent-guilds/checkins/ev.agent-guilds.phase-1-5-substrate-cleanup-2/05.md` (this checkin)

Files modified:
- `.claude/skills/guild-validate/SKILL.md` — process steps 3 + 4 collapsed into one step that delegates to the script via stdin heredoc; rules prose retained as the spec the script implements; old step 5 ("Return") becomes step 4
- `.claude/settings.json` — `Bash(node .claude/scripts/guild/*)` family permission added (between griot family and Skill entries)

External effects:
- None at commit time. Next loop invocation of `/guild-validate` exercises the new path.

## Execution

**Step 1 — Reference scan.** Re-read `/guild-validate` SKILL.md process steps 3 + 4 (the parsing + aggregation rules); read `.claude/agents/evaluator-base.md` for the verdict format the script must parse (`VERDICT: approved|flagged|flagged-conflict`, `Reasons:` bulleted, optional `Suggested remedies:` bulleted); cross-referenced `autosave.ts`/`autoload.ts`/`capture.ts` for substrate-script structural conventions.

**Step 2 — Script authored.** `.claude/scripts/guild/parse-and-aggregate.ts` with five logical pieces: type definitions for `AgentOutput` / `Finding` / `CliRun` / `Conflict` / `Verdict` / `Result`; `sliceFromHeader(headerRe, endRe)` helper plus `findReasonsBlock` / `findRemediesBlock` wrappers; `parseReason` (severity + code-prefix extraction with optional backticks + parenthetical context); `parseEvaluatorOutput` (verdict routing, finding extraction, remedy pairing by index); `aggregate` (verdict precedence per spec, conflicts hardcoded to `[]` with documented no-op comment); `main` reads stdin, validates JSON shape entry-by-entry with informative errors, prints the locked Result on stdout.

**Step 3 — Test authored.** 15 cases covering: error paths (empty stdin, non-JSON, non-array, missing agent/output fields); approved happy path with locked output shape; single flagged with one reason → blocking finding emitted; explicit BLOCKING:/ADVISORY: prefix routing; default code (criterion-unmet) when no prefix; backtick + parenthetical code-prefix extraction (mirrors the actual format `evaluator-contract-fit` emitted in checkin 01's panel run 1); missing VERDICT → parse-failure blocking; multi-evaluator mixed (one approved, one flagged) aggregated correctly; remedies paired with reasons by index; locked output shape (all five fields always present).

**Step 4 — Bug caught at first test run.** Initial regex used `\Z` (end-of-string anchor from Perl/Python) which JavaScript regex does not support. Test for "remedies paired with reasons by index" failed — the lookahead `(?=^header|\Z)` wasn't matching end-of-input. Fixed by replacing both regexes with an index-based `sliceFromHeader(headerRe, endRe)` helper that finds the header position and slices to the next end-marker or end-of-string. All 75 tests pass after fix. Same JS-regex-gotcha class as the autoload line-wrap regex in checkin 01.

**Step 5 — Skill update.** `/guild-validate` SKILL.md process steps 3 + 4 collapsed into a single new step 3 (Parse and aggregate). Step body now opens with the heredoc invocation pattern, then preserves the rules prose under "the rules below are the spec it implements." Old step 5 ("Return") renumbers to step 4. Skill body itself is preserved — orchestration stays as skill per CONVENTIONS.md "Why orchestration stays a skill" subsection.

**Step 6 — Permission entry.** `.claude/settings.json` gains `Bash(node .claude/scripts/guild/*)` between the griot family permission (added in checkin 03) and the Skill(*) entries. Three substrate families now have wildcard permissions: trout (PR #10), griot (checkin 03), guild (this checkin).

**Step 7 — Verification.** `npm run lint` clean; `npm run build` clean; `npm run test` 75/75 (60 prior + 15 new).

**Step 8 — Pre-evaluation `git status`** (carry-over lesson): revert `next-env.d.ts` from `npm run build`. Confirm working tree state.

## Notes for PR

- Three script families now in the substrate (trout / griot / guild). The parseArgs + fail() + custom-error-class shape held across all four scripts (autosave / autoload / capture / parse-and-aggregate). Substrate consistency is paying off — no caller has to relearn output shapes between scripts.
- `/guild-validate` is now the first **shell extraction** in the substrate (per CONVENTIONS.md): orchestration body stays in the skill (composes Skill + Agent in shared context, addressable by other loops), CRUD epilogue extracts to a script. The split is clean — the rules prose lives in the SKILL.md as the spec, the script IS the implementation. If the spec changes, both update; the test suite keeps them in sync.
- correction: JavaScript regex does not support `\Z` (end-of-string anchor) — same gotcha as the autoload line-wrap bug in checkin 01. The pattern that works is index-based slicing (find header position, slice to next end-marker or `string.length`). Avoid Perl-style anchors in any future substrate parsers; always use position-based slicing instead.
- Stdin input was the right call over `--input=<json>` flag: ARG_MAX limits would bite for multi-evaluator panels with long outputs (10-50KB each × N evaluators). The heredoc invocation pattern in the SKILL.md keeps shell escaping straightforward (`<<'GUILD_INPUT'` is unquoted-pass-through).
- v1 conflict detection is a documented no-op (`conflicts: []` always). The locked output shape includes the `conflicts` field even when empty so downstream callers (loops, retry policies, PR builders) write conflict-handling code now that's ready when Phase 2's multi-evaluator panels start producing real conflicts.
- The script's code-prefix regex handles three forms observed in real evaluator outputs: bare `criterion-unmet:`, backtick-wrapped `` `criterion-unmet`: ``, and backtick + parenthetical context `` `disqualifier-fired` ("..."): ``. Tests cover all three plus the no-prefix fallback (default `criterion-unmet`).
- This is the last unit on PR #13. Phase 1.5 deliverables 6-12 remain in the plan but ship in subsequent PRs.
- Reviewers should focus on: (1) does the locked Result shape feel future-proof for Phase 2's multi-evaluator panels with real CLI runs and conflicts; (2) is the rules-prose-as-spec / script-as-implementation pattern in `/guild-validate` SKILL.md the right shape (or should the rules move into a separate spec file); (3) does the heredoc invocation pattern feel ergonomic enough, or should the script gain `--input-file=<path>` as an alternative for large payloads.

## Evaluator verdict

approved (panel run 1 of 1; 1 tool use — best efficiency of the session; verified verdict precedence, parsing rules, remedy pairing, locked output shape, and the skill-stays-deletion-doesn't disqualifier; no flags fired).
