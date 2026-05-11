# Triggering prompt (distilled)

## Unit

Migrate `/trout-autoload` to `.claude/scripts/trout/autoload.ts`

## Goal

Move the briefing-orientation primitive from a markdown skill (`/trout-autoload`) to a Node script (`.claude/scripts/trout/autoload.ts`), preserving output shape and resolution semantics. This is deliverable 3 of Phase 1.5; same shape as deliverable 2 (`trout-autosave`). The work is pure CRUD — read MANIFEST.md, config.md, latest session handoff, latest checkin; check `git branch --show-current` for drift; emit the briefing markdown on stdout. The skill body is no longer carrying its weight as an LLM-shaped primitive — its only "judgment" is a rule-based suggested-next-action decision tree, which translates cleanly to deterministic code.

## Acceptance criteria

- New file `.claude/scripts/trout/autoload.ts` produces a briefing on stdout matching the existing skill's Output format byte-for-byte for an unchanged project: project header (`## Project orientation: <title> (<slug>)`), `Status` + `Branch (manifest → actual)` line, `### Phases` table copy, `### Current state` copy, optional `### Last checkin (<NN>, <when>)` block (Unit / Verdict / Notes — omitted when no Latest checkin resolves), optional `### Last session (<filename>)` block (Open threads copied verbatim — omitted when sessions/ is empty or missing), optional `### Config highlights` (Verification / PR base — omitted when no config.md), optional `> Drift: ...` line (only when manifest branch ≠ git branch), and `### Suggested next action`.
- Sibling `.claude/scripts/trout/autoload.test.ts` exercises: project resolution forms (exact slug / suffix match / `./` path / archive-reject), missing-manifest stop, missing-sessions skip, missing-checkin skip, missing-config skip, drift detection emits the `> Drift:` line, omission rules for each optional section, suggested-next-action branches (all-completed → archive, in-progress + fresh checkin + no PR → trout-pull-request, in-progress + open PR → caller-decides, not-started + deps satisfied → loop, not-started + waiting on PR → name the blocker). At least 12 cases. `node:test`, runs via `npm run test`.
- Argument surface: single positional `<project-slug-or-path>`. Empty arg → list active projects under `projects/` (excluding `archive/`) on stderr and exit non-zero with a "specify a project" message. Path/slug resolution mirrors `autosave.ts` exactly (exact slug → suffix match → full path; archive paths rejected with the same wording).
- Errors: `autoload-error: <reason>[; candidates: ...]` to stderr, non-zero exit. Same shape as `autosave.ts`'s `fail()` helper.
- Manifest schema (Phase columns, status values), event vocabulary, and any other CONVENTIONS-defined data parsed from `projects/CONVENTIONS.md` at runtime; hardcoded fallback only on read failure. No duplicated TypeScript consts where CONVENTIONS is authoritative.
- All call sites of `Skill(skill: "trout-autoload", ...)` updated to `Bash("node .claude/scripts/trout/autoload.ts <slug>")`. After migration: `grep -rn 'trout-autoload' .claude/` returns only the new script, the new test, and any historical reference comments — no live `Skill` invocations and no skill directory.
- Old skill directory `.claude/skills/trout-autoload/` deleted.
- `npm run lint` clean, `npm run build` clean, `npm run test` passes (20 existing autosave tests + new autoload tests, all green).
- Self-smoke: `node .claude/scripts/trout/autoload.ts agent-guilds` produces an orientation briefing equivalent to the one the router consumed at the top of this session (current branch matches manifest now, so no drift line).
