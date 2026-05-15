# Checkin 01 — ev.agent-guilds.phase-1-5-substrate-cleanup-2

**Created**: 2026-05-06 05:05
**Phase**: 1.5 — Substrate primitive cleanup
**Unit**: Migrate `/trout-autoload` to `.claude/scripts/trout/autoload.ts`

## Contract

**Goal**: Move the briefing-orientation primitive from a markdown skill (`/trout-autoload`) to a Node script (`.claude/scripts/trout/autoload.ts`), preserving output shape and resolution semantics. This is deliverable 3 of Phase 1.5; same shape as deliverable 2 (`trout-autosave`). The work is pure CRUD — read MANIFEST.md, config.md, latest session handoff, latest checkin; check `git branch --show-current` for drift; emit the briefing markdown on stdout. The skill body is no longer carrying its weight as an LLM-shaped primitive — its only "judgment" is a rule-based suggested-next-action decision tree, which translates cleanly to deterministic code.

**Acceptance criteria**:

- New file `.claude/scripts/trout/autoload.ts` produces a briefing on stdout matching the existing skill's Output format byte-for-byte for an unchanged project: project header (`## Project orientation: <title> (<slug>)`), `Status` + `Branch (manifest → actual)` line, `### Phases` table copy, `### Current state` copy, optional `### Last checkin (<NN>, <when>)` block (Unit / Verdict / Notes — omitted when no Latest checkin resolves), optional `### Last session (<filename>)` block (Open threads copied verbatim — omitted when sessions/ is empty or missing), optional `### Config highlights` (Verification / PR base — omitted when no config.md), optional `> Drift: ...` line (only when manifest branch ≠ git branch), and `### Suggested next action`.
- Sibling `.claude/scripts/trout/autoload.test.ts` exercises: project resolution forms (exact slug / suffix match / `./` path / archive-reject), missing-manifest stop, missing-sessions skip, missing-checkin skip, missing-config skip, drift detection emits the `> Drift:` line, omission rules for each optional section, suggested-next-action branches (all-completed → archive, in-progress + fresh checkin + no PR → trout-pull-request, in-progress + open PR → caller-decides, not-started + deps satisfied → loop, not-started + waiting on PR → name the blocker). At least 12 cases. `node:test`, runs via `npm run test`.
- Argument surface: single positional `<project-slug-or-path>`. Empty arg → list active projects under `projects/` (excluding `archive/`) on stderr and exit non-zero with a "specify a project" message. Path/slug resolution mirrors `autosave.ts` exactly (exact slug → suffix match → full path; archive paths rejected with the same wording).
- Errors: `autoload-error: <reason>[; candidates: ...]` to stderr, non-zero exit. Same shape as `autosave.ts`'s `fail()` helper.
- Manifest schema (Phase columns, status values), event vocabulary, and any other CONVENTIONS-defined data parsed from `projects/CONVENTIONS.md` at runtime; hardcoded fallback only on read failure. No duplicated TypeScript consts where CONVENTIONS is authoritative.
- All call sites of `Skill(skill: "trout-autoload", ...)` updated to `Bash("node .claude/scripts/trout/autoload.ts <slug>")`. After migration: `grep -rn 'trout-autoload' .claude/` returns only the new script, the new test, and any historical reference comments — no live `Skill` invocations and no skill directory.
- Old skill directory `.claude/skills/trout-autoload/` deleted.
- `npm run lint` clean, `npm run build` clean, `npm run test` passes (20 existing autosave tests + new autoload tests, all green).
- Self-smoke: `node .claude/scripts/trout/autoload.ts agent-guilds` produces an orientation briefing equivalent to the one the router consumed at the top of this session (current branch matches manifest now, so no drift line).

**Rules applied**:

- `projects/CONVENTIONS.md` "Substrate scripts: layout and conventions" — TypeScript stdlib only, `parseArgs` from `node:util`, sibling `.test.ts`, runtime parsing of CONVENTIONS.md, `<verb>-error:` stderr format, single ESM source under `.claude/scripts/trout/`.
- Project conventions per `~/.claude/CLAUDE.md` and `aart.camp/.claude/CLAUDE.md`: terse, no speculative abstractions, no extra error handling beyond system boundaries.
- `autosave.ts` as structural reference — same `parseArgs` shape, same `fail()` + custom error class, same project resolution helpers, same CONVENTIONS-parsing pattern. Substrate consistency over local cleverness.
- Pre-evaluation `git status` to catch `next-env.d.ts` drift from `npm run build` (carry-over lesson from prior checkins).

**Disqualifiers**:

