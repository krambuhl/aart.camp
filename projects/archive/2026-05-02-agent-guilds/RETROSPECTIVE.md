# Retrospective — Agent guilds as composable substrate

**Archived**: 2026-05-15
**Duration**: 2026-05-02 → 2026-05-15 (13 days)
**PRs (phase-shipping)**: #8 (Phase 1), #9 #10 #13 #16 #18 #23 #26 #28 #30 #32 #33 #39 #41 #42 (Phase 1.5), #43 #45 #46 #48 #49 #50 #51 #52 (Phase 2), #55 #58 #64 (Phase 3), #71 #73 #79 (Phase 4), #87 #88 #89 (Phase 5). Plus co-shipped: #12 #20 #34 #35 #36 #37.

## What we set out to do

Extract a new `guild-*` substrate family alongside the existing
`trout-*` (project state) and `griot-*` (learnings) primitives — adding
multi-perspective design (`guild-whiteboard`), antagonist panel
(`guild-validate`), and parallel-spawn (`guild-spawn`) primitives.
Thin ev-loop into a clean substrate consumer rather than a monolith.
Ship aart.camp's specific agent roster: six whiteboard engineers, six
antagonist evaluators with antipattern catalogs + CLI validators
where they exist, four domain-pair generators. Wire griot integration
so antagonist findings flow into rollup and back into future
generators via `/griot-use`. **The whole project is itself a
substrate-vs-style separation experiment** — substrate is style-
neutral; ev-loop encodes opinions; a different loop style should be
able to compose substrate without inheriting ev-loop's choices.

## What actually happened

**Phase 1 (substrate foundations)** shipped clean in PR #8 across 5
deliverables on one branch. `evaluator-base` extracted, `guild-spawn` +
`guild-validate` authored, ev-loop migrated to call the new primitive
with a single-agent panel. No surprises.

