# learnings/

A self-validating learnings system for Claude Code. Captures corrections from
real sessions, validates them with a multi-judge panel, and only promotes
validated lessons into a curated `rollup.md` that's loaded manually via
`/learnings-use`.

This is a **personal pilot**. Runtime data is gitignored. Only the skill
definitions, templates, and `config.yaml` are tracked. Rollout to a team is
gated on measured improvement.

## Principles

1. **Signal-over-volume.** A learning only exists if a reasonable Claude would
   have gotten it wrong by default. No journaling. No capturing established
   patterns.
2. **Tier separation.** Only `rollup.md` is ever loaded at session time.
   `session-notes/` and `nightly/` layers can contradict each other freely.
3. **Rubric immutability.** Rewrites change the learning text only. Any attempt
   to modify a `rubric.md` is a hard violation.
4. **Opt-in.** Not auto-loaded, not in CLAUDE.md, not in any auto-registry.
   Skills are manual-only.
5. **Benchmark-gated.** No promotion without judge consensus. No broader rollout
   without `corrections_per_session` trending down.

## The skills

| Skill | When you run it | What it does |
|---|---|---|
| `/learnings-capture` | Right after Claude got something wrong and you corrected it | Writes a `session-notes/<ts>-<slug>/` folder with the prompt, wrong output, correction, transcript, and a candidate `learning.md`. Fast. No LLM panel. |
| `/learnings-use` | Start of a session where you want the rollup active | Loads `rollup.md` and installs a citation contract: Claude appends `Applied: L-NNN` when it uses a learning. |
| `/learnings-compact` | Manually, when you feel like processing captures (nightly in spirit) | Runs the judge panel. Promotes `IMPROVED` entries to `rollup.md`. Rewrite-loops `UNCHANGED` / `REGRESSED`. Flags `DID_NOT_REPRODUCE`. Updates bench history, archives processed notes, and opens a PR. |
| `/learnings-report` | Weekly-ish | Reads the instrumentation files and produces a one-pager on trend, cost, and judge calibration. |

## Directory layout

```
learnings/
  session-notes/                   # gitignored — pending captures
    <YYYY-MM-DDThh-mm-ss>-<slug>/
      prompt.md                    # triggering user turn, distilled for replay
      wrong.md                     # what Claude said/did
      correction.md                # user's correction — ground truth
      full_transcript.md           # full session chunk (debugging aid)
      learning.md                  # distilled lesson (rewritable)
      rubric.md                    # 2-3 binary assertions (IMMUTABLE; rubric-author writes this during compaction)
    archived/                      # processed notes move here
  nightly/                         # gitignored — distillation notes, never session-loaded
    YYYY-MM-DD.md
  runs/                            # gitignored — mediator transcripts
    <learning-id>/<timestamp>.json
  rollup.md                        # tracked as empty placeholder; live rollup is gitignored
  citations.json                   # gitignored
  regressions.jsonl                # gitignored
  bench-history.jsonl              # gitignored
  sessions.jsonl                   # gitignored
  operator-log.jsonl               # gitignored
  judge-calibration.json           # gitignored
  config.yaml                      # tracked — thresholds, tiers, model ids
  pr-templates/                    # tracked
    nightly.md
    human-review.md
  README.md                        # tracked
```

`rollup.md` is gitignored. `/learnings-use` tolerates a missing file — if no
compaction has run yet, it reports "no validated learnings yet" and moves on.
On a fresh clone, run `/learnings-compact` once to generate one.

## The self-validating loop

```
session                    capture (fast)            compact (expensive, manual)
─────────                  ────────────────          ─────────────────────────────
user correction  ─────▶    /learnings-capture  ─▶   for each new session-note:
                           writes:                    rubric-author writes rubric.md
                           - prompt.md                mediator runs 7-judge panel (control vs treatment)
                           - wrong.md                 verdict: IMPROVED/UNCHANGED/REGRESSED/DID_NOT_REPRODUCE
                           - correction.md
                           - full_transcript.md       IMPROVED            → promote to rollup with L-NNN
                           - learning.md              UNCHANGED/REGRESSED → rewriter proposes v2 (up to 5 attempts)
                                                      DID_NOT_REPRODUCE   → flag, skip, count

                                                      after 5 failed rewrites:
                                                        operator diagnoses pattern,
                                                        opens human-review PR

                                                      after all notes processed:
                                                        re-run rollup vs all stored origin prompts
                                                          → regressions.jsonl
                                                        append bench-history line
                                                        update judge-calibration.json
                                                        archive processed session-notes
                                                        open standard nightly PR
```

