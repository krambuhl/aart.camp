# Whiteboard: Phase 5: Griot integration + composability proof

## Round 1

### From whiteboard-skeptic

This is round 1; the brief itself names five of the right pressure points, so my section is best spent ranking them by realness and naming concrete remedies.

**Verifying the loop actually closes is the load-bearing risk.** Everything else is wiring; this is whether the wiring carries current. The failure mode I'd plan against: we ship evaluator-finding: capture, classification rules, and a rollup section, then close the project without a single generator demonstrably steering away from a captured antipattern. The substrate would technically work and substantively not. The smallest credible proof I can sketch: pick one already-real antipattern from this project's history (evaluator-tokens advisory-as-approved, or the css-arch semantic-inversion finding) and run it through the loop end-to-end — emit a synthetic evaluator-finding: of that shape, watch it land in .guild-findings.jsonl, watch griot-compact promote it under the classification rule, watch the rollup section materialize, and then run a real generator unit (the generator-css-codemod from Phase 4) on a sketch with /griot-use loaded and inspect its output for the avoidance. **If the generator's output references the rollup entry by L-number in its reasoning or visibly declines a pattern the entry names, the loop is closed. If the generator behaves identically with and without the rollup, we've built scaffolding for an effect that doesn't exist.** That last A/B is the verification I'd want in the PR description, not in a follow-up.

**Five classifications is more API surface than v1 needs.** Frequency (n-shot threshold → promote) and generator-antipattern (an evaluator named a specific bad pattern → record and avoid) are the two with obvious mechanics and obvious consumers. Catalog-gap is plausible but its consumer is 'the human reading rollup decides to extend a catalog' — that's a process, not a pipeline, and it doesn't need a distinct classification on the capture side to work; 'frequency' with a note will surface the same signal. Conflict (two evaluators disagree) is theoretically interesting but has fired zero times in this project's actual history that I can find. Exception (one-off ignore) is the most dangerous — it's the bucket where 'this finding doesn't matter' becomes the codepath everyone uses to silence noise. **My push: ship frequency + generator-antipattern as the v1 schema, leave the other three as named-but-unimplemented enum values with a TODO**, and let real usage in the next project pull them into existence.

**.guild-findings.jsonl lifecycle is the dead-weight risk.** Three concrete sub-risks: (1) the file survives /trout-archive into projects/archive/<slug>/ and griot keeps scanning it forever — solvable by archive renaming to `.guild-findings.jsonl.archived` and excluding that suffix from griot's scan glob. (2) parse-failure noise: capture should fail loudly on malformed lines, not skip-and-continue. (3) no upper bound: one-line 'rotate at N entries' comment for the next maintainer. None of these are blockers; all worth one-line solutions.