- **Output divergence from the skill** for any section of the briefing — wording differences, reordered sections, omission-rule mismatches, drift-line phrasing, suggested-next-action sentence drift.
- **Hardcoded CONVENTIONS data without runtime read attempt** — event vocabulary, status enum, and similar must come from CONVENTIONS.md when available, with a fallback only on read failure.
- **Call sites left dangling** — any unmigrated `Skill(skill: "trout-autoload", ...)` is a regression; the substrate breaks silently at the next router invocation.
- **Skill deletion sequenced before call-site update** — would break in-flight invocations during the diff. Order: write script + tests, update callers, delete skill last.
- **Insufficient test coverage** — tests must exercise the suggested-next-action decision tree and the section-omission rules, not only the happy path.
- **Manifest parser drift** — if the script parses Phases / Current state / Latest checkin differently than `autosave.ts`'s writer expects, future round-trips break. Reuse autosave's row/section parsing helpers where shapes overlap; lift to a shared helper only if it's the obvious move (otherwise duplicate, since substrate scripts are stdlib-only and we've avoided shared modules so far).
- **Crashes on legitimate edge cases**: missing `sessions/` directory, missing `config.md`, unresolvable Latest checkin path, archived project — must fail clean, not throw.
- **Bloat past justification** — `autosave.ts` is ~480 lines; autoload will likely be similar (more parsers, no init path). Well past that suggests over-engineering.

**Inputs**:

- `.claude/skills/trout-autoload/SKILL.md` — the briefing-format spec being migrated; the script must reproduce its Output format and Suggested-next-action logic.
- `.claude/scripts/trout/autosave.ts` and `autosave.test.ts` — reference implementation; structural model.
- `projects/CONVENTIONS.md` — manifest schema, event vocabulary, substrate script conventions.
- Real-world parse targets: `MANIFEST.md` of `2026-05-02-agent-guilds` and `2026-04-25-adopt-biome` (used in self-smoke).
- Call sites: any file under `.claude/` invoking `Skill(skill: "trout-autoload", ...)` or referencing the skill in prose. Identified via `grep -rn 'trout-autoload' .claude/`.

## Scope

Files created:
- `.claude/scripts/trout/autoload.ts` (~290 lines, ~150 fewer than autosave since no init path)
- `.claude/scripts/trout/autoload.test.ts` (21 cases)
- `projects/2026-05-02-agent-guilds/checkins/ev.agent-guilds.phase-1-5-substrate-cleanup-2/01.md` (this checkin)

Files modified:
- `.claude/settings.json` — removed `Skill(trout-autoload)` and `Skill(trout-autoload:*)` permission entries (the `Bash(node .claude/scripts/trout/*)` family permission already covers the new invocation path)
- `.claude/skills/ev-run/SKILL.md` — `Reads state via /trout-autoload` → `Reads state via .claude/scripts/trout/autoload.ts`; Step 1 invocation `Invoke /trout-autoload <slug>` → `Invoke Bash("node .claude/scripts/trout/autoload.ts <slug>")`
- `.claude/skills/ev-loop-confidence/SKILL.md` — Composes line gains autoload.ts; Step 0 pre-flight invocation rewritten as Bash
- `.claude/skills/ev-loop-interactive/SKILL.md` — same as confidence (Composes + Step 0)
- `.claude/skills/trout-save-session/SKILL.md` — single doc-reference paragraph in step 1 updated from `(resolution rules as in /trout-autoload)` to `(resolution rules as in .claude/scripts/trout/autoload.ts)`

Files deleted:
- `.claude/skills/trout-autoload/` (directory + SKILL.md)

External effects (not in the diff):
- None — script is read-only against MANIFEST/config/sessions/checkins; only stdout output.

The carry-over `.claude/settings.local.json` user-specific drift is intentionally left alone per the session-handoff guidance (contains stale `Skill(trout-autoload)` entries that will become dead permissions but are not blocking; opportunistic cleanup for the user when convenient). No source code in `app/`, `components/`, `sketches/`, `lib/`, `tokens/` touched.

## Execution

**Step 1 — Reference scan.** Read `.claude/skills/trout-autoload/SKILL.md` to anchor the briefing format and suggested-next-action decision tree; read `.claude/scripts/trout/autosave.ts` and `autosave.test.ts` for structural model; read `projects/CONVENTIONS.md` for substrate-script conventions; identified call sites via `grep -rn 'trout-autoload' .claude/` (5 active references across 4 skill files + 2 settings entries, plus the skill itself).

**Step 2 — Script authored.** `.claude/scripts/trout/autoload.ts` mirrors `autosave.ts`'s structure: same `parseArgs`-based arg surface (single positional, no flags), same `fail()` + `AutoloadError` pattern for stderr-with-non-zero-exit, same project resolution helpers (exact slug → suffix → path; archive paths refused with same wording). Parsers for the four sources (manifest / config / session / checkin) handle the documented optional cases — missing config, missing sessions/, unresolvable Latest checkin path, missing Notes-for-the-PR section — by returning null/empty rather than throwing. The suggested-next-action decision tree implements the five branches from the skill's spec: archive (all completed), resolve-blocker (any blocked), trout-pr-respond (in-progress + open PR), trout-pull-request (in-progress + fresh checkin + no PR), ev-run (not-started + deps satisfied), name-the-PR (not-started + waiting). Drift line emits only when `git branch --show-current` is non-empty AND differs from the manifest's Current branch field.

