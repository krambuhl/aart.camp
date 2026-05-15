# Whiteboard: Phase 4: domain pairs — generator-evaluator substrate design

## Round 1

### From whiteboard-react-architect

Reading this brief I want to flag upfront: most of these questions are about the agent-substrate's API shape, not React. The React-API lens still has signal here because "agent contracts" and "component contracts" rhyme — both are about how a thing-with-an-interface gets composed by callers it doesn't know in advance. I'll lead on the API-shape rhymes, defer the substrate-sequencing ergonomics to whiteboard-skeptic, and stay quiet on token-rubric specifics that are whiteboard-design-systems' territory.

## The generator-* contract: hooks-vs-monoliths, applied to agents

The existing family is split cleanly between whiteboard-* (prose section per perspective) and evaluator-* (structured verdict against a packet). The instinct in Phase 4 will be to make generator-* a third sibling with its own bespoke I/O shape, but I want to push back: **the generator's output is just an artifact, and the artifact already has a contract** (the unit's Contract block — Goal, Acceptance, Rules, Disqualifiers, Inputs). The right framing is that generator-* agents take a Contract as input and return a *proposed artifact* as output. That's the same shape the main-conversation generator (today's Claude) already produces. The generator family isn't a new contract — it's a *parameterization* of who fills out the artifact.

This matters for the React-API rhyme: smaller, composable, contract-respecting wins. The monolithic-generator version wins only if a generator genuinely needs state the contract can't express — which I don't see in the CSS codemod case.

One concrete suggestion: generator-* agents should output a *proposed* artifact-plus-checkin pair, not commit anything. Same read-only constraint that whiteboard-* and evaluator-* already inherit. The loop is the only thing that writes. That keeps the substrate's "agents propose, orchestrator disposes" symmetry intact across all three families.

## The sequencing question: lift state to the right layer

**First, where does the "is this a domain-pair unit?" state live?** Options ladder from local to authoritative: the generator declares its pair (coupled), the unit's contract names the pair, the phase config names the pair, or auto-derivation infers it from file types. I lean strongly toward **phase config plus contract override**, which is exactly the pattern PANEL-COMPOSITION.md § Override and opt-out already documents as a "Phase 4-shaped concern." Don't invent a new state location — use the one the panel already established (Panel: +evaluator-css-architecture on the contract), and add a parallel Generator: line if a non-default generator is being named.

**Second, the "specialist runs solo first" gate should be explicit and predictable, not buried.** The loop should literally have a step that reads "if the unit's panel includes a domain-pair specialist, run that specialist first; on approval, continue to the rest of the panel; on flag, return the verdict and skip the panel." Make it visible in the skill prose, not buried in aggregation logic.

## Stub activation criteria: documentation shape is a prop-API problem

The question is: **what does the error message look like, and where do the activation criteria live?**

I'd argue strongly against putting activation criteria only in the agent body's prose. Agent bodies are LLM-shaped — they describe behavior to the spawned model. Activation criteria are *loop-shaped* — they describe preconditions to the substrate. Put them in **frontmatter as structured fields**:

```yaml
---
name: generator-storybook-stories
role: generator
status: stub
activates-when:
  - "Storybook is installed (package.json declares @storybook/*)"
  - "A stories convention doc exists at projects/CONVENTIONS.md § Storybook"
  - "At least one hand-authored .stories.tsx exists as a reference"
activation-tracked-in: projects/2026-05-02-agent-guilds/PLAN.md#phase-4-stubs
---
```

The error message becomes a render of those fields. Same shape every stub uses; the loop's stub-detection code reads frontmatter rather than parsing prose.

## Where I defer

- What evaluator-css-architecture's rubric should be — design-systems' lane.
- Blast-radius / coupling-we'll-regret — skeptic's pressure-test.
- Perf cost — performance's lane.

## What I'd want resolved next round

1. Does the generator-* family really take a unit Contract as input and return an artifact-plus-checkin?
2. Are activation criteria frontmatter-structured or body-prose? My vote is frontmatter for criteria, tiny prose explainer.
3. Does the specialist-first gate live as an explicit step in skill prose? Visible-step wins — predictability is a substrate virtue.

### From whiteboard-design-systems

The Phase 4 brief is the substrate finally meeting its own design-systems test. Up to now the *-base.md files have been authored opportunistically; this is the first phase where the vocabulary has to be defended as a system, not just extended. Most of my pressure-test lives in naming and in whether the new family fits the prior art — that's also where I think the brief is shakiest.