**On Phase 5 dogfooding its own pipeline: I'd push back on doing it.** The brief frames this as a tempting opportunity (six elevatable findings already in hand), and my instinct is the opposite — Phase 5 building the pipeline AND running it against the existing backlog conflates two units: did the pipeline work, or did the elevations work? When something later goes wrong, you can't tell which. The smaller, cleaner shape is: **Phase 5 ships the pipeline + the one synthetic end-to-end demonstration I sketched above, and the existing backlog elevations become a follow-up unit** (or get absorbed naturally into the next real project's work) where the pipeline is the boring substrate, not the experiment.

**On the 30-line composability proof:** the trap is building a loop that exercises the easy parts (spawning, parsing) and misses the load-bearing one (that ev-loop's opinions are *removable*, not just hidden). **The smallest credible proof is a loop that does exactly one thing ev-loop doesn't: invokes guild-validate with a non-ev-loop-shaped phase config** (e.g., agents listed inline, no whiteboard step, no griot threshold heuristics, no autosave) on a single file, gets back a verdict, prints it. If the substrate can serve that loop without ev-loop machinery loaded in context, composability is real. If the 30-line variant needs to import even one ev-loop convention to function, the substrate/style separation hasn't actually been achieved.

What I'd want resolved by round 2: a concrete commitment on the A/B verification shape, and a decision on the five-vs-two classification scope.

### From whiteboard-react-architect

Capture-script flags are call sites the same way component props are call sites. The substrate is a small system of composable verbs, and the same instincts apply: composition over configuration, one concept per primitive, push state to where it survives best, and don't grow a monolithic verb with every-classification baked in when a family of small ones reads better.

**On the capture API shape — one verb with `--classification=`, not five verbs, not a JSON blob.**

- *Five verbs*: symmetric in the same way `<VStack>` / `<HStack>` are symmetric — and wrong for the same reason. The thing that varies is one axis (the classification); everything else is shared.
- *Structured JSON blob*: opposite mistake. Bash-quoted JSON is hostile at the call site.
- *One verb with a flag* (`--evaluator-finding=<code> --classification=<one-of-five> --evidence=<text>`): the symmetrical prop with a discriminator. The `<Stack direction="vertical">` shape.

The existing script already has `--correction-text` as one shape of finding; `--evaluator-finding` should slot in as a sibling flag, not a replacement. Two findings sources, one capture verb.

**On the skeptic's 'ship 2 of 5 classifications' — I agree, and would push it further to 'ship 1 of 5 to start, with the API shape ready for 5.'** The classifications differ enormously in what they need from griot-compact's promotion logic. `frequency` is a counter — promotion is a threshold check, mechanical. `catalog-gap` is a write to a different file entirely (the evaluator's catalog, not the rollup). `conflict` and `exception` and `generator-antipattern` each demand their own promotion semantics. **Better: ship frequency, document the API surface for the other four with `not-yet-supported` errors**, and let real usage tell us which to activate next.

**On the .guild-findings.jsonl write site — per-unit, written by ev-loop after /guild-validate returns, before the checkin is authored.** That keeps the side effect adjacent to the data source. **Don't put the write inside /guild-validate itself — that's the substrate primitive, style-neutral; counting is an ev-loop opinion** (different loop styles might count differently or not at all). The composability-proof loop should be able to skip the write entirely.

Row shape, small + queryable, one line per advisory or blocking finding:

```json
{"ts":"2026-05-15T14:32:01Z","unit":"D3","phase":"4","evaluator":"evaluator-tokens","code":"tokens-named-color","severity":"advisory","scope":"components/app/Sketch/Sketch.module.css:17"}
```

Six fields, all primitives, all greppable. No nested objects, no remedy text (that lives in the checkin's `## Evaluator verdict` section — the JSONL is the index, not the record). `code` is the join key for frequency counting.

**On the 30-line composability-proof loop — review one file's a11y by spawning evaluator-a11y directly, no autosave, no panel derivation, no whiteboard, no .guild-findings.jsonl write.** This is the right use case because it exercises *only* the substrate primitives and zero ev-loop opinions:

```markdown
# /a11y-review-file

argument-hint: "file=<path>"

1. Read the file via the Read tool.
2. Build a packet: Contract / Artifact / Original ask.
3. Invoke /guild-validate via the Skill tool with agents=evaluator-a11y, packet=<packet>.
4. Print the returned verdict + findings to the user.
5. Stop.
```

That's the substrate's 'naked' call: no checkin, no phase, no unit, no learnings counter, no autosave, no whiteboard step. A11y review against one file is the cleanest demonstration: read-only, single evaluator, single verdict, done.

What I'd want resolved by round 2. **First**: agreement (or pushback) on the 'ship 1 classification, design API for 5' framing — the skeptic's 'ship 2 of 5' is one step less aggressive than mine and the disagreement is real. **Second**: the write-site call (loop-side, not substrate-side) needs design-systems' nod that this isn't violating substrate/style separation.

### From whiteboard-design-systems

We're not just titling a section, we're deciding what kind of thing the rollup *is* now that it carries two species of knowledge. The current `L-NNN` scheme treated 'learning' as a flat universal — anything we extracted got an L-number. Phase 5 introduces a second species (project-bound antipattern observations born from evaluator findings, not corrections) and that's where the semantic pressure shows up.

**On the section name: 'antipatterns observed in this project.'** I'd push back on this. It reads as descriptive prose, not as the name of a structural region of the rollup. **My recommendation: `## Project antipatterns`** as the section header, flat and bare, matching the unornamented style of the rest of the rollup.

**On the identifier scheme: `AP-NNN`, separate sequence from `L-NNN`.** Don't fold antipatterns into the L-numbering. Learnings and antipatterns are semantically distinct kinds — a learning is a *generalizable rule we extracted from a correction* (paired with a rubric, promotable across projects, judge-graded); an antipattern is *a recurring evaluator finding that the catalog already flags, surfaced here so future generators see it*. Same file, two species, two prefixes. **`AP-NNN` reads cleanly**, has prior art in the broader software vocabulary, and the prefix itself encodes the kind in citation contracts. Avoid `ANT-` — too easy to misread as 'antagonist' given this codebase's existing antagonist-evaluator family.

**On the classification vocabulary: rename three of the five.**

- `frequency` — wrong shape of word. 'Frequency' is a property a finding *has*, not a kind a finding *is*. **Rename to `recurring`** (the finding recurred above threshold). Adjective form matches how it'll read in the rollup ('AP-002: recurring — `'use client'` missing on sketch files').
- `catalog-gap` — keep. Exactly the right shape: a noun-phrase naming the thing itself.
- `conflict` — too generic. **Rename to `evaluator-conflict`** to disambiguate.
- `exception` — dangerously vague and overloaded with JS semantics. **Rename to `sanctioned-exception`** (makes the human-judgment step explicit).
- `generator-antipattern` — keep. Crisp, matches the agent-role vocabulary.

If the skeptic prevails on ship-2-of-5, the v1 vocabulary is `recurring` and `generator-antipattern`.

**On the antipatterns-vs-learnings relationship: same file, two sections, two ID schemes, distinct citation contracts.** Don't split into two files — the rollup is the addressable artifact /griot-use reads. One file, ordered as `## Learnings` (existing L-NNN entries) then `## Project antipatterns` (new AP-NNN entries). /griot-use's citation contract grows one rule: when an antipattern is relevant, generators cite it as 'per AP-NNN' exactly like they cite 'per L-NNN', but the AP citation also includes a one-line 'what to avoid' pull-quote because antipatterns are negative-shaped (don't-do-X) while learnings are positive-shaped (do-Y).

**One callout on the upstream contract that this naming locks in.** The vocabulary puts `recurring` and `generator-antipattern` into four touchpoints: the evaluator-finding: shape, the .guild-findings.jsonl rows, the rollup section headers, the /griot-use citation contract. Per L-006, none of them should re-declare it — pick one source of truth (probably the rollup file's own header convention, or a one-paragraph block in CONVENTIONS.md) and have the script parse from there.

**What I'd defer to siblings.** The shape of the evaluator-finding: packet is closer to whiteboard-react-architect's API-shape lens — I've named the values but not the field; they should lead on the field-naming.

### From whiteboard-performance

The framing question I want to press on is: where does the cost of Phase 5 actually live, and is it where the design assumes it lives?

**1. JSONL is the right shape for .guild-findings.jsonl, and the bound on it is project lifespan — the numbers are tiny.** This project has run ev-loop maybe ~60-80 times across five phases over two weeks. If every /guild-validate run writes one append per evaluator (4 evaluators average) plus a tally line, ~5 lines per loop invocation. A 12-week project at heavy cadence tops out around **~3,000 lines, ~600KB max**. Streaming-read-and-tally a 600KB file in Node is ~5ms. The format is fine. Putting the file under `projects/<slug>/` (which PLAN.md already does) means archive-time cleanup is 'the project folder moves to archive/' and the file goes with it. Free gc.

**2. The real cost is the /griot-use injection at loop setup, and it's already non-trivial.** Today /griot-use reads learnings/rollup.md and dumps it into context: 13 learnings, ~7KB, ~1,800 tokens. Add an 'antipatterns observed in this project' section per Phase 5 and the per-spawn cost grows linearly with project-specific antipattern count. If the rollup grows to 50 learnings (plausible over six months) plus a project-scoped antipattern section of 10-20 entries, you're at ~8K tokens of context bloat at every loop start, before any actual unit work.

**Recommendation: the antipatterns section needs a tighter budget than the learnings section.** Learnings are pre-validated, rubric-backed, high-signal — they earn their tokens. Antipatterns are frequency-counted observations, lower signal per byte. **Cap the injected antipattern section at the top-N-by-frequency (say 5-10) with a one-line summary each, not full rubrics.** The full antipattern history stays in .guild-findings.jsonl for griot-compact to read; the *injection* is curated. This is also the place to tier them: blocking antipatterns get injected, advisory ones don't unless explicitly requested.

**3. griot-compact's read-amplification is small but the parallelism story is worth getting right once.** Today griot-compact scans learnings/session-notes/ serially. Phase 5 adds scanning .guild-findings.jsonl for each active project. The per-project file is small but there could be N active projects in projects/ plus M archived projects under projects/archive/. **Recommendation: only scan active projects' .guild-findings.jsonl at compact time.** Archived projects already had their compact run when they were active.

**One thing I'm deferring cleanly**: the skeptic's 'parse-failure sludge' concern is partly mine and partly theirs. From a cost lens, I'd add — **keep the parser strict and lossy on append**. If a malformed record gets written somehow, the scan should skip-and-log rather than halt-and-error. JSONL's per-line independence makes this trivial.

What I'd want resolved by the next round: a hard answer on the antipattern injection budget (top-N count, or a token ceiling, or both?), and confirmation that archived-project .guild-findings.jsonl files are out-of-scope for nightly compact scans.

### From whiteboard-a11y

**Carve-out first, since this is the orchestrator's expected move:** Phase 5 is substrate plumbing — griot-capture argument shapes, a .guild-findings.jsonl schema, classification-aware promotion rules in griot-compact, a 30-line proof-of-composability loop. None of that touches an end-user surface, so the inclusive-design lens mostly doesn't have purchase here. Defer to performance on JSONL append-cost, to react-architect / design-systems on the agent file conventions, to skeptic on whether the composability proof actually proves anything.

Two narrow places I do want to put weight on:

**1. The rollup section's prose contract — design it to serialize cleanly, not just look right in a terminal.**

The new rollup section will live in learnings/rollup.md and be slurped into generator briefs via /griot-use. Markdown is the on-disk format, but rollup files have a way of getting rendered: pasted into GitHub issues, surfaced in dashboards, reviewed by screen-reader users. The shape choice now sets the ceiling.

- **Lead each entry with a heading, not a bolded inline span.** `### evaluator-a11y: icon buttons without accessible names` reads as a navigable landmark in any markdown renderer; `**evaluator-a11y / icon-buttons:**` collapses into the surrounding paragraph and is invisible to heading-jump shortcuts.
- **If the entry has structured fields (frequency count, classification, first-seen date), make them a definition list or a labeled table, not a positional comma-separated string.** 'evaluator-a11y, catalog-gap, 4, 2026-05-12' is unreadable linearized; 'Classification: catalog-gap. Frequency: 4. First seen: 2026-05-12.' is fine in both modalities.
- **Plain language in the entry body.** 'Don't use `<div onClick>` for things that are buttons; use `<button>`' beats 'antipattern: pseudo-interactive containers' every time.

**2. The composability-proof loop's brief — if it ends up exercising the a11y evaluator, the brief needs to give it something to chew on.**

If the demonstration unit happens to be 'run evaluator-a11y on one file and capture the verdict' (which would be a fine showcase — that evaluator has the richest catalog and the clearest CLI evidence), the brief needs to include the file's actual rendered context, not just its source. `evaluator-a11y` looking at a `.tsx` source can flag `aria-*` shape but can't see what the user actually experiences; if the proof loop is going to be the canonical 'here's how to invoke a specialist evaluator from scratch,' it should model the right kind of input.

**What I'd want resolved by the next round:** whether the rollup entry shape is being decided in this phase or punted to whoever first writes a real entry. If it's being decided now, I'd want one of the entry-shape recommendations above to land in the deliverable contract; if it's being punted, the punt should be explicit so someone doesn't accidentally lock in a bad shape with the first entry.

**Where I defer:** everything else. The .guild-findings.jsonl schema, the five classification names, the promotion thresholds, the griot-capture argument surface — all sibling-engineer territory.

### From whiteboard-sketch-ideation

Out of scope — Phase 5 is pure substrate work (griot-capture, griot-compact, .guild-findings.jsonl, rollup format, composability-proof loop), none of which touches sketches/, the <Sketch> wrapper, registry.ts, the sketch-page shell, or gallery framing. Deferring entirely to substrate/react-architect/skeptic on the design.

One small hook worth flagging for the record, in case the composability-proof loop needs a first real use case: if the team wants a sketch-flavored evaluator lens (something like an `evaluator-sketch-style` that reads a single `NN-name.tsx` and reports on the 'one mechanic, time-evolution, readable math, intentional palette' axes from my base), that would land in my lane and I'd happily spec it. But that's a Phase 6+ 'what do we do with the loop now that it exists' question, not a Phase 5 substrate-design question. Don't pull it into this phase on my account.

Otherwise: pass.


## Decisions (post-Round 1)

User answers via AskUserQuestion after Round 1, per L-002:

1. **Classifications v1 = 2** — `recurring` + `generator-antipattern`.
   The other three (`catalog-gap`, `evaluator-conflict`,
   `sanctioned-exception`) are named-but-unimplemented; emit a
   `not-yet-supported` error if a caller passes them. API shape supports
   all 5 from day one. (Skeptic + design-systems' position adopted;
   React-architect's tighter "ship only 1" framing relaxed by one notch.)

2. **Dogfood deferred** — Phase 5 builds the pipeline + ONE synthetic
   end-to-end A/B demo (synthetic antipattern → capture → promote →
   `/griot-use` injection → generator A/B avoidance check). The ~6+
   accumulated substrate findings from prior phases are NOT elevated in
   Phase 5; they go into a follow-up project or fold into the next real
   project's work. (Skeptic's position adopted.)

3. **Decomposition = 3 coarse deliverables**:
   - **D1** — `griot-capture --evaluator-finding=...` accepts the new shape;
     classification logic for the two v1 values; `griot-compact`
     classification-aware promotion rules; ev-loop writes
     `projects/<slug>/.guild-findings.jsonl` per unit close.
   - **D2** — Rollup section structure (`## Project antipatterns` per
     design-systems' rename); `/griot-use` injection with top-N curation
     (performance's cap); synthetic A/B verification end-to-end.
   - **D3** — 30-line composability-proof loop variant (`/a11y-review-file`
     per React-architect's lane).

4. **Naming reframes from design-systems adopted** (implicit by picking
   the option that uses `recurring`):
   - Rollup section: `## Project antipatterns` (not "antipatterns
     observed in this project")
   - Identifiers: `AP-NNN` (separate scheme from learnings' `L-NNN`)
   - Classification names: `recurring`, `generator-antipattern`,
     `catalog-gap`, `evaluator-conflict`, `sanctioned-exception`
     (renamed from frequency/conflict/exception)

5. **Composability-proof use case = `/a11y-review-file`** — single-file
   a11y review skill that invokes the substrate's `/guild-validate`
   with just `evaluator-a11y` against a single `.tsx` file, no
   ev-loop opinions, no whiteboard, no checkin, no `.guild-findings.jsonl`
   write. Naked substrate composability demo.

6. **Verification = A/B test** — run `generator-css-codemod` once
   with `/griot-use` loaded against a rollup containing a real
   captured antipattern, once without, and check whether the loaded
   version visibly avoids the antipattern. Synthetic-antipattern based
   (per the "defer dogfood" decision); the antipattern is one we
   construct for the test, not one of the accumulated findings.

The skeptic's caution about "infrastructure for a use case we never
exercised" is honored by item 6: the A/B test is mandatory Phase 5
verification, not optional polish.