Then **Phase 1.5 woke up bigger than anyone expected.** A post-merge
audit on PR #8 produced not a punch list but a rewritten plan: the
"skills as interfaces vs workers" convention. The convention says
pure-CRUD substrate primitives should be scripts; LLM-shaped skills
with CRUD epilogues should split; orchestration stays skill-shaped.
The original 12 deliverables grew into 15 (D13-D15 added as
carryovers post-completion) and shipped across **10 PRs** (#9, #10,
#13, #16, #18, #23, #26, #28, #30, #32, #33, #39, #41, #42). Mid-
project re-plans of this size are unusual in the substrate's history;
the project absorbed it via the carryover pattern (`ev.<project>.<phase>-carryover-N` branches, reopen-from-completed for the
post-completion D13-D15 additions). Two co-shipped follow-ons (#12
substrate-orientation `[!NOTE]` callout in PR bodies; #20 allowlist
tightening) landed outside the deliverable list because they surfaced
during execution and the substrate's PR-per-thing discipline made it
trivial to ship them independently.

A **substrate-bypass discipline moment** in session 2026-05-11-a:
four PRs (#34-#37) got cut as raw `git checkout -b ... && gh pr
create` instead of through the loop. User named it ("are you not
using `/ev-run` loops?"). The substrate convention got captured as a
memory entry; the rest of the session ran clean. Discipline-recovery,
not failure.

**Phase 2 (antagonist evaluator panel)** shipped 6 evaluators
(`evaluator-a11y`, `evaluator-nextjs`, `evaluator-react-api`,
`evaluator-tokens`, `evaluator-naming`, plus the existing
`evaluator-contract-fit`) plus PANEL-COMPOSITION.md (precedence list +
three-way tokens/naming/architecture boundary) plus
`derive-panel.ts` (auto-derivation from file types). The five new
evaluators each got their own PR (#43, #45, #46, #48, #49), then PR
#50 documented panel composition, #51 wired auto-derivation, #52
closed the phase with a multi-evaluator smoke test against synthetic
fixtures. The fixture-vs-real-tree question got resolved by user
preference for `.claude/scripts/guild/__smoke-fixtures__/` (close-to-
the-test placement).

**Phase 3 (whiteboard mechanism + engineers)** built `guild-whiteboard`
(filesystem-as-shared-artifact, parallel engineer spawn, attributed
sections, multi-round support) and the six whiteboard engineers
(`whiteboard-react-architect`, `whiteboard-design-systems`,
`whiteboard-performance`, `whiteboard-a11y`,
`whiteboard-sketch-ideation`, `whiteboard-skeptic`) plus
`whiteboard-base.md`. The D3 design exercise — *"Should aart.camp
adopt a draft/published distinction for sketches?"* — surfaced real
disagreements in round 1 and **observable position shifts in round
2**: the skeptic synthesized a position no engineer had named
(gitignored `_drafts/` + dev-only route + zero registry changes).
That synthesis is the substrate's promise made literal.

**Phase 4 (domain pairs) was the high-value moment of the project.**
The always-on whiteboard fired at phase start and produced **two
material reframes of PLAN.md's prescription before any code shipped**:

1. **The skeptic flipped specialist-sequencing**. PLAN.md said
   "specialist solo first, panel only on its approval." Skeptic
   argued the directionality was backward — generator + specialist
   are aligned-by-construction, so approval-skips-panel amounts to
   "the author marking their own homework." User adopted the flip:
   panel runs always, specialist participates at elevated precedence,
   fail-fast only on rejection. **Net effect: zero ev-loop control-
   flow change** — the existing PANEL-COMPOSITION precedence mechanism
   carried the new pattern.
2. **Three stubs dropped** in favor of a CONVENTIONS.md pattern doc.
   Skeptic argued speculative-files-without-trigger were worst-of-
   both-worlds. User adopted: zero stub agent files; document the
   pair-authoring shape in CONVENTIONS instead.

Both reframes surfaced via `AskUserQuestion` before any agent file
was authored. **This was the first concrete demonstration that the
pre-design whiteboard step pays for itself** — the reframes would
otherwise have been committed-in-code and corrected post-merge. The
substrate caught its own future mistakes.

D3 of Phase 4 then ran a real CSS codemod end-to-end:
`generator-css-codemod` migrated `background-color: black;` →
`token("bg.inverted.default")` on `Sketch.module.css`, the
specialist evaluator paired with the generator on the panel,
articulated a partnership precedent ("acknowledge, don't escalate,
when the generator was loud"), and surfaced a real semantic question
about dark-mode inversion that became a user decision via
`AskUserQuestion`.

**Phase 5 (griot integration + composability proof) closed the loop.**
D1 wired the capture half (`findings.ts append/count` for frequency
counting, `griot-capture --evaluator-finding`, classification-aware
promotion in `griot-compact`). D2 wired the surface half (`/griot-use`
recognizes `## Project antipatterns` + top-10 curation, citation
contract extended with `AP-NNN`) plus a **synthetic A/B verification**:
`generator-css-codemod` ran twice in parallel against identical
fixtures, once with rollup loaded, once without. Token choice
converged on the same answer; **Run B emitted `Applied: AP-001`
while Run A did not**. The citation is the load-bearing falsifiable
signal that the rollup reached the generator's context — "did the
loop affect the generator?" is proven on convergence cases via the
citation, even if "did the loop *cause* a different choice?" stays a
measurement caveat that requires a contrarian antipattern (post-
project work).

D3 — **the composability-proof loop variant** — shipped
`/a11y-review-file`: a single-file a11y review skill that composes
the `guild-*` substrate only. **The substrate-only carve-out is
enforced by the tool ceiling** (`allowed-tools: Read, Skill`) — the
skill physically cannot Edit, cannot Bash, cannot spawn arbitrary
Agents. End-to-end demo against `components/app/FileListing/index.tsx`
returned `{verdict: "approved"}`. Three skill layers + one agent
spawn + one script invocation produced a working a11y review loop in
54 lines of SKILL.md. The substrate's substrate-vs-style separation,
articulated in PLAN.md's Rules section and proved across Phases 1-4,
landed its final demonstration here.

## What went well

- **Phase decomposition into independently-revertable PRs** held
  across the whole project. 30+ phase-shipping PRs; each one safely
  revertable in isolation. The PR-per-conceptual-change discipline
  was load-bearing for the project's confidence.
- **The always-on whiteboard pays for itself**. The Phase 4 phase-
  start reframes are the canonical evidence. The pre-design step is
  no longer an experiment; it's substrate that demonstrably catches
  design issues before code locks them in.
- **`AskUserQuestion` at every mid-flight scope expansion** (L-002)
  worked. Every reframe surfaced as an explicit user fork; no
  unilateral substrate decisions got made without consultation. The
  "halt and fork at real decision points" pattern saved the project
  from at least three would-be over-commits.
- **`/guild-validate` aggregating verdicts via
  `parse-and-aggregate.ts`** is genuinely useful infrastructure.
  Single-evaluator panels and multi-evaluator panels both flow
  through the same shape; the verdict shape is locked so downstream
  callers can rely on it.
- **Substrate-as-test-subject worked late in the project**. By Phase
  4-5 the substrate was confident enough that it could review its own
  output via panels (with the project itself being the testbed). The
  recursive dogfood that PLAN.md flagged as a risk turned out to be a
  feature, not a footgun.
- **Phase 1.5's mid-project re-plan absorbed cleanly** because of the
  carryover-N branch pattern + reopen-from-completed mechanism. A
  4×-scope expansion mid-project is unusual; the substrate held.

## What didn't

- **PLAN.md's "30-line composability-proof loop variant"** framing
  collided with SKILL frontmatter overhead. The body is 41 lines
  (well under 30 + slack); the frontmatter adds 13 lines of YAML
  metadata. Future PLAN.md framings should specify "≤ N lines of
  loop logic" rather than total file size.
- **VERDICT-line parser strictness recurred 4+ times across phases**.
  Evaluators tend to embed the verdict mid-paragraph; the parser
  requires `^VERDICT:` at line-start. Coaching evaluators works but
  is repetitive friction. Either the parser should be more permissive
  or every evaluator body should bake in stronger structured-VERDICT
  shape guidance. Not fixed in-project.
- **Advisory-as-approved emit pattern** — multiple evaluators (4+
  observed instances) embed narrative advisories but emit `VERDICT:
  approved`, so the structured `advisory_findings` list comes back
  empty. The signal is in the narrative, not the structure. Same
  parser-strictness root cause as the VERDICT line.
- **L-004 (agent registry session-boundary)** surprised three times
  (panel-8 D8, whiteboard-3 D3, domain-pairs-3 D3). The pattern is
  now load-bearing: newly-authored `.claude/agents/*.md` files
  require Claude Code process restart, not `/clear`. Memory entry
  captures it; not pre-emptively automated.
- **`/guild-whiteboard` v1 `per_agent_context` redundancy**. SKILL
  prescribes per-engineer JSON map; in v1 the preamble is identical
  for every engineer, making the prescription ~6× wasteful. The
  pragmatic workaround was brief-inlining; the cleanest fix is a
  `shared_round_context` field on `/guild-spawn`. Not fixed
  in-project.
- **Substrate-bypass discipline got tested and recovered** (session
  2026-05-11-a four-PR detour). Recovery was clean — the memory
  entry now exists, the convention is captured — but the moment
  cost session time. Substrate discipline is something the loop has
  to actively hold, not assume.
- **The codemod-exercise A/B test couldn't prove course-correction**
  because the synthetic AP-001 + cold-reasoning converged on the same
  token. The exercise proved "rollup is present and visibly applied"
  via the citation but not "rollup *caused* the choice." A contrarian
  antipattern (rollup-preferred answer ≠ cold-reasoning default)
  would close that gap; constructing one synthetically risks being
  artificial.

## Findings

1. **Always-on whiteboard pays for itself (Phase 4 evidence)**. The
   pre-design whiteboard step caught two substantive design issues
   (specialist-sequencing flip + drop-the-stubs) before any code
   shipped. This is the canonical evidence for "always-on, not
   opt-in." Worth elevating to a learnings file or CLAUDE.md note so
   future substrate work inherits the framing.

2. **`allowed-tools` as enforcement, not convention**. The D3
   composability-proof skill (54 lines incl. frontmatter) made
   tangible that substrate carve-outs are real only when the tool
   ceiling enforces them. Prose-only "no ev-loop composition" rules
   can be honored or not; `allowed-tools: Read, Skill` makes
   composing anything else physically impossible. Worth elevating to
   substrate-design guidance.

3. **VERDICT-line parser strictness pattern** (4+ observed
   instances). `parse-and-aggregate.ts` requires `^VERDICT:` at line
   start; evaluators tend to embed mid-paragraph. Friction-causing.
   Worth either a parser fix (lift VERDICT after any paragraph
   break) or stronger structured-VERDICT coaching across
   `evaluator-base.md` body prose.

4. **Advisory-as-approved emit pattern** (4+ observed instances).
   Multiple evaluators emit narrative advisories but `VERDICT:
   approved`, so `advisory_findings` arrives empty. Either the
   aggregator should lift narrative advisories or evaluators should
   emit `flagged` + `ADVISORY:` prefix. Same root as #3.

5. **`/guild-whiteboard` `per_agent_context` redundancy**. v1 SKILL
   prescribes per-engineer JSON map; preamble is identical 6× over.
   Cleanest fix: `shared_round_context` field on `/guild-spawn`.

6. **L-004 strengthening: agent-registry session boundary**. Three
   observed instances. Process restart, not `/clear`. Memory entry
   exists; worth carrying into agent-base bodies as a known-pattern
   callout.

7. **Generator-specialist partnership precedent** (Phase 4 D3). The
   right disposition when a generator surfaces a substantive concern
   is acknowledge, not escalate. Articulated by
   `evaluator-css-architecture` on first real invocation. Worth
   promoting into `generator-base.md` / `evaluator-base.md` body
   prose.

8. **`css-arch-semantic-inversion-flagged` advisory code** (Phase 4
   D3). Specialist evaluator minted this on first real invocation;
   not in the 10-entry rubric from D1. Worth adding to
   `evaluator-css-architecture.md`'s canonical rubric.

9. **PLAN.md "30-line loop" framing vs SKILL frontmatter overhead**.
   Composability-proof loop body is 41 lines; frontmatter adds 13
   more. Future "N-line loop" framings should specify "loop logic"
   rather than total file size.

10. **A/B convergence-on-correct-answer measurement caveat**. When
    the rollup's preferred answer aligns with cold-reasoning's
    default, the A/B can prove "rollup present + applied" via
    citation, but not "rollup caused the choice." A contrarian
    antipattern would close the gap; constructing one synthetically
    risks being artificial. Post-project work; surfaces naturally
    once real antipatterns accumulate.

11. **CONVENTIONS pattern doc as alternative to stub files** (Phase
    4 D1 reframe). Skeptic's framing of "speculative files without
    trigger = worst of both worlds" is generally true for substrate
    extensions; the CONVENTIONS pattern doc shape is the cleaner
    alternative. Captured implicitly by the Phase 4 D2 ship; worth
    naming explicitly as a substrate-design lesson.

12. **Substrate-bypass discipline as active practice**. Session
    2026-05-11-a's four-PR detour proved the loop has to actively
    hold substrate discipline; passive convention isn't enough. The
    captured memory entry is the right shape but the moment cost
    session time. Worth keeping the memory entry active.

## Dispositions

User-directed dispositions from the archive interview:

| # | Finding | Disposition | Rationale |
|---|---------|-------------|-----------|
| 1 | Always-on whiteboard pays for itself | **Defer** (record + propagate via griot) | Per user: elevate as a lesson. Captured in retro; will surface via `/griot-compact` if it gets re-flagged in future work. No separate CLAUDE.md edit in this archive. |
| 2 | `allowed-tools` as enforcement | **Defer** (record + propagate via griot) | Per user: elevate as a lesson. Captured in retro. |
| 3 | VERDICT-line parser strictness | **Defer (trout-retirement context)** | Originally surfaced as a Follow-up candidate, but user redirected at archive time: *"we're killing trout in favor of loom and draft."* This finding lives inside the deprecating substrate; carry to the loom transition rather than patch trout. |
| 4 | Advisory-as-approved emit pattern | **Defer (trout-retirement context)** | Same — `parse-and-aggregate.ts` is trout-family; loom inherits the pattern. |
| 5 | `/guild-whiteboard` `per_agent_context` redundancy | **Defer (trout-retirement context)** | Same — `/guild-spawn` is trout-family. The `shared_round_context` design suggestion still applies, just to the loom equivalent. |
| 6 | L-004 strengthening | **Defer** | Memory entry already exists; agent-base body update is a minor polish for a future session. |
| 7 | Generator-specialist partnership precedent | **Defer** | Worth elevating to base-body prose but not urgent; surfaces naturally when next codemod-exercise happens. |
| 8 | `css-arch-semantic-inversion-flagged` advisory code | **Defer** | Tiny addition to `evaluator-css-architecture.md` rubric; bundles cleanly with the partnership-precedent polish (#7) when that lands. |
| 9 | "30-line loop" framing vs frontmatter overhead | **Defer** | Documentation polish; surfaces naturally next time someone references the "30-line" framing in PLAN.md scaffolding. |
| 10 | A/B convergence measurement caveat | **Defer** | Post-project work; requires real captured antipatterns to test contrarian course-correction. |
| 11 | CONVENTIONS pattern as alternative to stubs | **Defer** | Pattern is already documented in CONVENTIONS.md as of Phase 4 D2; this finding is observational, not actionable. |
| 12 | Substrate-bypass discipline as active practice | **Defer** | Memory entry exists; nothing further to ship. |

**Inline findings applied this archive PR**: none (no trivial fixes
needed).

**Follow-ups dispatched after archive PR**: **none**.

User context at archive time: *"we're killing trout in favor of loom
and draft."* The three follow-up findings (#3 VERDICT-line parser
leniency, #4 advisory-as-approved emit pattern, #5
`per_agent_context` redundancy) all sit inside the `trout-*`
substrate family that's being deprecated. Fixing them in-trout would
be patching code on its way out. The findings stay recorded in this
retrospective so the loom/draft transition can inherit them as known
patterns to address-or-skip in the new family; they do not get
separate `/trout-plan` projects.

**New projects to birth**: none. The substrate transition to loom +
draft is the implicit follow-up; any substrate hardening surfaces
there, not here.

## Closing note

The project shipped its design plan as written, end-to-end, across
five phases over 13 days. The substrate-vs-style separation it set
out to prove was proved twice over: once architecturally (the
`/a11y-review-file` composability demo) and once empirically (the
Phase 4 phase-start whiteboard catching design reframes before code
shipped). The follow-up findings are real but small; none of them
block the substrate from being used in anger by the next project.

**End-of-life context**: at archive time the user signaled that the
`trout-*` substrate family is being retired in favor of `loom-*` +
`draft-*` (visible already in the skills registry as `loom-archive`,
`loom-session`, `loom-pr-respond`, `loom-pr`, `draft-plan`,
`draft-revise`). The agent-guilds substrate as shipped is therefore
foundation work for that transition — the `guild-*` primitives and
the role-typed agent registry survive; the trout-flavored
orchestration moves to loom. The three deferred follow-up findings
(#3-#5) carry naturally into the loom inheritance rather than
needing to be patched into trout on its way out.

The agent-guilds substrate is now part of aart.camp's foundation.
Future projects compose it through whichever orchestration layer
(trout sunsetting; loom + draft ascending). This project is done.