**1. "Domain pairs" is a literal name dressed up as a semantic one.**

whiteboard-*, evaluator-*, guild-*, griot-*, trout-* — every existing family in this substrate is named for what it IS or what it MEANS, not how it pairs with something else. "Domain pair" is the only proposed name that describes the *shape of the relation* between two things rather than what either thing is.

Worse, the actual new agent file isn't called domain-pair-*; it's called generator-*. So "domain pair" is a *conceptual frame* the project uses for itself, while the on-disk vocabulary is just generator-* + evaluator-*. Those are two different stories. Pick one.

My lean: the on-disk family is generator-* and the brief should commit to that. "Domain pair" disappears from the noun-vocabulary and becomes a *pattern name* described in CONVENTIONS.md or in a generator-base.md doc — analogous to how "panel" is a pattern over evaluator-*, not a separate noun. The pattern is real ("specialist evaluator runs solo first, panel only on its approval"), but it's a sequencing pattern over existing families, not a third family.

**2. generator-* should inherit the same base-file pattern, and its base is load-bearing.**

evaluator-base.md and whiteboard-base.md set the precedent: a non-callable shared contract that every family member reads at spawn. Phase 4 needs generator-base.md for the same reason.

What goes in generator-base.md:
- The input contract. Generators consume a *unit contract* (Goal / Acceptance / Rules / Disqualifiers / Inputs — same shape evaluators consume).
- The write-capable stance. Unlike evaluator-base and whiteboard-base, this family *does* mutate the repo. Tools allowlist is wider but still scoped — explicitly NOT Bash(git commit:*) / Bash(gh pr:*). Generators produce artifacts; the orchestrator owns commits.
- The activation gate. A frontmatter field — call it `activation:` with values `active | stub` — is the semantic switch. A stub generator's body is dominated by an "Activation criteria" section.

That last bullet is the critical one for question 3. "Stub on disk but not callable" needs to be a *property of the agent*, not a property of the spawn skill.

**3. The "specialist runs solo first" sequencing is correct, but name the states.**

Better than "specialist-first" / "panel-second": the specialist evaluator is the **gate** (domain-correctness gate). The panel is the **broader review** (cross-cutting concerns). Naming the *role* of each stage, not the *order*, means a future sequencing change doesn't break the vocabulary.

This also clarifies the failure mode the skeptic will want to press on: what happens when the specialist approves but the panel flags? That's not a "second opinion" — that's a different *kind* of finding. Both can be true. The gate-then-review framing makes that obvious; "specialist-first" obscures it.

**4. evaluator-css-architecture vs. evaluator-tokens — name the boundary now or pay later.**

Phase 2 already shipped evaluator-tokens (literal-vs-token) and evaluator-naming (right-name within the token vocabulary), and PANEL-COMPOSITION.md has a careful tokens-vs-naming boundary section. Phase 4 introduces evaluator-css-architecture paired with the CSS codemod generator. That's a third lens on the same files (.module.css).

If the boundary between architecture / tokens / naming isn't authored in the same PR as the new evaluator, this turns into three overlapping evaluators all firing on the same lines within six months. My read of the natural carve-out:

- evaluator-tokens (D4): is the artifact using the token system at all, or are there literals leaking in?
- evaluator-naming (D5): given the token system is in use, is the right *name* chosen for each role?
- evaluator-css-architecture (Phase 4): is the CSS module *shape* correct — selector specificity, cascade behavior, composition vs. duplication of rule blocks, when to use :global, layout patterns matching Stack/Grid/Area rather than ad-hoc flex? Architecture is structural; tokens and naming are vocabulary.

Add a "Boundary with adjacent evaluators" section to the new file *and* extend PANEL-COMPOSITION.md's tokens-vs-naming subsection to be a tokens-vs-naming-vs-architecture triangle. Otherwise the third lens just creates three flags on the same line and the panel becomes noise.

**5. Stub-pair activation criteria: name the token-authoring step explicitly where it applies.**

When a stub generator's "activation criteria" includes design-system work, the criterion should name it concretely. Phase 4's authoring should treat the stub's "Activation criteria" body as a real specification readable by a future engineer, not a placeholder. If the criteria are concrete and load-bearing, the stub doubles as a forward-looking spec and doesn't rot. If they're vague ("when we want this"), they will.

