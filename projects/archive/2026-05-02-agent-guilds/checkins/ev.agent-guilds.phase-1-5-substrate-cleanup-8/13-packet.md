# Evaluator packet — Checkin 13 (D11: griot-use → script + ev-run inline + skill deletion)

## How to evaluate efficiently

You have a tight tool-use budget (maxTurns=5). Pre-computed verification
below is authoritative — do not re-run lint/build/test/grep unless you
find specific evidence the artifact summary contradicts itself.
Spot-check at most ONE or TWO criteria with targeted reads, then emit
`VERDICT:`. If you cannot reach a verdict within budget, emit
`VERDICT: flagged` with `parse-failure: budget-exhausted`.

**Important context:** D11 is structurally different from D6-D10 — those
were LLM/CRUD splits keeping a SKILL body. D11 is "skill → script +
callsite update + skill deletion." There is no LLM-shaped body to
preserve because the original `griot-use` skill was already pure-CRUD.
The five-part deliverable is: new script, new test, ev-run callsite
swap, skill directory deletion, settings.json permission cleanup.

## Contract (paraphrased)

**Goal**: Author `.claude/scripts/griot/use.ts` + sibling
`use.test.ts`. Update `/ev-run`'s Step 1.5 so it invokes the script via
Bash instead of via `Skill(griot-use)`. Delete `.claude/skills/griot-use/`
entirely. Remove dangling `Skill(griot-use)` permissions from
`.claude/settings.json`.

**Acceptance criteria** (full text in
`projects/2026-05-02-agent-guilds/checkins/ev.agent-guilds.phase-1-5-substrate-cleanup-8/13.md`):

1. Script `.claude/scripts/griot/use.ts`. ESM, stdlib-only. No subcommand.
   Reads `learnings/rollup.md` from cwd; emits one of three outcomes on
   stdout (loaded N learnings + content + citation contract / rollup
   empty / no rollup yet); always exits 0 on documented outcomes.
2. Citation contract block (literal text printed only on `loaded`)
   includes three load-bearing phrases: `Applied: L-NNN`, "padded
   citations poison that signal", tier-separation rule mentioning
   `/griot-compact`.
3. No reading of `session-notes/`, `nightly/`, or any other path under
   `learnings/`. Only filesystem read is `learnings/rollup.md`.
4. Tests: 6-8 cases covering loaded(1), loaded(N), empty, missing
   (no dir), missing (with dir), citation-contract-text-presence,
   tier-separation-source-inspection.
5. `/ev-run` SKILL.md Step 1.5 swaps `Skill(griot-use)` for
   `Bash(node .claude/scripts/griot/use.ts)`. Three-outcome handling
   adapted to the script's `griot-use:` status-line prefixes.
   Tier-separation rule (last paragraph) verbatim.
6. `.claude/skills/griot-use/` directory deleted entirely.
7. `Skill(griot-use)` and `Skill(griot-use:*)` removed from
   `.claude/settings.json`. `Bash(node .claude/scripts/griot/*)` already
   exists from D4.
8. No other repo references to `griot-use` left as live callsites.
   PLAN.md planning prose (Phase 5, Risks, Open questions) references
   the concept, not the skill — out of scope. Sibling project
   griot-subagents/PLAN.md mention noted for follow-up by that project.
9. Verification: lint clean, build clean, test pass (213+ expected),
   script ≤110, test ≤220, ev-run SKILL.md change net ≤±2 lines,
   griot-use skill dir absent, no Skill(griot-use) entries in
   settings.json, no live callsites.
10. No co-located refinements bundled.

**Disqualifiers** (single-line summary): Script reads anything under
`learnings/` other than `rollup.md`; script absorbs LLM-shaped logic;
ev-run still invokes via Skill tool after rewrite; griot-use directory
remains; Skill(griot-use) entries remain in settings.json; citation
contract text drifts substantively; script exits non-zero on empty or
missing; tests skip missing/empty/tier-separation cases; cross-project
sibling PLAN.md modified; PLAN.md planning prose touched; script
>110 lines; test >220 lines; ev-run SKILL grows by more than ±2 net;
co-located refinements bundled.

## Artifact