## Judge panel

7 stateless Claude calls in parallel:

- 2× current top tier (double-weighted)
- 1× previous top tier
- 1× current mid tier
- 1× previous mid tier
- 1× current fast tier
- 1× previous fast tier

Rounds:

- **Round 1 (blind):** 7 independent verdicts. Requires 7/7. Split → Round 2.
- **Round 2 (debate):** each judge sees others' reasoning. Requires 6/7.
- **Round 3 (final):** same. Requires 5/7. Below → operator.

Tier-weighted tiebreak: if evenly split and both top-tier-A judges agree, their
vote wins. Verdict is tagged `contested: true`.

## Verdicts (exact match, not semantic match)

- `IMPROVED` — treatment strictly passes more rubric assertions than control,
  every assertion control failed now passes, no new failures. **Only path to
  rollup.**
- `UNCHANGED` — same pass count. Rewrite.
- `REGRESSED` — treatment passes fewer. Rewrite.
- `DID_NOT_REPRODUCE` — control already passes everything. Kill-switch canary.

## Operator corrective ladder

Before any human PR:

1. Re-prompt offending agent with explicit framing + diff as evidence.
2. Constrain toolset — strip Write access from rewriter; force structured
   response that operator writes.
3. Roll back + change strategy (e.g., "split into two learnings").
4. Open human-review PR tagged with violation pattern.

Every intervention is logged to `operator-log.jsonl`.

## Metrics hierarchy

1. `corrections_per_session` trend — top-line. Did Claude need correcting less?
2. `DID_NOT_REPRODUCE` rate — kill-switch. >30% means the benchmark is theatre.
3. `rollup_pass_rate` trend — are learnings self-consistent?
4. `cost_per_promoted_learning` — is the tooling amortising?
5. Top-5 most-cited learnings.
6. Operator intervention frequency.
7. Session latency delta (with/without `/learnings-use`).
8. Per-judge calibration table.

**Always-included caveat:** fewer corrections could mean the user gave up, not
that Claude improved. Triangulate with external signals before claiming success.

## Opt-in: enabling the Stop hook

The Stop hook (grep transcript for `Applied: L-\d+`, nudge on corrections,
append to `sessions.jsonl`) is **not** enabled by default. To opt in, add to
your gitignored `.claude/settings.local.json`:

```json
{
  "hooks": {
    "Stop": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "$CLAUDE_PROJECT_DIR/scripts/learnings-post-session.sh"
          }
        ]
      }
    ]
  }
}
```

The script itself (`scripts/learnings-post-session.sh`) is tracked, but only
runs for people who wire it up.

## Config

See `config.yaml` for thresholds, tier model IDs, and cost settings. Previous-
gen model IDs are placeholders marked `TODO` — set them before the first real
`/learnings-compact` run.

## Rollout phases

- **Phase 1 (now):** personal pilot. Data gitignored. Manual compaction.
- **Phase 2:** once `corrections_per_session` trends down — keep data
  gitignored, add a non-Claude tiebreaker judge, add learning-retirement.
- **Phase 3:** un-gitignore corpus, add a `/learnings-use` nudge to CLAUDE.md,
  team adoption.
- **Phase 4:** consider auto-invocation of `/learnings-use` and auto-capture on
  correction. Not before.

Explicit non-goals until Phase 4: auto-capture on correction, auto-use of
learnings.

## Fundamental concerns (known, not fixing v1)

- Judge circularity — 7 Claude judges share Claude's blind spots.
- Rubric-author bias — mitigated by fresh-context + separate agent.
- Prompt distillation is the weakest link — `DID_NOT_REPRODUCE` is the canary.
- Reward hacking — optimising for judge approval ≠ correctness.
- `corrections_per_session` can Goodhart — pair with external signals.
- Context-sensitive learnings over-promoted to universal rules.
- Staleness — retirement mechanism is Phase 2.
