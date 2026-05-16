# Whiteboard: Phase 5 of the substrate-cli project authors 4 new agent files under `.claude/agents/`

## Round 1

### From whiteboard-a11y

The accessibility lens has narrow but real signal on this brief. Most of (A) through (E) belongs to other engineers — naming conventions and substrate-engineer rubric shape are squarely react-architect / design-systems / skeptic territory, and I'd be making things up if I led on them. Let me carve out where I don't apply and lead on the one place where I do.

**Carve-outs (explicit):**

- **(A) Naming**: domain-vs-tool naming is a `whiteboard-design-systems` and `whiteboard-react-architect` question. I have no a11y stake in whether the file is called `evaluator-vitest` or `evaluator-test-unit`. Defer.
- **(B) Substrate-engineer scope**: pure substrate/tooling design question. Skeptic and react-architect lanes. Defer.
- **(C) L-004 boundary documentation**: a process/visibility question about when smoke tests run. No a11y dimension. Defer to skeptic on the redundancy-vs-visibility tradeoff.
- **(E) Substrate-engineer rubric shape**: I have no view on what substrate-engineer should press on. Whoever drafts that rubric should look at how `whiteboard-skeptic` shaped its 'what you press on' section as the closest stylistic precedent.

**Where I do have signal: (D), with a wrinkle on the evaluator-playwright design.**

The whiteboard-testing-strategy vs evaluator-{playwright,vitest} boundary should mirror exactly how `whiteboard-a11y` and `evaluator-a11y` already split, and the precedent is worth leaning on hard because it's been load-bearing for this project. The carve-out language in `whiteboard-a11y.md` is the template: the whiteboard voice operates *upstream of code* on the contract — 'the design proposed here implies images carry meaning; we should design alt-text sourcing into the contract' — while the evaluator catches what slipped through on shipped artifacts. Translated to testing: whiteboard-testing-strategy advises 'this contract implies a test tier choice; pin down unit-vs-integration before the implementer guesses'; evaluator-vitest/playwright catches 'this test as written leaks fixture state across runs.' Lift the `## Carve-out:` section header verbatim from `whiteboard-a11y.md` into `whiteboard-testing-strategy.md` with the names swapped — keeps the family-shape consistent and the boundary readable to future panels.

**The wrinkle worth surfacing for (A) even though I'm deferring on the naming itself**: `evaluator-playwright` as currently scoped in the brief includes 'page-level a11y interaction' as one of its catalog domains. That's overlap with `evaluator-a11y`, which already declares the runtime `npm run test:a11y` signal as its lane (evaluator-a11y.md line 208-222). Two evaluators citing the same axe-core run with different rubrics will produce duplicate or contradictory findings on the same artifact. Recommend: evaluator-playwright explicitly *carves out* a11y-axe findings and defers them to evaluator-a11y, in the same way evaluator-a11y's CLI validators section is scoped. Otherwise the panel ends up with two evaluators racing for the same signal — exactly the cross-perspective courtesy problem `whiteboard-base.md` warns against, transplanted to the evaluator family.

**On the partial-CLI-signal question inside (A)** — the brief asks whether evaluator-playwright should (a) defer, (b) reuse test:a11y, or (c) be static-only until an e2e script ships. From the a11y lane: option (b) is wrong on its face. `test:a11y` is evaluator-a11y's signal, not a general-purpose Playwright signal, and reusing it would muddy the boundary I described above. Between (a) and (c), I'd lean (c) — static-analysis + grep rubric is honest about what the evaluator can actually do today, and the `## When neither signal applies` precedent from evaluator-a11y already gives the family a graceful pattern for 'no runtime signal available.' That's a `whiteboard-substrate-engineer` call ultimately, but worth flagging that the a11y family's existing pattern already solves the problem if they want to reuse it.

**What I'd want resolved by the next round**: the substrate-engineer or react-architect should confirm the carve-out language for evaluator-playwright vs evaluator-a11y on the runtime axe signal — that's the one finding I'd treat as load-bearing for the file authoring step, because getting two evaluators tangled on the same signal at authoring time is harder to untangle later than declaring the boundary now.