**What I'd want resolved in the next round:**

The biggest thing I haven't seen the brief settle is the *name* — generator-* as the family, "domain pair" as a deprecated frame, gate-then-review as the sequencing pattern name. The architecture-vs-tokens-vs-naming boundary specifically is something I want to co-author with whoever lands the Phase 4 PR.

### From whiteboard-performance

# Performance perspective: domain pairs (Phase 4)

Let me walk through where the cost actually lives in this design.

## The spawn-count math

Today's per-unit shape: generator runs, then an antagonist panel evaluates in parallel. Call that **1 generator spawn + N parallel evaluator spawns**, where the panel is wall-clock-bound by the slowest evaluator.

Phase 4 with a domain pair named:

1. generator-css-codemod spawn (does real work — reads, plans, possibly writes)
2. evaluator-css-architecture spawn (specialist, solo, **must complete before step 3**)
3. If approved: antagonist panel spawn (N evaluators in parallel)
4. If rejected: stop here, loop back

The new cost is the **serial dependency between steps 2 and 3**. The specialist gate is a latency multiplier on the happy path. Worth it depends on the rejection rate. Evaluators are cheap (read-only, quick verdicts per the agent contract), so the latency add is small in absolute terms.

Where this earns its keep is **on rejection**: the specialist catches the domain-specific failure mode before five antagonists each independently flag adjacent symptoms. That's not just a cost win — it's a signal-quality win. Letting the specialist short-circuit means rejection feedback is one clear voice, not a chorus.

So: **the serial cost is acceptable, but only because evaluators are cheap.** The pattern would not survive if specialists were expensive. Worth flagging that constraint explicitly in the contract — domain specialists must stay in the read-only-quick-verdict shape, not drift toward generator-weight work.

## Generator agents are a new cost profile

This is the part I want to press on hardest. evaluator-* and whiteboard-* are both read-mostly, prose-output agents. generator-* is something else: it does **real work**. CSS codemod planning means reading source files, parsing CSS, generating transformation plans, possibly writing migration artifacts. The tool-call budget per spawn is materially higher than an evaluator's.

A few things follow:

- **Generators need explicit scope limits in their contract.** Without that, the cost-per-unit becomes unpredictable.
- **Generators are the right place for parallelism budgeting.** The family contract should make parallelism opt-in, not implicit.
- **Reads-vs-writes matters for the loop.** The generator contract should specify what files persist vs scratch. Otherwise we get context bloat as a slow leak.

The cost ask for the generator contract: **declare what files you write, declare scratch vs. persistent, and the orchestrator GCs scratch between iterations.**

## Stub overhead is essentially free (with one caveat)

The three stub pairs — six new agent files on disk. Per L-004 they don't enter the registry until session restart, and even after that, an agent file that's never invoked has zero runtime cost. So the steady-state overhead is genuinely nothing.

The only cost is **what happens when the loud-error path fires.** Someone names a stub generator in a phase config. The orchestrator needs to:

1. Recognize the agent exists but is a stub.
2. Refuse to invoke it.
3. Surface the activation criteria from the stub's own contract.
4. Fail the phase loudly.

**The cheap path is metadata-on-the-agent-file, read by the orchestrator before spawn.** Worth specifying that in the activation-criteria contract.

## CSS codemod active pair: scope discipline

The temptation will be to give generator-css-codemod broad scope ("plan any CSS migration"). Resist. The narrower the scope, the more predictable the cost, the easier the specialist evaluator's job, and the cleaner the contract that the three stub generators will mirror.

A specific cost concern for CSS codemod planning on this site: tokens flow through a generated pipeline. A codemod that touches token references has to understand that pipeline. If the generator's contract is "plan the codemod end-to-end including pipeline-aware token rewrites," it's going to be read-heavy. If the contract is "plan the per-file CSS transform; assume the token pipeline is regenerated by npm run generate:tokens after," it's much lighter.

Strong preference for the narrower framing.

## The blast-radius picture

The domain-pair pattern adds cost in three places:

1. **Latency on the happy path** — small, acceptable.
2. **Generator execution variance** — generators can sprawl. Mitigation lives in the generator contract.
3. **Orchestrator stub-detection** — essentially free if metadata-based.

The pattern is affordable. The thing that would make it un-affordable is letting generators drift toward expensive, broad-scope work. **The cost discipline lives at the generator-contract level, not in the sequencing.**

