# Triggering prompt (distilled)

## Unit

Rewrite /trout-pull-request SKILL.md to consume pr-plumbing.ts verbs (LLM/CRUD split, second half of deliverable 6)

## Goal

Rewrite `.claude/skills/trout-pull-request/SKILL.md` so its plumbing prose becomes Bash invocations of the `pr-plumbing.ts` script's four verbs (`inspect`, `commit`, `push`, `submit`) authored in checkin 07. Sections 1–3 (resolve inputs, find existing PR, why-check heuristic) collapse into one "Inspect" step that reads JSON from `inspect`. Sections 5–6 (new PR / stale PR commit-and-submit sequences) collapse into a "Submit" step that invokes `commit` then `submit`. Section 4 (title and body authoring) stays prose — that is the LLM-shaped heart of the skill. The Retry policy section deletes (push retry now lives in the script). The skill's tool surface shrinks: `mcp__github__*` and `Bash(git:*)` come out of `allowed-tools`; the script handle (`Bash(node .claude/scripts/trout/*)`) is already permissioned project-wide. Net effect: ~345-line SKILL.md becomes ~180–220 lines, every CRUD invariant from §5/§6 still holds (enforced by the script's tests), and the skill body is recognizably the same LLM-shaped contract authored from a thinner orchestration body.

## Acceptance criteria

1. **Sections 1, 2, 3 (resolve / find PR / why-check) collapse into a single `## 1. Inspect` step.** The step's body is one `Bash("node .claude/scripts/trout/pr-plumbing.ts inspect <slug> <branch>")` invocation, followed by a paragraph of LLM-shaped guidance for consuming the JSON output. The thin/not-thin motivation determination reads from `whyCheck.thin` in the JSON; the user-facing "What's the motivation for this PR?" prompt stays as prose verbatim from the existing § 3 (this is the LLM-shaped halt-and-ask). The four state cases (`new` / `fresh` / `stale` / `drift`) and their terminal reports stay listed as prose for the LLM to dispatch on, but the determination itself is read from `state` in the JSON, not computed inline.

2. **Section 4 (title and body authoring) stays.** Sub-sections 4.1 (Title), 4.2 (Body — common shell, including the marker, `> [!NOTE]` callout, the body template, the 500-600 word cap), 4.3 (Single-checkin Reference section), and 4.4 (Multi-checkin Units table) are preserved verbatim or near-verbatim. One detail is added to § 4.2: after authoring the body, write it to a temp file (suggested path: `/tmp/pr-body-<branch>-<NN-list>.md`) so it can be passed to `submit` via `--body-file=<path>`. This is the only behavioral change in § 4.

3. **Sections 5 and 6 (New PR / Stale PR sequences) collapse into one `## 3. Submit` step.** The step's body is two Bash invocations:
   - `Bash("node .claude/scripts/trout/pr-plumbing.ts commit <slug> <branch> --message='<phase tag> <unit-or-phase name> (checkin{s} NN[, NN, ...])'")` — the script handles staging (substrate-pattern paths only), commit, and push with retry. Skill prose explains the message convention only (single-checkin: `[Phase N] <unit name> (checkin NN)`; multi-checkin: `[Phase N] <phase name> (checkins NN, NN, ...)`).
   - `Bash("node .claude/scripts/trout/pr-plumbing.ts submit <slug> <branch> --title='<title>' --body-file='<path>' --phase-update='<...>'")` — the script handles `gh pr create` / `gh pr edit`, autosave event recording, MANIFEST tracking commit, and tracking-commit push. The skill body explains only what `--title`, `--body-file`, and `--phase-update` should contain in each of the two paths (new vs stale). The `phase-update` argument differs by path: new PR uses `<N>:in-progress:pr=#<N> (open)`; stale PR omits `phase-update` (the script's autosave call uses `pr-updated` event, no phase-row mutation).

4. **The `## Retry policy` section is deleted from SKILL.md.** Push retry is the script's responsibility (covered by `pr-plumbing.test.ts`'s push retry tests). The skill body must not reference retry mechanics.

5. **The `allowed-tools` frontmatter is updated.** Drop: `Bash(git:*)`, `mcp__github__list_pull_requests`, `mcp__github__create_pull_request`, `mcp__github__update_pull_request`, `mcp__github__pull_request_read`. Keep: `Read`, `Write`, `Edit`, `Skill`. Add (or confirm already present in project `.claude/settings.json`): `Bash(node .claude/scripts/trout/*)`. Net: the skill no longer talks to git or GitHub directly — only through the script seam.

6. **The Invariants section updates without weakening.** The eight invariants (1: marker plural; 2: title/body authored from current checkin set; 3: marker == disk → no-op; 4: never edits checkin files; 5: drift refusal; 6: motivation sourced or asked; 7: 500-600 word body cap; 8: substrate-orientation `[!NOTE]` callout) all remain conceptually identical. Wording updates where the responsibility shifted to the script (e.g., Invariant 3 references `pr-plumbing.ts inspect`'s `state` field rather than describing comparison logic inline). One new invariant is added: **Invariant 9: All git, gh, and autosave actions flow through `pr-plumbing.ts` verbs. The skill body never invokes git, gh, or autosave directly.** This is the structural guarantee of the LLM/CRUD split.

7. **Verification:**
   - `npm run lint` clean.
   - `npm run build` clean.
   - `npm run test` reports 117/117 pass (no script changes in this checkin; tests stay green).
   - `wc -l .claude/skills/trout-pull-request/SKILL.md` reports a value in `[180, 220]` (target range; a number outside this range is not a hard fail but flags either over- or under-compression and prompts a re-read).
   - `grep -E "mcp__github|Bash\\(git:" .claude/skills/trout-pull-request/SKILL.md` returns nothing (the only references should be in the historical record / Notes for PR section if at all, not in the active body).
   - `grep -E "git push|gh pr (create|edit|list|view)|autosave\\.ts" .claude/skills/trout-pull-request/SKILL.md` returns only references inside the prose explaining what the *script* does — not direct invocations the skill performs. (Manual review of grep matches; this is a soft check.)
   - **Dogfood**: at the end of this checkin, the loop's checkpoint step invokes `/trout-pull-request agent-guilds ev.agent-guilds.phase-1-5-substrate-cleanup-3` via the rewritten skill. If the rewrite broke the contract, the PR submission will fail loudly and the iteration cycle catches it before the evaluator panel runs. (This is automatic via the loop's Step 2.6 checkpoint — no extra criterion is needed, but it is the de facto e2e test.)

8. **Co-located substrate refinements (none in this checkin).** The three substrate refinements identified in session 2026-05-08-a (autoload `gh` reconciliation; `commit` allowlist tightening; `submit` pr-number sanity check) and the new one I surfaced during the router run (`autosave --phase-update` not propagating to `**Current branch**` header) are tracked but **deferred** to a separate checkin (or to a follow-up after Phase 1.5 closes). Mixing them into this checkin would inflate scope past the natural-pause threshold.
