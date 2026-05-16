# Interview trail: substrate CLI consolidation

## Frame

User wants a consistency pass that aligns `griot` and `guild` with
the `bin/<family>` CLI pattern that `loom` + `draft` are establishing
in the `trout-sunset` project. Goal: push CRUD-shaped logic from
`.claude/scripts/<family>/*.ts` into peer CLIs; kill wrapper skills
that turned into CLI verbs in disguise; restructure griot's internal
artifacts to match the JSON-state-with-MD-bodies split; ship
new evaluator + whiteboard agents for playwright/vitest/testing-
strategy/substrate-engineering; codify the parallel-work invariant.
Surviving substrate-skill count target: ~12 across loom/draft/griot/
guild + 2 ev-loop, down from current ~17.

## Q1: Is the brainstorm summary correct?

- **Recommendation**: Yes, that's the project.
- **Answer**: Confirmed.
- **Why**: Brainstorm context already covered the architectural
  decisions; this interview is the structural decomposition.

## Q2: Relationship to the in-flight `trout-sunset` project?

- **Recommendation**: Peer project — separate scope, parallel work.
- **Answer**: Sequel — depends on `trout-sunset` closing first.
- **Why**: Cleaner staging; substrate references during P5's sweep
  need `bin/loom` + `bin/draft` already in production form.

## Q3: Confirm 3 obvious in-scope workstreams (bin/griot, bin/guild, wrapper-skill kills)?

- **Recommendation**: All three in.
- **Answer**: All three in.
- **Why**: Core consolidation work the brainstorm landed on.

## Q4: session-notes restructure (state.json + MD bodies) — in or out?

- **Recommendation**: In scope.
- **Answer**: In scope.
- **Why**: Today's YAML-frontmatter-on-`learning.md` kludge is a
  legacy of having no JSON home. Migration risks acknowledged
  (in-flight unprocessed notes need converting).

## Q5: Explicit parallel-work hardening pass — in or out?

- **Recommendation**: Inherited from `trout-sunset`, no extra pass.
- **Answer**: Explicit hardening pass as a phase.
- **Why**: User wants the parallel-safety invariant codified
  explicitly, not assumed inherited. Becomes Phase 5's third sweep.

## Q6: ev-loop-* skill updates — in this project or trout-sunset?

- **Recommendation**: `trout-sunset`'s job.
- **Answer**: Touch them again in this project (for `bin/griot` +
  `bin/guild` refs).
- **Why**: ev-loop bodies reference all four families; trout-sunset
  handles loom + draft refs; this project handles griot + guild
  refs. Becomes part of Phase 5's first sweep.

## Q7: rollup.md format changes — in or out?

- **Recommendation**: Out of scope (rollup.md stays MD).
- **Answer**: Definitely in. Rollup is not intended for humans; it
  doesn't need a skill or anything as long as a composite skill can
  `griot-use` and get an LLM-compatible output.
- **Why**: Reframes rollup as LLM-only artifact. Removes the
  human-readability constraint that shaped today's prose-y rollup.md.
  Big architectural shift; landed in Phase 3.

## Q8: CONVENTIONS.md update — in or out?

- **Recommendation**: In scope, gets a sweep.
- **Answer**: In scope.
- **Why**: The CRUD-vs-orchestration framing from Phase 1.5 of
  agent-guilds is right but lives in the `.claude/scripts/` world.
  Re-articulate against `bin/<family>` + the four-family taxonomy.
  Becomes Phase 5's second sweep.

## Q9: Things to explicitly defer to future projects?

- **Recommendation**: Defer eval-side `/griot-use`, cross-project
  federation, `/griot-compact` judge panel redesign, new evaluator
  catalogs/agents.
- **Answer**: Not concerned with cross-project federation (defer).
  Definitely interested in new evaluators + whiteboarders for
  playwright + vitest + structural-testing concerns (in scope).
- **Why**: Project has matured tooling (playwright, vitest); the
  agent families that catch testing antipatterns earn dedicated
  panel/design voices. 4 new agents in scope; cross-project /
  judge-panel-redesign / new evaluator-catalogs beyond these 4
  stay deferred.

## Q10: rollup format shape (markdown / JSON / JSONL)?

- **Recommendation**: Stays markdown, but tighter.
- **Answer**: JSON-of-entries; composite skill renders to prose at
  injection.
- **Why**: Cleanest separation between machine format and LLM-
  rendered output. One more rendering step at every use, but the
  rendering can adapt to changing LLM prose preferences without
  touching storage.

## Q11: Which new evaluators/whiteboarders to add?

- **Recommendation**: evaluator-playwright + evaluator-vitest.
- **Answer**: All four — evaluator-playwright, evaluator-vitest,
  whiteboard-testing-strategy, whiteboard-substrate-engineer.
- **Why**: testing-strategy fills a design-phase voice the existing
  6 whiteboarders don't cover (test architecture as separate from
  react-architecture / performance). substrate-engineer is the
  self-substrate design voice useful for projects like this one.

## Q12: Composite-skill model for rollup access?

- **Recommendation**: Inlined into `bin/griot use --as=llm`.
- **Answer**: Both — `bin/griot use --as=llm` AND a new `/griot-load`
  skill, with the skill being `disable-model-invocation: true` +
  `user-invocable: true`.
- **Why**: CLI is the implementation; skill is the addressable user
  surface. Auto-discovery blocked; user-explicit invocation only.
  Composition from `/ev-run` (and similar) goes through the CLI
  directly via Bash; the skill is for manual user invocation.

## Q13: 5-phase decomposition — approve or revise?

- **Recommendation**: Approve.
- **Answer**: Approved (5 phases: bin/griot CLI + kills; bin/guild
  CLI; griot internal restructure; new agents; integration sweep).
- **Why**: Each phase is one conceptual change. P1 + P2 + P4 are
  independent. P3 depends on P1. P5 depends on P1 + P2.

## Q14: Phase ordering / parallelism?

- **Recommendation**: P1 + P2 in parallel; P3 after P1; P4 anytime;
  P5 last.
- **Answer**: Parallel-first — ship P1, P2, P4 in parallel branches;
  then P3; then P5.
- **Why**: Demos the project's own parallel-work goal. P1, P2, P4
  touch genuinely independent files; integration risk minimal.

## Q15: Loop strategy?

- **Recommendation**: Interactive throughout.
- **Answer**: Interactive throughout.
- **Why**: Design-heavy substrate phases; human-paired loop catches
  mid-flight forks the antagonist won't.

## Q16: Per-phase verification baseline?

- **Recommendation**: Standard (lint + build + test + manual smoke).
- **Answer**: Standard + e2e migration of in-flight unprocessed
  session-notes.
- **Why**: P3's session-notes restructure changes the on-disk shape
  of any unprocessed notes that exist at migration time. Migration
  script + test ensures no data loss.

## Q17: Top 3 risks to flag in PLAN.md?

- **Recommendation**: Compact read-path break (P3), griot-use
  injection break during rollup move (P3), L-004 surfacing for P4.
- **Answer**: All three risks confirmed.
- **Why**: All three are concrete + project-specific. Generic risks
  (scope creep, etc.) not flagged.

## Q18: Slug?

- **Recommendation**: `substrate-coherence`.
- **Answer**: `substrate-cli`.
- **Why**: Tighter, names the consolidation target directly.