## What I'd want to measure after this lands

- Specialist-evaluator rejection rate for generator-css-codemod over the first ~10 unit runs.
- Wall-clock cost of generator-css-codemod invocations, p50 and p95.
- Number of files written per generator invocation.

Pre-ship, the recommendation is: tighten the generator contract on scope + artifacts before we worry about anything else.

### From whiteboard-a11y

Mostly out of lane — this is substrate work. But three places where a11y belongs in the contract, listed shortest-first.

### 1. evaluator-css-architecture rubric should include contrast-impact for token migrations

Yes, this should be in scope. The example you raise (`color: #999` → `token("color.text.subtle")`) is the canonical case: a codemod that *looks* mechanical can silently change rendered contrast.

- **The contrast check is a property of the migration, not the code.** Whether `#999` on `#fff` passes WCAG AA depends on the foreground/background pair at the use site.
- **Cheaper version: flag token swaps where the resolved hex differs from the literal.** Not "does this pass contrast" but "this codemod changed the actual color value, not just the source of truth — surface that for human review."
- **Even cheaper: require the codemod's PR description to enumerate the value deltas.** Push the burden onto the generator.

My recommendation: add a rubric item like *"For codemods that touch rendered visual properties (color, background, border, font-size, line-height, focus styles), the PR must include a resolved-value diff. The evaluator flags absence of that diff, not the contrast math itself."*

Adjacent gotcha: focus-visible outlines. A codemod that touches `outline`, `box-shadow`, or `:focus-visible` styles can erase keyboard-affordance without touching any a11y attribute. Worth calling out as a specific risk category.

### 2. generator-storybook-stories activation criteria

Storybook a11y addon runs axe-core in the story preview. If the generator produces stories, those stories become a11y test fixtures for free — *if* they exercise the right states.

Activation criteria worth pinning down:
- **Default states only, or also error/loading/disabled?**
- **Form components need labeled stories.**
- **Decorators that affect a11y context** (ThemeProvider, DirectionProvider).

Defer to whoever owns the generator on shape, but the activation criteria doc should mention "stories are a11y fixtures whether you intended them to be or not."

### 3. generator-playwright-e2e activation criteria

Playwright + axe-core is the common pairing. Two flags:
- **Scoping rules need to be a deliberate input.** The aart.camp test:a11y config exempts canvas elements; any generated Playwright a11y check needs the same exemption surface.
- **Keyboard-path tests are separate from axe scans.** Axe catches static violations. It doesn't catch "tab order is broken" or "focus doesn't return to the trigger after dialog close." Worth naming in the activation criteria.

### What I'd leave alone

- The substrate work itself (agent files, ev-loop sequencing). No a11y angle.
- The CSS codemod scope beyond rendered-output properties.
- The stub pairs' general shape.

Short version: the CSS codemod evaluator should flag *value deltas in visual properties* (not do contrast math itself); the Storybook and Playwright stubs should name a11y-fixture-status and exclusion-scoping respectively in their activation criteria.

### From whiteboard-sketch-ideation

Defer on the Phase 4 design — substrate lane. One drive-by for the generator-css-codemod + evaluator-css-architecture pair's eventual scope:

**When the codemod sweeps `components/app/Sketch/Sketch.module.css`, two patterns there are load-bearing and not anti-patterns:**

1. **`!important` on canvas width/height**, because we're overriding p5.js-authored inline styles we don't control. p5.js writes inline `width`/`height` styles onto its `<canvas>` element from `createCanvas(w, h)`. The `!important` rules are the wrapper's way of saying "I don't care what p5 thought the pixel dimensions were, render it responsively at 100% width with auto height." If a CSS codemod is later configured to flag `!important` as a smell (which most well-meaning CSS linters/codemods do by default), this is the one place in the codebase where stripping it would silently break every sketch's responsive sizing.

2. **The descendant `& canvas` selector**, because the canvas DOM node is owned by p5 and can't carry a CSS-Module class. A codemod that "normalizes" descendant selectors (e.g. unnests `& canvas` into a separate class, or rewrites to a CSS-module-scoped class on the canvas itself) can't easily put a class on the canvas because p5 owns that DOM node — the wrapper styles its children unscoped on purpose.

Worth either an inline comment in that file before the codemod pair activates, or a known-exception note in the evaluator's criteria. Not blocking Phase 4 — just a thing to pin before the codemod's first real run touches sketch infrastructure.