**Step 3 — Test authored.** `.claude/scripts/trout/autoload.test.ts` runs the script via `execFileSync('node', [SCRIPT, ...args])` against fixtures built in `mkdtempSync` temp dirs (same pattern as autosave's tests). 21 cases: empty-arg path with active-projects listing, four resolution-form cases (exact / suffix / multi / archive-rejected), missing-manifest fail, briefing-content smoke, three section-omission cases (Last checkin / Last session / Config highlights), three section-inclusion cases, two drift-detection cases (with-git-init using `execFileSync('git', ['init', '-q', '-b', branch], ...)` for branch-checkout fidelity), four suggested-next-action branches (all-completed / in-progress+PR / in-progress+checkin+no-PR / not-started+deps-satisfied / not-started+waiting), one parser-leniency case (`Notes for PR` short-form header).

**Step 4 — Initial test run.** All 41 tests pass (20 autosave + 21 autoload). Smoke against the real `agent-guilds` project produces the full briefing with all expected sections.

**Step 5 — Lenient header tightening.** Smoke revealed checkin 02's `## Notes for PR` header (no "the") doesn't match CONVENTIONS.md's `## Notes for the PR`. Project's actual practice diverges from the spec. Updated parser regex to `^## Notes for (?:the )?PR$/m` to accept both forms; added explicit test case (`parses Notes section under either "Notes for the PR" or "Notes for PR" header`) so the tolerance can't quietly regress.

**Step 6 — Caller migration.** Five edits in parallel: `ev-run` (description sentence + Step 1 invocation), `ev-loop-confidence` (Composes line + Step 0 invocation), `ev-loop-interactive` (Composes line + Step 0 invocation), `trout-save-session` (resolution-rules doc reference), `.claude/settings.json` (drop `Skill(trout-autoload)` + `Skill(trout-autoload:*)`). Composes lines on both ev-loop skills now list both autosave.ts and autoload.ts grouped as `(both via Bash)` to keep the line readable.

**Step 7 — Skill deletion.** `.claude/skills/trout-autoload/` removed via `rm -rf` last, after callers updated. Verification: `grep -rn 'trout-autoload' .claude/` returns only the user-local `.claude/settings.local.json` permission entries (intentional carry-over per session notes).

**Step 8 — Verification.** `npm run lint` clean (2 pre-existing broken-symlink warnings on unrelated `.claude/skills/frontend-design` and `.claude/skills/vercel-react-best-practices` — same warnings present at pre-flight, not caused by this unit). `npm run build` clean. `npm run test` 41/41 green. `next-env.d.ts` reverted via `git checkout --` (same `npm run build` side effect as prior checkins).

**Step 9 — Self-smoke confirmation.** `node .claude/scripts/trout/autoload.ts agent-guilds` returns the full briefing — Project header / Status + Branch (no drift, since manifest and git agree on `ev.agent-guilds.phase-1-5-substrate-cleanup-2`) / Phases table / Current state / Last checkin (02 from prior branch, since the manifest's `Latest checkin` field still points there until this branch's first checkin lands) / Last session (2026-05-06-a) with open threads / Config highlights with verification commands and PR base / Suggested next action correctly identifying "in-progress + fresh checkin + no open PR → run /trout-pull-request". The "fresh checkin" pointing to the prior-branch's checkin-02 is honest — it IS the latest checkin substrate-wise, and is the right pointer for the trout-pull-request suggestion until this branch's 01 is autosaved.

**Step 10 — Evaluator-flagged: CONVENTIONS-runtime-read missing.** First panel run via `/guild-validate` flagged the unit on disqualifier "Hardcoded CONVENTIONS data without runtime read attempt." The script never opened `projects/CONVENTIONS.md`; the autosave precedent (which parses Event vocabulary at runtime with `loadEventVocabulary()` + `FALLBACK_VOCABULARY`) was the right model and not followed. Phase status string literals (`'completed'`, `'in-progress'`, etc.) lived inline in `suggestNextAction` without any read attempt or fallback path. Fix: added `loadPhaseStatuses()` mirroring autosave's pattern (read CONVENTIONS, parse the `**Status values for a phase**` line for backtick-wrapped tokens, fall back to `FALLBACK_PHASE_STATUSES` const on read failure or parse failure); plumbed the loaded set through `parseManifest` → `parsePhasesTable` as a validation layer; unknown phase statuses now throw `AutoloadError` with the same shape as autosave's unknown-event error. Default test fixture writes a minimal `CONVENTIONS.md`; added two new tests — one exercising the runtime-read path (CONVENTIONS with extra status `paused` accepted) and one exercising the fallback path (no CONVENTIONS, manifest with `paused` fails with informative error listing known statuses).

**Step 11 — Smoke caught a regex bug.** Initial regex `^\*\*Status values for a phase\*\*:\s*(.+)$/m` only matched the first line of the wrapped CONVENTIONS line ("`not-started`, `in-progress`, `blocked`,") and missed `completed` on the continuation line. Real-project smoke against `agent-guilds` immediately failed with `unknown phase status "completed"`. Fixed by widening the regex to `[\s\S]+?` with a lookahead for paragraph break (`\n\n`) or next section (`\n##`). Added an explicit regression test for the line-wrap case so the parser stays robust as CONVENTIONS edits inevitably re-format the line. Re-smoke succeeds. 44/44 tests pass.

## Evaluator verdict

approved (panel run 3 of 3 — first run flagged the missing CONVENTIONS-runtime-read; second run timed out mid-investigation against the maxTurns=5 budget; third run confirmed the fix is wired in correctly with the runtime-read pattern matching autosave's, and noted the user-local `.claude/settings.local.json:39-40` stale entries as out-of-scope cleanup, not blocking).

## Notes for PR

- Mirror migration of deliverable 2's autosave shape: same patterns, same conventions, same tradeoffs. The substrate convention is now exercised by two scripts, which is the first real test of "substrate consistency over local cleverness."
- Decision recorded in the contract: parsing helpers that overlap with autosave (`parseRowCells`, table extraction, the `## Phases` / `## Current state` section locators) are duplicated in autoload.ts rather than lifted to a shared module. Substrate scripts are stdlib-only and we have no shared modules yet; introducing the first one for two callers feels premature. If a third script needs the same parsers, that's the moment to extract.
- Lenient `## Notes for (?:the )?PR$` parser is a small project-vs-spec gap: CONVENTIONS.md says `## Notes for the PR`, the project's actual checkins use `## Notes for PR`. Accepting both is the safer move (existing checkins don't break) but it's worth noting the spec-practice divergence; long-term either CONVENTIONS.md or the existing checkins should align.
- The Open threads bullet in the briefing renders as `- **Open threads**: <verbatim content>` per the skill's Output format spec; when the verbatim content itself starts with `- ` (a bulleted list, which it usually does), the output has two adjacent dashes. Functional but slightly awkward; not worth a format restructure here. If the briefing layout ever gets a polish pass, this is the obvious cleanup.
- Trade-off accepted: tests use real `git init` in temp dirs for the drift-detection cases (slower than mocking, ~2× the per-test wall time) but get fidelity without an injection seam. Substrate convention prefers stdlib; introducing a mock layer would be the bigger cost. ~50ms per test is fine.
- correction: When a checkin's Notes section uses a non-canonical header form (`## Notes for PR` vs CONVENTIONS.md's `## Notes for the PR`), the parser must accept both rather than failing silently. Self-smoke against the real project caught this — the script was producing a Last checkin block without the Notes line because the regex looked for the canonical form only. Worth knowing for the next migration: don't assume canonical-form headers in fixtures match what's actually on disk.
- correction: Substrate scripts must read `projects/CONVENTIONS.md` at runtime for any data the doc is authoritative on, even when the script doesn't strictly need the values for behavior — the convention is "single source of truth, parse-at-runtime, fallback const only on read failure." First evaluator panel flagged this on autoload because the script used phase status names as inline literals without ever touching CONVENTIONS. Following autosave's `loadEventVocabulary()` shape (read + fallback const + use the loaded set for input validation) is the right pattern for any CONVENTIONS-defined enum.
- correction: When parsing markdown documentation that humans edit, anticipate line-wrap. A regex that matches a single line will break the moment someone soft-wraps the source. The `**Status values for a phase**` line in CONVENTIONS.md was wrapped in the live file; my initial single-line regex worked in test fixtures (where I controlled the content) and broke on first contact with reality. Use `[\s\S]+?` with a paragraph-break lookahead, and always smoke against the real artifact, not just synthetic fixtures.
- Reviewers should focus on: (1) does the briefing output match what the skill produced (compare to my router-time call earlier in the session — but be aware the skill version was an LLM doing fuzzy reading, so byte equivalence isn't possible; format correctness is); (2) is the suggested-next-action decision tree complete enough (especially the in-progress+open-PR branch where "new comments" detection isn't implemented since it'd require gh CLI calls outside the script's read-only stdlib remit); (3) does the duplication of parsing helpers between autoload.ts and autosave.ts feel right or should they extract to a shared module now.