### From whiteboard-design-systems

Let me sit with this for a minute before diving in. The question we're really being asked across (A)-(E) is *cohesion* — how does a roster of agents stay legible as a family when new members arrive? That's the design-systems question dressed in substrate clothing. The agents are components; the roster is a component library; the frontmatter is the prop API; the naming convention is the token namespace. Same problem, different surface.

## (A) Naming — tool-name vs domain-name

This is the load-bearing question. The existing roster — `a11y`, `css-architecture`, `nextjs`, `react-api`, `tokens`, `naming`, `contract-fit` — is *almost* uniformly domain-named, but `nextjs` is already a tool name sitting inside it. So the convention isn't 'domain only.' It's something more like: **name after the thing the rubric is anchored to, at the granularity where the rubric stops being portable.**

- `a11y` — the rubric is portable across React/Vue/anything. Domain name fits.
- `tokens` — the rubric is about the semantic-vs-literal idea, portable. Domain name fits.
- `nextjs` — the rubric is anchored to App Router, RSC, file conventions, `'use client'`. A 'framework' evaluator would be too abstract to write a tight rubric for. Tool name fits *because the rubric doesn't generalize*.

That's the heuristic I'd apply to playwright/vitest:

- **`evaluator-vitest`**: the rubric you describe (mock vs real, `beforeEach` cleanup, `expect.assertions` for async, snapshot abuse) is *mostly* portable across Jest, Vitest, even Mocha — but the specific idioms differ (Vitest's `vi.mock` hoisting vs Jest's `jest.mock`, Vitest's parallel-by-default).
- **`evaluator-playwright`**: similar story. 'Integration test' is a contested category — Cypress, Playwright, even RTL-with-MSW all claim that territory with different idioms. Playwright's fixture model (`test.extend`, worker-scoped fixtures, `test.use`) is a *specific* shape the antipattern catalog hangs off.

**My lean: keep the tool names.** But — and this is the design-systems instinct — make the naming convention *explicit somewhere*, because right now it's implicit and the next contributor will guess wrong. Add a one-liner to `evaluator-base.md` or a roster README:

> Evaluators are named after the domain when the rubric generalizes (a11y, tokens, naming) and after the tool when the rubric is anchored to tool-specific idioms (nextjs, vitest, playwright).

That's the token-layer semantic contract for the agent roster. Without it, the next person writes `evaluator-cypress` without thinking and we end up with two evaluators that overlap 70%.

## (E) Substrate-engineer rubric shape — minimum-viable perspective body

The substrate-engineer agent has no sibling and no prior art, so the design-systems lens applies hard: *what vocabulary does this agent introduce, and does it fit the family?*

Six questions feels right — same density as the other whiteboarders:

1. **CRUD-vs-orchestration boundary.** Does this verb belong in `bin/loom` (low-level state manipulation) or in `scripts/` (composed workflow)? The smell: a `scripts/` command that reaches directly into substrate files without going through loom is duplicating loom's job; a `bin/loom` verb that knows about workflow context is leaking up. Find the seam.

2. **Append-only invariants under parallelism.** The event log is the substrate's source of truth. Any new write path must be append-only and idempotent under concurrent agent sessions. If a proposed change requires mutating an existing event or coordinating ordering between two writers, that's the design smell — the substrate is asking for a different shape.

3. **Family-shape consistency for new artifact types.** When a new agent / new artifact / new file type joins, does it match an existing family or start a new one? Same instinct as the components/shared/ vocabulary check: if `bucket-PR-manifest` already covers the role, don't introduce `pr-bucket-manifest`. Cohesion compounds; parallel naming costs forever.

4. **Schema-version evolution.** Substrate state is read by future sessions and future agents. Schema changes need a migration story — additive-only by default, version-tagged when not. The skeptic asks 'do we need this change at all'; the substrate-engineer asks 'if we do this change, what's the read path for sessions that pre-date it?'

5. **Idempotency of CLI verbs.** Running `bin/loom <verb>` twice should either (a) produce the same end state or (b) fail loudly with a clear 'already done' message. The antipattern is silent double-effect — a verb that appends two events when called twice, or that corrupts state on retry.

6. **Substrate gaps as first-class artifacts.** When a session surfaces a gap (the six from session-h), is the gap captured in substrate state itself, or only in human-readable notes? The lean: gaps belong in the event log too, with a known shape, so future sessions can query them.

**What it leans toward:**
- **Append-only over mutate-in-place.** Event-log shape over key-value-state shape.
- **Loom does CRUD, scripts do composition.** Don't blur the seam.
- **Existing family vocabulary** for new artifacts.
- **Explicit schema versions** when shape changes; additive evolution otherwise.
- **Idempotency by construction**, not by convention.

**Boundary with whiteboard-skeptic**: skeptic asks 'do we need this at all, what's the cheaper version, what breaks.' Substrate-engineer asks 'given we *are* doing this, what shape fits the substrate's invariants.' Skeptic pressure-tests the *premise*; substrate-engineer pressure-tests the *shape*.

**On the name itself** (part of question B): I think `substrate-engineer` is right for *this* codebase. 'Infrastructure' is too generic. 'Tooling' sounds like editor config. 'Developer-experience' is about the human surface, not the state model. 'Substrate' is the project's own vocabulary (substrate-cli, substrate state, substrate gaps) — using the project's term keeps the agent's name in the same semantic namespace as the thing it engages with. Same instinct as `<PrimaryButton>` over `<BlueButton>`: name it after what it *is* in the system's own language.

## (D) Whiteboard-testing-strategy vs the evaluators — boundary

**The whiteboard asks about the test as a designed thing; the evaluator asks about the test as a built thing.** Before/after, design-phase/review-phase, contract/conformance. Same dichotomy as token-design (whiteboard) vs token-literal-detection (evaluator-tokens).

Concretely:
- whiteboard-testing-strategy: 'should this be a unit test or an integration test, given the contract you're defending?' 'is this fixture going to fight us in six months?' 'are you mocking the thing whose behavior is the actual subject of the test?'
- evaluator-vitest: 'this test has `expect.assertions` missing on an async path.' 'this `beforeEach` is leaking state.' 'this snapshot is testing implementation detail.'

Make this explicit in *both* files — symmetric documentation; future panels grep either side and find the same answer.

## (C) L-004 boundary documentation — defer

This is mostly a process question. Quick read-only thought: **option (iii) — follow-up unit — is the most legible.** A note in PLAN.md alone is invisible to future readers of the agent files themselves; a note in each agent body is redundant boilerplate that ages poorly. A scheduled follow-up unit makes the constraint a first-class piece of work rather than a footnote.

## Summary of leans

- (A) Keep tool names for vitest/playwright. Document the heuristic in `evaluator-base.md` so the convention is explicit, not implicit.
- (E) Six pressure-points sketched above; lean toward append-only, loom-vs-scripts seam, family-vocabulary reuse, additive schema evolution, idempotency-by-construction.
- (B) `substrate-engineer` is the right name in this codebase's vocabulary. Resist generalizing.
- (D) Symmetric boundary docs in both whiteboard and evaluator files. Same shape as a11y's existing split.
- (C) Weak signal — defer.

### From whiteboard-performance

Most of this brief sits outside my lens — these are agent-authoring decisions about naming, scope, and rubric shape, not runtime cost decisions. The agents themselves are markdown files loaded by Claude Code; they don't ship to a browser, they don't hydrate, they don't have a `'use client'` boundary. I'll carve out hard on (A), (B), (C), (D) and lean into (E) only where a substrate-engineer perspective would itself need to think about cost-of-the-shape — because that's the meta-overlap worth flagging.

## (E) — substrate-engineer rubric, with a perf-adjacent note

I'll let the react-architect and skeptic engineers lead the bulk of (E). One thing to flag from my lens, because it's the kind of question I'd press on if I were the substrate-engineer voice in a panel:

**Cost of substrate decisions compounds across sessions.** When the substrate-engineer presses on family-shape consistency, one of the design questions worth pressing is *what does this cost at runtime?* Not browser-runtime — Claude-Code-runtime. Specifically:

- **Agent registry load**: every `.claude/agents/*.md` is loaded into the registry at session start. Four new agents in one session is fine; forty would matter. The cost isn't dramatic but it isn't free. The substrate-engineer voice should be the one tracking whether the roster is growing faster than the conceptual surface justifies — same as I'd flag a bundle creeping up by 5KB per feature.
- **Cross-agent overlap as duplicated work**: two evaluators with overlapping rubrics means a panel run is computing the same finding twice with two attributions. The boundary work this brief calls out in (D) is directly about this — and it's the same shape as 'don't put the same component in two trees.'
- **Substrate operations on the hot path**: event-log appends, manifest reads, bucket-PR walks. The substrate-engineer should press on whether a proposed verb adds work to every command or just to the command that needs it. (Analogous to 'does this run on every render or only when state changes.')

So a perf-adjacent rubric add for substrate-engineer might be: *'What's the per-session cost of this substrate addition? Does it load on every CLI invocation, every session start, or only when invoked? Is that the right place?'*

Sketched as a perspective bullet:

> **Cost-of-substrate.** Substrate decisions compound. A verb added to bin/loom runs in everyone's session; an agent added to the registry loads at every session start; an event-log schema change touches every event ever written. Press on whether the cost lives in the right place — invocation-time, session-time, or write-time — and whether the cost matches the value.

That's one of the 4-6 design questions. The other 3-5 belong to engineers whose lens fits better.

## Carve-outs

- **(A) naming**: not my lens. Defer.
- **(B) substrate-engineer scope**: not my lens.
- **(C) L-004 boundary documentation**: not my lens.
- **(D) whiteboard-testing-strategy vs evaluators**: mostly not my lens, but one tiny note — the design-phase-vs-review-phase split that whiteboard-a11y/evaluator-a11y already established is the cheap pattern to reuse, and 'cheap' here means *cognitive cost to future panel-invokers*. Reusing an existing boundary shape is less expensive than inventing a new one. That argues for mirroring the a11y split verbatim.

### From whiteboard-react-architect

I sit a little to the side of this brief — most of the questions are about substrate shape and testing-discipline framing, not React-API surface. But the agent roster IS an API surface in a real sense (it's a vocabulary other panels reach for at the call site), so the parts that rhyme with prop-API design are where I have signal.

### (A) Naming: tool-name vs domain-name — strong opinion here

This is exactly the same shape as the `<VStack>` vs `<Stack direction='vertical'>` debate I press on in component APIs. And I think the existing roster has already made the call — the new agents should follow.

The current evaluator family reads like a set of domain lenses. `evaluator-a11y` evaluates accessibility regardless of whether you reached it via axe, manual keyboard testing, or a screen reader. `evaluator-css-architecture` evaluates CSS structure regardless of whether the codebase uses CSS Modules, vanilla-extract, or PostCSS. The tool is the instrument; the domain is the lens.

`evaluator-playwright` and `evaluator-vitest` break that pattern. They read like `<PlaywrightTable>` and `<VitestForm>` — the tool name has leaked into the API. The smell test: if next year you add Cypress for component tests, do you author `evaluator-cypress` as a third sibling? Now the family has three tool-named evaluators with overlapping rubrics. The rubric isn't really Playwright-specific or Cypress-specific — it's *integration-test-specific*, with tool-specific idioms layered on top.

I'd argue for `evaluator-test-integration` and `evaluator-test-unit`. Reasoning:

- **The domain is the tier, not the tool.** 'Integration test' and 'unit test' are stable concepts; 'playwright' and 'vitest' are this-year's tools.
- **It composes with the existing roster's grammar.** `evaluator-test-integration` reads as 'evaluator for the test-integration domain,' same shape as `evaluator-css-architecture`. `evaluator-playwright` reads as 'evaluator that knows playwright,' which is a different grammar.
- **Tool-specific idioms fit inside, not outside.** When the rubric needs to call out a Playwright-specific antipattern (say, `page.waitForTimeout()` over `expect().toHaveText()`), that's a rubric entry inside `evaluator-test-integration`.
- **The naming-prefix order matters.** `evaluator-test-*` clusters in tab-completion and file listings, which mirrors how `whiteboard-*` already clusters. Putting 'test' first in the suffix makes the testing family legible as a family.

The counter-argument worth steelmanning: Playwright and Vitest each cover essentially one testing tier in practice, so the tool name and the tier name are nearly synonymous *today*. And tool-name agents do carry useful information — they tell the caller 'this evaluator knows the actual API surface you're working against.'

But I'd rather pay the small cost of one extra mental hop ('integration tests, which in this repo means Playwright') to keep the roster's grammar consistent. The grammar IS the API. Once you break it for one entry, every future caller has to remember which family follows which convention.

**Recommendation: rename to `evaluator-test-integration` and `evaluator-test-unit` before authoring.** Cheap to do now, expensive to walk back later.

### (B) Substrate-engineer scope and naming

The name 'substrate' is project-internal vocabulary. If this agent is going to be invoked from panels outside the substrate-cli project's frame, that vocabulary is opaque. But I'd actually keep `whiteboard-substrate-engineer` *because* 'substrate' is a load-bearing project term. The agent's whole job is to think in substrate-shaped invariants (append-only, idempotent, schema-versioned, parallel-safe). Renaming it to soften the vocabulary would make it less precise about its own lens. The cost is: callers who don't know what 'substrate' means in this project won't reach for it. That's actually fine — if you don't know what substrate means, you probably aren't designing substrate.

Scope vs whiteboard-skeptic: skeptic pressure-tests any consensus. substrate-engineer specifically advocates *for* substrate-shaped properties. They'll often agree but from different angles — skeptic asks 'what breaks?', substrate-engineer asks 'does this preserve the invariants?'. The skeptic might miss substrate-specific failure modes because the skeptic lens is general-purpose. substrate-engineer is the domain lens that catches those.

### (C) L-004 boundary documentation

The React-API analogy here: this is exactly the 'side effects on prop change' pattern I press on. A new agent file is a side effect that only fires after a 'prop change' (session restart). If the prop changes but the effect doesn't fire until later, callers will be confused.

Of the three options, I'd lean **(iii) follow-up unit in the next session**, with a lightweight breadcrumb in PLAN.md but nothing in the agent bodies themselves.

- **Option (i) — note in each agent body — is API leakage.** The agent's body is its perspective contract. It should describe what the agent does, not the operational state of the substrate at the moment of authoring.
- **Option (ii) — PLAN.md alone — works but is invisible at the smoke-test moment.**
- **Option (iii) — follow-up unit — is the substrate-correct shape.** The constraint is a substrate fact, and the substrate has a way to model 'work that must happen in a new session': a follow-up unit.

The breadcrumb in PLAN.md is the 'Verification' section noting 'smoke tests run in follow-up unit U-XXX in next session due to agent-registry session cache.'

### (D) Whiteboard-testing-strategy vs evaluators boundary

Strong lens here — this is exactly the design-phase-vs-review-phase split the existing roster already encodes.

The boundary I'd write into `whiteboard-testing-strategy.md`'s 'Boundary with sibling engineers' section:

> **`evaluator-test-integration` / `evaluator-test-unit`**: the evaluators catch antipatterns AFTER the test is written — fixture leakage, missing cleanup, snapshot abuse, parallel-unsafe assertions. You advise BEFORE the test is written — which tier should this test live in, should this dependency be mocked or real, is this even the right thing to test. Overlap on 'should this be a unit test or an integration test?' — you lead from the design-tier angle (what is this test actually verifying?), evaluators lead from the rubric-conformance angle.

One concrete piece I'd add to `whiteboard-testing-strategy.md`'s 'what you lean toward' section: **'Test the boundary, not the implementation.'** When advising on React-component tests specifically, the strategy voice should push toward testing user-visible behavior (what the consumer sees) rather than internal hook state or prop-threading mechanics.

### (E) Substrate-engineer rubric shape

Carving out — this is design-systems and substrate-engineer territory more than React-API territory. One small piece I can offer from the API-shape angle: **the family-shape question is the same shape as 'composition over configuration.'** When a new agent could join an existing family OR start a new one, the substrate-engineer voice should press the same way I press on component-family decisions — does this share an invariant with the existing family, or is the shared part just surface-level naming?

### From whiteboard-skeptic

The brief is well-scoped and the panel will mostly converge on the affirmative. Let me press on the places I think the consensus will skip too fast.

### (A) Naming: tool-name vs domain-name

I want to push back on what I suspect the consensus answer will be ('tool names are fine because the rubric is tool-specific'). That answer is locally true but globally costs you something.

The existing roster reads as a vocabulary of *concerns*. When a future panel orchestrator scans the roster, it scans by 'what am I worried about?' not 'what tool did we pick?' Adding `evaluator-playwright` and `evaluator-vitest` means the next reader has to translate twice: tool name to tier (playwright = integration), tier to concern (integration test antipatterns).

The counter-argument the panel will make — 'but the rubric IS tied to the tool's idioms' — is half-true. A lot of the rubric IS tier-shaped, not tool-shaped:
- `beforeEach` cleanup, `expect.assertions` for async, snapshot abuse — these are unit-test antipatterns that show up in jest, vitest, bun:test, node:test alike.
- Fixture leakage, parallel-test isolation, retry policy — these are integration-test antipatterns that show up in Playwright, Cypress, WebdriverIO alike.

The *tool-specific* bits are maybe 20-30% of each rubric. If you name the file after the tool, that 20-30% becomes load-bearing for the name; if you name it after the tier, the tool-specifics are appendix-shaped, and a future Cypress evaluator can fork the integration rubric cleanly rather than reinvent it.

**My recommendation: `evaluator-test-unit` and `evaluator-test-integration`** (the `test-` prefix keeps them grouped alphabetically in the roster, which matters when you have ~10 evaluators). Inside each file, declare the tool at the top (`Primary tool: vitest`, `Primary tool: playwright`) and let the rubric be tier-shaped with tool-specific sections clearly labeled.

The risk if you go tool-name: in 18 months you ship a Cypress component-test evaluator and discover 60% of its rubric is duplicated from `evaluator-playwright`. That's the kind of lock-in that compounds.

The risk if you go tier-name: a junior reader doesn't immediately know which test runner the rubric assumes. That's a one-line fix at the top of the file. Much cheaper failure mode.

### (B) `whiteboard-substrate-engineer` scope and naming

**Scope vs whiteboard-skeptic**: I'm the skeptic and I think this voice should exist, but I want to be precise about why so it doesn't end up doing my job. The skeptic pressure-tests *any* design by surfacing edge cases. The substrate-engineer pressure-tests a *specific class* of design — the ones that touch parallel-safe append-only stores, CRUD/orchestration boundaries, schema evolution, and idempotency. I ask 'what user behavior breaks this?', substrate-engineer asks 'what concurrent agent session breaks this?'

Concretely, on the 6 gaps from session-h: I would have caught maybe 2-3 of them. The other 3-4 — schema-version evolution, append-only invariants, worker_bindings semantics — require knowing the substrate's contracts deeply enough to know which invariants are load-bearing.

**Naming**: I'd vote `whiteboard-substrate-engineer` and add a one-paragraph 'what substrate means here' header to the file. The portability cost is real but the lens is genuinely substrate-shaped, not generic-systems-shaped.

(One thing to watch: if you name it `whiteboard-substrate-engineer`, the next reader assumes there's an `evaluator-substrate-engineer`. There isn't, and there shouldn't be — substrate concerns are design-phase, not review-phase. Note that explicitly in the file body.)

### (C) L-004 smoke-test boundary

Option (iii) — a follow-up unit in the next session — is the right answer.

L-004's whole point is that authoring-session and runtime-session are different worlds, and the substrate's invariant is that you don't claim verification you can't actually run. PLAN.md should say 'smoke tests deferred to next session, tracked as unit X'. Each agent file gets *no* note about this — the agent files are runtime artifacts and shouldn't carry session-coordination metadata; that's PLAN.md's job. The follow-up unit makes the deferral visible in substrate state.

The risk with option (i) — a note in each agent body — is that it ages poorly. Once the smoke tests run, those notes are stale.

### (D) whiteboard-testing-strategy vs evaluators boundary

The panel will get this right by analogy. The thing I want to flag is the boundary isn't actually 'before vs after the test is written' — it's 'what to test' vs 'is this test well-formed.'

- **whiteboard-testing-strategy owns**: tier choice (unit vs integration vs e2e), what surfaces deserve coverage at all, fixture-vs-factory architecture, mock-vs-real dependency at the boundary level, test-suite organization, what to skip and own as risk.
- **evaluator-test-unit owns**: given a unit test exists, is it well-formed? Assertion shape, isolation, naming, parallel-safety within the unit suite.
- **evaluator-test-integration owns**: given an integration test exists, is it well-formed? Fixture leakage, retry policy, page-level interaction patterns, snapshot drift.

The overlap zone is 'should this be a unit or integration test?' — that's a whiteboard question (design-phase) but an evaluator might catch it post-hoc. Both files should name this overlap explicitly.

### (E) substrate-engineer perspective body — minimum viable

The questions I'd press on:

1. **Append-only invariants**: Does this design preserve the event log's append-only property? Are there any code paths that mutate existing events, rewrite history, or assume reads return a stable snapshot?

2. **Parallel-session safety**: If two `/ev-run` sessions are in flight concurrently, what breaks? Which files does this design write to, and are those writes safe under interleaving?

3. **CRUD vs orchestration boundary**: Is this verb a primitive (single-purpose, idempotent) or an orchestration (composes primitives)? Primitives go in `bin/loom`; orchestrations go in `scripts/`.

4. **Schema-version evolution**: If this design introduces a new frontmatter field or event shape, what's the migration story for existing instances?

5. **Idempotency**: Can this operation be run twice safely? What's the behavior of 'I ran this, the network died, I ran it again'?

6. **Family-shape consistency**: When a new artifact joins an existing family, does it follow the family's existing conventions?

**What it leans toward:**
- Naming the invariant before naming the implementation.
- Boring, idempotent, single-responsibility primitives.
- Schema evolution by soft-extension first.
- Family-shape consistency over local optimality.

**What it doesn't do:**
- It's not a code reviewer.
- It's not the skeptic.
- It's not a performance voice.

### One concern not yet on the table

The roster is growing — you're going from ~9 agents to 13 with this PR. At some point the orchestrator has to choose which voices to invoke for a given panel, and 'invoke all of them' becomes expensive. Is there a story for *which subset* of the whiteboard family gets invoked for a given brief? Right now I think it's implicit ('the orchestrator picks based on the brief'), but as the roster grows, the picking heuristic itself becomes load-bearing. Worth surfacing as a follow-up concern — not blocking, but the kind of thing that compounds if left unaddressed for another 4-5 agents.

That's not a phase-5 problem. It's a phase-7-or-8 problem. Flag it now so it doesn't surprise you later.

### From whiteboard-sketch-ideation

This isn't my lane.

The brief is about substrate agent design (frontmatter shape, rubric structure, naming conventions for evaluator/whiteboard families) — that's `bin/loom`, `.claude/agents/`, the guild-* and griot-* families, the substrate-cli project itself. None of it touches `sketches/`, the `<Sketch>` wrapper, `registry.ts`, the `app/sketch/[slug]/` shell, or the gallery's portfolio framing.

The sketch-creative voice has nothing useful to add to a conversation about whether `evaluator-playwright` should be `evaluator-test-integration`, or whether `whiteboard-substrate-engineer` overlaps with `whiteboard-skeptic`. Defer entirely to `whiteboard-substrate-engineer` (once it exists), `whiteboard-skeptic`, and whoever owns evaluator-family naming conventions.

Passing.