Beyond that, no other sketch-CSS surface area exists today (zero `.module.css` files inside `sketches/`, zero inside `app/sketch/[slug]/`), so the codemod's blast radius against sketch idioms is genuinely tiny. The `SketchNav.module.css` file is gallery chrome — design-systems' lane, not mine.

### From whiteboard-skeptic

The "domain pair" framing is doing two pieces of work at once — it's introducing a *generator* role (new) alongside a stronger commitment to *specialist evaluators* (already shipped). I'd separate those before treating the whole thing as one design. The first is novel substrate; the second is already in PANEL-COMPOSITION.md (Panel: +evaluator-css-architecture is even pre-documented as the v2 override hatch). When the brief asks "is domain pair load-bearing or substrate inflation," I think the honest answer is: **the generator side is load-bearing, the "pair" framing is mostly inflation.** The specialist evaluator side could ride entirely on what Phase 2 already shipped, with a Panel: +evaluator-css-architecture override per phase config. That's not a new substrate concept; it's a use of an existing one.

Three concrete risks worth surfacing before the contract lands.

**Risk 1 — the specialist-solo-first short-circuit is the most expensive choice in the design and it's not justified yet.** "Specialist runs solo first, panel only on its approval" is a *control-flow* claim about the loop, not a substrate primitive. It does two things: (a) it cuts panel cost when the specialist rejects (good — fail fast), and (b) it cuts panel signal when the specialist *approves* (bad — the panel never gets to see the artifact). The bad case is the worrying one. **The specialist evaluator is, by construction, the lens *most likely* to approve work in its own domain** — that's the lens the generator was built against. The whole point of running an antagonist panel is to catch the things the domain author didn't think to look for: a generator-css-codemod + evaluator-css-architecture pair will produce CSS that passes the css-architecture rubric by construction, and exactly that kind of artifact is where evaluator-a11y or evaluator-tokens are most likely to land a surprise hit. Skipping the panel on specialist approval is the substrate equivalent of "the author marked their own homework" — even with isolation, the rubrics are aligned.

Concrete remedy: invert the order. **Run the panel always; let the specialist's verdict be one voice within it** (with elevated precedence, per PANEL-COMPOSITION's existing precedence mechanism). If the budget concern is real, gate it on "specialist rejected → skip panel" (fail-fast) rather than "specialist approved → skip panel" (false-confidence). **The directionality matters and the brief has it backward.**

**Risk 2 — three stub pairs is speculative infrastructure with no activation trigger.** The PLAN's "Open questions" already flags: *"do they convert to real generators only after their toolchains land in aart.camp, or do we ship them speculatively for other downstream repos?"* That's a real open question and the design hasn't answered it. The risk profile depends on the answer:
- If the stubs are for *this* repo, they shouldn't ship until their toolchains do. Activation criteria documented in a file nobody reads is just deferred deletion work.
- If the stubs are for *downstream* repos, they belong as a documentation pattern, not as on-disk files in aart.camp.

Either way, "three stub files with activation criteria" looks like the worst-of-both-worlds answer: enough disk presence to invite drift, not enough callability to provide real value. Pick one direction.

**Risk 3 — generator-* role lock-in is the kind of debt that compounds.** A generator-css-codemod agent makes a commitment about (a) the agent's IO shape, (b) the artifact's checkin format, and (c) the evaluator's expectation of the artifact's shape. Once another agent or skill in the substrate composes against that interface, changing it later costs a coordinated edit across all consumers. The CSS codemod is the active pair, so it gets the burden of being the *reference implementation* future pairs will copy. Concrete remedy: before authoring generator-css-codemod, write down the generator agent contract explicitly. If we can't name those things in a paragraph, we're not ready to ship the pair — we're ready to ship one mechanical CSS-codemod helper.

**One thing I don't want to overstate.** The CSS codemod active pair itself, narrowly scoped, looks fine — codemod work is exactly the kind of "mechanical, agent-shaped, validator-friendly" work where a domain generator earns its keep. The risk I'm naming isn't "don't ship the active pair," it's "don't let the active pair drag the three stubs and the solo-first sequencing along with it as if they're the same decision."

**What I'd want resolved before round 2 closes.** A direct answer on the solo-first sequencing (keep it, invert it, or drop it), a yes/no on shipping the stubs vs. converting them to a CONVENTIONS pattern, and an explicit one-paragraph statement of the generator-* role contract.