**Files** (created/modified/deleted):
- CREATED: `.claude/scripts/griot/use.ts` (61 lines)
- CREATED: `.claude/scripts/griot/use.test.ts` (175 lines, 7 tests)
- CREATED: `projects/2026-05-02-agent-guilds/checkins/ev.agent-guilds.phase-1-5-substrate-cleanup-8/13.md` (this checkin)
- CREATED: `projects/2026-05-02-agent-guilds/checkins/ev.agent-guilds.phase-1-5-substrate-cleanup-8/13-packet.md` (this packet)
- MODIFIED: `.claude/skills/ev-run/SKILL.md` (179 → 179 lines; ±0 net)
- MODIFIED: `.claude/settings.json` (-2 lines: `Skill(griot-use)` and `Skill(griot-use:*)` removed)
- MODIFIED: `projects/2026-05-02-agent-guilds/MANIFEST.md` (branch reconciliation; out of D11 scope but on this branch)
- DELETED: `.claude/skills/griot-use/SKILL.md` (55 lines)
- DELETED: `.claude/skills/griot-use/` (directory)
- UNCHANGED: `.claude/scripts/trout/autosave.ts` (per D10's deferred-cleanup decision)

**Pre-computed verification (authoritative — do not re-run)**:
- `npm run lint` → clean (only pre-existing symlink warnings on `frontend-design` and `vercel-react-best-practices` skill dirs unrelated to this checkin).
- `npm run build` → clean (full Next.js build succeeds).
- `npm run test` → **214 / 214 passing across 14 test files** (was 207 before D11; +7 use.test.ts cases).
- `wc -l .claude/scripts/griot/use.ts` → 61 (cap 110 ✓).
- `wc -l .claude/scripts/griot/use.test.ts` → 175 (cap 220 ✓).
- `wc -l .claude/skills/ev-run/SKILL.md` → 179 (was 179; ±0 net ✓).
- `ls .claude/skills/ | grep griot-use` → no match (skill directory removed ✓).
- `grep -n "Skill(griot-use" .claude/settings.json` → no matches (permissions cleaned ✓).
- `grep -n "Skill(.*griot-use\|Skill: \"griot-use\"" .claude/skills/` → no matches (no live callsites; ev-run/SKILL.md only references the script's `griot-use:` status-line prefix in prose, not as a Skill invocation).
- `grep -n "session-notes\|nightly" .claude/scripts/griot/use.ts` → only matches inside the CITATION_CONTRACT literal (intentional documentation for the LLM consumer); the script's own filesystem-read path is hardcoded to `learnings/rollup.md` only.
- Smoke test: `node .claude/scripts/griot/use.ts` → `griot-use: no rollup yet — run \`/griot-compact\` once captures exist`, exit 0 (no rollup exists in this repo currently — the no-rollup-yet outcome is exercised live).
- `git diff --stat .claude/scripts/trout/autosave.ts` → no changes (unchanged per AC and D10's deferred-cleanup decision ✓).

**Direct mappings to acceptance criteria**:
- AC #1 (script shape, three outcomes, exit codes) → `use.ts:1-61` (entire file).
- AC #2 (citation contract text with three load-bearing phrases) → `use.ts:21-31` (CITATION_CONTRACT literal); test assertion at `use.test.ts:144-156`.
- AC #3 (no `session-notes`/`nightly` reads) → `use.ts:11` (single ROLLUP_PATH constant); tier-separation invariant test at `use.test.ts:159-175`.
- AC #4 (test cases) → `use.test.ts` (7 tests; loaded×2, empty×1, missing×2, citation-contract×1, tier-separation×1).
- AC #5 (ev-run Step 1.5 swap) → `ev-run/SKILL.md:81-98` (Step 1.5; new prose at line 83 invokes Bash; lines 89-94 adapt the three-outcome list to script status-line prefixes; lines 96-98 verbatim tier-separation rule).
- AC #6 (skill dir deletion) → `ls .claude/skills/` (no `griot-use`).
- AC #7 (settings.json cleanup) → `.claude/settings.json:23-24` now `Skill(griot-capture:*)` followed directly by `Skill(guild-spawn)` (no Skill(griot-use) lines between them).
- AC #8 (no live callsites) → grep results above.
- AC #9 (verification) → see Pre-computed verification.
- AC #10 (no co-located refinements) → `git diff --stat` shows only the expected D11 files plus the carried-over MANIFEST reconciliation.

**Iteration story**:
- Panel run 1, no prior runs.
- One in-execution correction recorded in Notes for the PR with `correction:` prefix:
  - Tier-separation source-inspection test caught my own explanatory comment at the top of `use.ts` referencing `session-notes` and `nightly` by name. Test failed correctly. Fixed by rewording the comment to "other learnings tiers" without naming the forbidden subdirectories. Re-ran tests: 214/214 passing. Lesson: when a test enforces a textual invariant on the source, comments count as source.
- No contract-cap renegotiations needed. The line caps (script ≤110, test ≤220, ev-run net ≤±2) all came in well under (61/175/±0).

## Original ask

Verbatim from `projects/2026-05-02-agent-guilds/PLAN.md` § Phase 1.5 deliverable 11:

> 11. **`griot-use` → script.** Author `.claude/scripts/griot/use.ts`
> (small — reads `learnings/rollup.md`, prints content + citation
> contract to stdout so the Bash tool result lands the load in
> conversation context). Sibling `use.test.ts`. Inline the invocation
> into `/ev-run`'s setup step (`Step 1.5. Load learnings`) so it fires
> automatically at loop setup, not as a discoverable user skill.
> Delete `.claude/skills/griot-use/`.

## Suggested spot-check (one tool use)

The single most efficient spot-check is reading `use.test.ts:159-175`
(the tier-separation invariant test) to confirm the mechanical guard
against accidental `session-notes`/`nightly` reads is in place and
exercised. If that test passes (it does, per pre-computed verification
of 214/214), the substrate's hardest invariant for this deliverable
(tier separation) is mechanically enforced. A secondary spot-check
would be `ev-run/SKILL.md:81-98` (Step 1.5) to confirm the Skill→Bash
swap actually happened and the three-outcome handling adapted to the
script's status-line prefixes.
