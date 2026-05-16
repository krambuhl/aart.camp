# Whiteboard: Phase 6: § extraction + extension + integration sweep

## Round 1

### From whiteboard-a11y

OK — the whiteboard is empty and waiting for input. I have enough grounding. Let me lay out the inclusive-design / contributor-onboarding lens on these questions, calling out clearly where I'm leaning in and where I'm carving out.

---

## A11y / inclusive-onboarding perspective on Phase 6

Upfront carve-out: most of this round is about prose architecture, not UI. There is no rendered DOM here, no focus management, no `prefers-reduced-motion`. My lens still has something to say, but the analogy is *contributor experience* rather than *user experience*. Documentation is a kind of interface — a fresh contributor (human or agent) is "navigating" it the way a screen-reader user navigates a page: linearly, top-to-bottom, with limited ability to scan visually for structure. That framing is what I'm bringing.

I'll lead on **Q1, Q2, Q3** (discoverability / semantic naming / citation legibility — these have a direct "contributor with low context lands here, can they orient?" parallel to the screen-reader-experience question), touch lightly on **Q4** (information hierarchy, again a linearized-read analog), and explicitly defer on **Q5, Q6, Q7** (these are loom/draft/CLI-architecture questions where the relevant panelists own the call).

### Q1 — Where does the extracted catalog live?

The framing I'd press on: a fresh contributor (or fresh agent session) lands in `projects/` and has to figure out which file answers their question. That's the same problem as a screen-reader user landing on a page with five headings that all sound vaguely the same — if the names don't carry meaning, you're scanning by guess.

**The naming-vs-scope mismatch on option B is the biggest issue.** `LOOM-CONVENTIONS.md` literally says "Loom project-substrate conventions" in its first line, and its design-principles section is loom-specific ("Loops are first-class consumers", "Loom is angular to two adjacent substrates"). Folding griot + guild recipes into a file named LOOM violates the principle that names should describe what's inside. That's the documentation equivalent of `color: brand` being the only signal that something is a button — the meaningful information lives in the visual position (the file you happen to be reading), not in the semantic label (the filename). Future contributors searching for "where do guild recipes live?" will not grep LOOM-CONVENTIONS.md.

**Option A (new `SUBSTRATE-COMPOSITIONS.md`) gets the semantic naming right** — the file is named for what it contains: cross-family recipes that compose multiple verbs into a working pattern. A contributor who needs to know "how do I compose a PR?" will find it by filename alone. The downside is one more file in `projects/`, but that's cheap.

**Option C (CONVENTIONS.md as umbrella) is structurally appealing but has a sequencing risk.** It implies a hierarchy where CONVENTIONS owns framing and LOOM-CONVENTIONS becomes a deeper layer. That's coherent, but it means the Phase 6 PR is also implicitly reshaping the role of LOOM-CONVENTIONS, which is more change than the PLAN bills it as. If we want that reshape, it should be a conscious decision; if not, A is cleaner.

**My lean: A.** New `projects/SUBSTRATE-COMPOSITIONS.md`. Semantic name, single-purpose file, leaves LOOM-CONVENTIONS as the loom-specific reference it advertises itself as. Q2's framing doc gets its own home; the two files don't fight over territory.

### Q2 — Where do the meta-conventions live?

The recipes from Q1 are *how-to* prose. The framing doc (skills-as-interfaces, four-family taxonomy, frontmatter rubric, parallel-work invariant) is *what-is* prose. Those are different reading modes, and conflating them in one file makes both worse — recipes get padded with conceptual context the recipe-reader doesn't need; framing gets buried under procedural detail the framing-reader has to scroll past.

The screen-reader analog: this is the "status badge to the right of the title means draft" pattern. Visually, framing and recipes might sit next to each other and feel related, but read linearly the relationship breaks down — a contributor scanning for "what's the four-family taxonomy?" should not have to read through seven recipe walkthroughs to get to it.

**My lean: D, the split.** Framing in `projects/CONVENTIONS.md`, recipes in `projects/SUBSTRATE-COMPOSITIONS.md`. Two files, two reading modes, two clear answers to "where do I look for X?"

This does answer the contradiction the brief flagged at the bottom: yes, this choice tightens up Q3 too, because now there's a clear rule for which file owns which kind of section.

### Q3 — Recipe citation form

This is the question where the inclusive-design lens has the most to say, because it's directly about how a reader (often without full context) makes sense of a reference.

**Option A (bare `§ Compose PR`) fails the "what does this sound like read linearly?" test.** If a contributor opens an ev-loop body cold and hits `§ Compose PR`, they have no idea where to look for it. That's the same failure mode as a link whose accessible name is just "click here" — the reference doesn't carry its target. An agent reading the file with no other context has the same problem.

**Option D (preamble that defines the namespace) is the most elegant** — it's the moral equivalent of declaring `aria-labelledby` once and reusing the relationship throughout. Citations stay short and readable in the body; the resolution rule lives in one place. The risk: preambles get skipped. If a reader jumps mid-document (which both humans and agents do constantly), they miss the namespace declaration. That's the same failure as relying on the page title to disambiguate widgets — fine if you read top-to-bottom, broken if you tab in mid-stream.

**Option B/C (full path + section) is verbose but self-contained.** Every citation tells you where to go. Slightly noisier in the prose; significantly more robust to mid-stream reads, grep, and agent context windows that may not include the file header.

**My lean: B-style, with the path relative-and-stable.** `SUBSTRATE-COMPOSITIONS.md § Compose PR` rather than the full `projects/` prefix (since both files live there, and the prefix is recoverable). This loses a few characters of brevity but every citation is self-describing. Pair this with option D's preamble as belt-and-suspenders if we want — but the citation itself should not require the preamble to be legible.

Worth noting: if Q1 lands on option A (separate file) and Q2 lands on the split, then we have *two* citable sources — recipes in one file, framing concepts that might also be cited in another. That makes "bare §" actively ambiguous (which file?) and pushes harder toward full-citation form.

### Q4 — Recipe granularity (light touch)

The grouping-by-family question (§ Loom recipes / § Griot recipes / § Guild recipes) is partly an information-architecture question and partly a question about how readers find things. Two competing pulls:

- **Flat is easier to cite** — `§ Compose PR` is shorter and more memorable than `§ Loom recipes › Compose PR`. The reader doesn't have to know which family a recipe belongs to in order to look it up.
- **Grouped is easier to scan** — a contributor reading the catalog cover-to-cover for orientation benefits from the recipes being clustered by family, because that's how they'll mentally model the substrate later.

The screen-reader analogy: this is the difference between a flat list of links and a navigation with grouped landmarks. Flat is faster to scan but loses structural relationships; grouped takes more landmarks but preserves meaning.

**My lean: flat at the heading level, with a grouped table of contents at the top of the file.** Each recipe is a top-level `## § Compose PR` (citable as `§ Compose PR`, no nesting). The file's intro section has a TOC that groups them by family ("Loom recipes: § State refresh, § Phase update, ..."). You get the cite-friendliness of flat structure and the discoverability of grouping, without the citation-length penalty of nested sections.

### Q5, Q6, Q7 — deferring

- **Q5 (parallel-work invariant test shape)**: this is a CLI-architecture / behavioral-contract question. The skeptic and whoever owns substrate-CLI invariants should lead. The only inclusive-onboarding note I'd add: whatever the test asserts, its failure message should plainly say "this verb is not append-only; either make it append-only, partition by branch, or document the exception" — i.e. the failure should teach, not just fail. Test failures are documentation too.

- **Q6 (cross-family hotspots audit)**: outside my lens. Defer to the substrate-CLI panelists.

- **Q7 (ordering of the four sweeps)**: lightly — there's a documentation-coherence argument for landing 3 (the framing doc) before 1 (the extraction) so that when the recipes get extracted, their home file already has a documented role. But since this is one PR with all four sweeps, the actual question is just commit ordering within the PR, not separate landings. Commit ordering matters less than the final state. I'd defer this to whoever's organizing reviewer-cognitive-load.

### Cross-question coherence check

The brief asked me to flag contradictions. The one I see:

- If Q1 lands on **A** (new file) and Q2 lands on **D** (split), then Q3 **cannot** be "bare §" — there are two citable sources and bare references are ambiguous. Q3 must be **B-form** (file + section) or **D-form** (preamble), and B is safer for the reasons above.
- If Q1 lands on **B** (fold into LOOM-CONVENTIONS) and Q2 lands on **B** (also LOOM-CONVENTIONS), then bare § becomes viable because there's one canonical source — but then we have the naming-vs-scope problem the file becomes too big and its name lies about its contents.

The internally-consistent package I'd recommend: **Q1=A, Q2=D, Q3=B, Q4=flat-with-grouped-TOC**. Each file is named for what it contains, citations are self-describing, contributors orient by filename.

---

## Files referenced

- `/home/krambuhl/work/aart.camp/projects/LOOM-CONVENTIONS.md` (read first 80 lines — confirmed it's loom-scoped by both name and stated content; folding griot/guild recipes into it would create the naming-vs-scope mismatch noted in Q1)
- `/home/krambuhl/work/aart.camp/projects/2026-05-16-substrate-cli/whiteboards/6-extraction-extension.md` (empty, awaiting input)
- `/home/krambuhl/work/aart.camp/projects/2026-05-16-substrate-cli/PLAN.md` (referenced but not re-read — brief's summary trusted)

### From whiteboard-design-systems

Good — I have what I need. Let me put on the design-systems hat and walk through these tradeoffs honestly. I'll caveat upfront: this brief lives almost entirely in the documentation/naming axis where my lens *does* apply, and almost not at all in React-API-shape territory where I'd defer. So this is a long one, but the questions are clustered around exactly the kind of thing this perspective exists to press on: **what gets named what, where it lives, and how citations encode meaning over time.**

---

## The frame I'm bringing

The unifying observation across Q1–Q4: **a recipe catalog and a conventions doc are doing two semantically different jobs**, and conflating them is the design-systems version of stuffing variants into one `<Button>` prop matrix instead of composing primitives.

- **Recipes** are *operations* — verbs at the right level of granularity. They describe *how* to compose substrate primitives into a useful gesture (Compose PR, Save session). They are call sites. They want short, citable names.
- **Conventions** are *constraints* — the rules of the system that the recipes operate within. Taxonomy, frontmatter rubric, parallel-work invariant. They describe *what shape the substrate is*. They are the contract.

This maps cleanly to the high-and-low-abstractions-in-parallel philosophy from CLAUDE.md: conventions are the foundational abstraction layer; recipes are the on-the-rails presets composed from them. They are paired, not interchangeable, and they want to read as paired.

That frame drives most of what follows.

---

## Q1 — Where does the extracted catalog live?

**I'd lean toward A (a new `projects/SUBSTRATE-COMPOSITIONS.md`)**, with a few caveats.

The case against B (fold into LOOM-CONVENTIONS.md): the name `LOOM-CONVENTIONS.md` is already doing semantic work — it scopes itself to loom. Today the file opens "Canonical reference for loom-managed projects. Loom is a JSON-first, loop-friendly CLI…" (line 3-4). Adding griot recipes (Load rollup, Capture finding) and guild recipes (Append finding, Derive panel) into a file whose name and opening paragraph both say "this is the loom contract" is the design-systems smell of `<BlueButton>` — the name describes one specific thing, but we're loading it with cross-cutting concerns. Future readers will either (a) miss the griot/guild recipes because they didn't think to look in a loom file, or (b) develop a vague "I think conventions live in LOOM-CONVENTIONS regardless of family" rule, which then leaks: the next time someone adds, say, draft-specific recipes, do they go in LOOM-CONVENTIONS too? The name has stopped describing what the thing *is*.

The case against C (CONVENTIONS.md as umbrella that absorbs LOOM-CONVENTIONS): this is appealing for *cohesion* (one umbrella file feels like one mental model), but I think it underestimates the size and stability of LOOM-CONVENTIONS — it's a 440-line tightly-scoped contract that loom's verbs implement against. Merging it into a broader umbrella risks burying the loom contract under cross-family material, and it doubles down on a single hotspot doc that everyone has to read end-to-end. There's also the **stable infrastructure stays stable** principle (CLAUDE.md, this project's CLAUDE.md): LOOM-CONVENTIONS.md is foundational. Don't move it unless there's a reason. "We want a home for recipes" is a reason to add a file, not to relocate this one.

Why A wins for me:
- **Semantic name match.** `SUBSTRATE-COMPOSITIONS.md` describes what the file *is* (a catalog of compositions over the substrate), not what family it belongs to. It survives the addition of family number five.
- **Citation length is acceptable.** `§ Compose PR` doesn't get longer; it just lives in a clearly-named home (see Q3).
- **It composes with LOOM-CONVENTIONS.md the way primitives compose with presets.** LOOM-CONVENTIONS = the substrate contract (the foundational layer). SUBSTRATE-COMPOSITIONS = the recipe catalog (the on-the-rails presets). The naming pair tells the story: conventions are the rules, compositions are the moves you make within them.
- **Discoverability for a fresh contributor.** Two files with semantically-distinct names beats one giant file or three overlapping ones. The contributor's question — "where do I find how to compose a PR?" — has a one-word answer: compositions.

One thing to name explicitly under the carve-out from my role description: if SUBSTRATE-COMPOSITIONS.md needs to introduce new "section vocabulary" (e.g. a header convention for recipe entries — preconditions, dispatch, postconditions, etc.), that's worth deciding deliberately rather than letting it accrete. Recipes that share a structural shape are recipes that scan; recipes that each invent their own subheadings are recipes that fragment.

**Recommended default: A.** If the panel pushes back toward C, the fallback I'd accept is "C with LOOM-CONVENTIONS.md preserved as a deeper loom-internal reference, and CONVENTIONS.md as the umbrella that points down into both the conventions material and the compositions material." But that's a three-file world; A keeps it at two-plus-one.

---

## Q2 — Where do the meta-conventions live?

**D, with a specific shape: framing in `projects/CONVENTIONS.md`, recipes in `projects/SUBSTRATE-COMPOSITIONS.md`, loom-specific contract stays in `projects/LOOM-CONVENTIONS.md`.**

This is the same composition-over-configuration instinct. The four pieces the brief calls out — skills-as-interfaces-vs-workers, four-family taxonomy, two-axis frontmatter rubric, parallel-work invariant — share a semantic role: *they describe the shape and rules of the substrate as a whole, across families.* That's a coherent thing, and it wants a coherent home.

Folding it into the recipe catalog (C) breaks the conventions/recipes distinction I argued for in Q1 — same smell, opposite direction. Folding it into LOOM-CONVENTIONS.md (B) repeats the family-name-scope-mismatch problem; the four-family taxonomy explicitly is not a loom thing.

The historical note at the bottom of LOOM-CONVENTIONS.md (line 444-449) actually says `projects/CONVENTIONS.md` *used to exist* and was retired with trout. That's a strong signal: the name is available, the prior art exists in the project's memory, and the brief's hint at line 522-523 about advisory findings + the fact that the agent-guilds project's PLAN.md already references CONVENTIONS.md as if it exists tells me there's existing semantic gravity around that name. Reusing it (rather than minting a new name) is the cohesion-compounds move.

So the three-file world I'm proposing:

| File | Job | Audience |
|---|---|---|
| `projects/CONVENTIONS.md` | Cross-family shape: taxonomy, frontmatter rubric, parallel-work invariant, "interfaces vs workers" framing | Anyone touching the substrate |
| `projects/SUBSTRATE-COMPOSITIONS.md` | Recipe catalog cited by `§ Foo` references | ev-loop bodies + anyone composing substrate primitives |
| `projects/LOOM-CONVENTIONS.md` | Loom's verb contract (JSON shapes, event vocabulary, slug resolution, etc.) | Anyone implementing or calling loom verbs |

The asymmetry is intentional: there's no `GRIOT-CONVENTIONS.md` or `GUILD-CONVENTIONS.md` because (a) they don't exist yet at that depth and (b) when they do, they get their own files following the same pattern. The naming generalizes; the vocabulary stays consistent.

**Contradiction check with Q3 (citation form).** If CONVENTIONS.md exists separately from SUBSTRATE-COMPOSITIONS.md, then `§ Foo` as a bare reference becomes ambiguous *unless* we say "bare `§ Foo` always refers to the compositions catalog; cross-family conventions are cited as `CONVENTIONS.md § <Section>`." That's the rule I'd propose. See Q3.

---

## Q3 — Recipe citation form

**D, refined: each ev-loop body opens with a one-line preamble that pins the bare `§` namespace to SUBSTRATE-COMPOSITIONS.md; everything else gets a fully-qualified reference.**

The argument: `§` is a section reference *into a file*, and a bare `§` only works when the reader's mental "current file" is unambiguous. In a 250-line embedded "Substrate compositions" section inside the ev-loop body itself, `§ Compose PR` worked because the section was right there. Once we extract, that local pin is gone, and we need to either:

1. Make the citation carry the file name every time (B / C in the question — verbose but unambiguous).
2. Declare the namespace once at the top and rely on a project-wide reading convention (D — terse at call sites, requires a one-line preamble).

I lean to (D) for the same reason design systems prefer `<PrimaryButton>` over `<Button color="primary" elevation="raised" radius="md">` at the call site — the call site is where readability matters most. Recipe citations appear *many* times in each ev-loop body. The preamble appears once. Pay the cost once, win it back at every call site.

Concretely, each ev-loop body's header gets:

> All `§ <Recipe>` references in this body resolve in `projects/SUBSTRATE-COMPOSITIONS.md`. Cross-family conventions referenced as `CONVENTIONS.md § <Section>`. Loom-specific contract details referenced as `LOOM-CONVENTIONS.md § <Section>`.

Three citation forms, three meanings, all unambiguous. The bare `§` is the on-the-rails preset for the 95% case (recipe references); the qualified form is the off-the-rails escape hatch for the long tail (conventions, loom internals).

A real concern with D worth naming: **agents reading these files out of context.** If an agent gets dropped into the middle of an ev-loop body and sees `§ Compose PR`, can it resolve the reference without reading the preamble? Today: probably yes via context. Tomorrow, when there are more recipe namespaces: maybe not. The mitigation is that SUBSTRATE-COMPOSITIONS.md should be the *only* file with recipe-shaped sections — conventions docs use different vocabulary (rubric, invariant, taxonomy, principle). If `§` exclusively decorates recipe names by convention, then "find the file with the matching `## Compose PR` header" is a deterministic resolve.

If the panel doesn't trust the preamble pattern, fall back to **B**: `LOOM-CONVENTIONS.md § Compose PR` → `SUBSTRATE-COMPOSITIONS.md § Compose PR`. Verbose but bulletproof. C (full path including `projects/`) feels like over-qualification; the file basename is unique in the repo.

---

## Q4 — Recipe granularity

**Coequal §-recipes, flat namespace, no family-prefixed subsections.** With one caveat: order them by family in the catalog for scanability.

The reason: the *consumer* of these citations is an ev-loop body composing a multi-step gesture. From that vantage, "Save session" and "Append finding" and "Capture finding" are peers — they're moves you make. The ev-loop body doesn't care which family's CLI is dispatched; it cares that the gesture has a name. Grouping by family in the citation namespace (`§ Loom recipes / § Save session`) introduces a hop that doesn't carry meaning at the call site — call sites just want the verb.

Compare to the design-system parallel: when a designer reaches for `<Stack>`, they don't care that it's in `components/shared/layout/` vs `components/shared/primitives/`. The directory structure is a *catalog organizing convention*, not part of the component's identity. Same here: family-grouping in the catalog file is fine (helps the human skim), but it shouldn't surface in citations.

The shape I'd propose for SUBSTRATE-COMPOSITIONS.md:

```
## State refresh
## Phase update
## Checkin write
## Compose PR
## Triage PR comments + draft responses
## Save session
## Revise PLAN.md
## Load rollup
## Capture finding
## Append finding
## Derive panel
```

Flat. Eleven recipes. Citations are always `§ <Recipe name>` regardless of which family CLI underneath. If the catalog grows past ~20 recipes someday and skimmability suffers, *then* add `### Loom` / `### Griot` / `### Guild` grouping headers — but keep the recipe names at `##` level so the citation form doesn't change. Heading depth is presentation; the section's anchor name is the contract.

One naming nit worth surfacing while we're here: **"Triage PR comments + draft responses"** is a long section name with a `+` in it, which makes for awkward citation (`§ Triage PR comments + draft responses` reads like two refs). I'd consider renaming to **`§ Respond to PR feedback`** or **`§ PR triage`** — shorter, single-verb-shaped, matches the noun-verb vocabulary of `§ Save session` / `§ Phase update`. This is a tiny example of "find cohesion always" — the recipe names are themselves a small naming system and should rhyme.

---

## Q5 — Parallel-work invariant test shape

I'm a bit outside my lane here — testing strategy is more an engineering-pragmatism question than a design-systems one. But the *naming* of the invariant matters, and that I can press on.

The phrase **"append-only or branch-partitioned"** is doing two semantic jobs that I'd want to keep separate:

- **append-only** = the file format guarantees concurrent writers can't collide (newline-delimited JSON, no rewrites mid-line).
- **branch-partitioned** = the path itself encodes the partition (`checkins/<branch>/NN.json`), so two branches never write to the same path.

These are different mechanisms with different test shapes. Folding them under one invariant name is fine for the prose, but a test should probably assert each separately:

- **Append-only test**: for each verb declared append-only (`bin/guild findings append`, `bin/loom events append` if exposed, etc.), spawn two concurrent invocations, verify both lines land and neither was lost. Or, more cheaply: assert the verb's writer code path uses `appendFile` semantics (no read-modify-write of the whole file).
- **Branch-partitioned test**: for each verb declared branch-partitioned, verify the resolved write path includes a branch component derivable from cwd / git state, and that two distinct branches yield distinct paths.

The cheaper version that catches the same regression class without needing concurrency mechanics: **declarative table per mutating verb.** Each verb declares `{kind: "append-only", path: "events.jsonl"}` or `{kind: "branch-partitioned", path: "checkins/<branch>/NN.json"}` or `{kind: "exception", reason: "..."}`. The test iterates the table and asserts the actual implementation matches the declaration. New mutating verb without a table entry → test fails. Existing verb whose path stops matching the declared partition → test fails.

This has the design-systems property I care about: **the invariant is encoded as a named contract**, not as a one-off concurrency stress test. Future engineers adding new verbs can't accidentally violate the invariant without consciously adding an `exception` entry with a written reason.

---

## Q6 — Cross-family hotspots audit

I don't have the deep CLI-internals lens to spot specific hotspots, but the question to press on from the design-systems side: **`PLAN.md` is mutable, non-append-only, and not branch-partitioned by path.** `bin/draft revise` rewrites it. That's almost certainly an intentional exception (PLAN.md is the one narrative file by design — see LOOM-CONVENTIONS.md line 30 and the "Settled design decisions" section), but the invariant doc should name it explicitly: *"PLAN.md is the substrate's one declared exception; mutation is serialized through `bin/draft revise` and the Revision log inside PLAN.md is itself append-only, which gives the audit trail back."*

`manifest.json` is the other obvious candidate — phase updates, status changes, current branch all rewrite parts of it. Loom owns it; concurrent loom writers on the same project would race. Is that an actual hotspot? In a single-developer-single-machine substrate, probably not in practice. But naming it as a designed exception ("manifest.json is serialized by loom; do not bypass loom verbs to write it") locks in the contract.

The design-systems framing for the writeup: **every mutating verb should be classifiable as one of {append-only, branch-partitioned, declared-exception}.** Anything that doesn't fit one of those three buckets is a hotspot, full stop, and should be refactored or have its exception written down with a reason. That's the test from Q5 generalized to the doc.

---

## Q7 — Ordering of the four sweeps

**Extraction first (1 → 2 → 3 → 4) is correct.** This is the design-systems instinct showing up as engineering instinct: do the mechanical lift before the semantic re-articulation, because the lift will surface naming questions that should inform the re-articulation.

Concretely: extracting the recipes into SUBSTRATE-COMPOSITIONS.md will force naming decisions — what's the exact section name? `§ Triage PR comments + draft responses` vs `§ PR triage`? Are griot recipes "Load rollup" or "Rollup load" (to match loom's noun-verb taxonomy from LOOM-CONVENTIONS.md line 266-272)? Those decisions inform Sweep 3 (the conventions doc), because the conventions doc will codify the *patterns* the recipe names follow. Doing 3 first would mean writing the conventions doc against speculative recipe names.

The skeptic might say: "but if 3 sets the home for the recipes, shouldn't it come first?" — and I'd answer: the home is decided here in Round 1 (Q1/Q2). The *structure* of the home doesn't need the conventions doc to land first; it needs the design decision (which Round 1 produces) to land first. Sweep 1 implements the Round-1 decision; Sweep 3 codifies the framing around it. That order is right.

One thing worth being deliberate about: **don't let Sweep 1 ship a citation form that Sweep 3 then has to change.** If the panel agrees on D for Q3 (preamble + bare citations), Sweep 1's ev-loop body edits already use that form. If Q3 ends up B (fully-qualified), Sweep 1 uses that form. Either way, the citation form is decided in Round 1 and Sweep 1 commits to it.

---

## Cross-question contradiction check

Going back through with the panel's lens for self-consistency:

- **Q1=A + Q2=D + Q3=D**: consistent. Three named files, each with a semantic role, with a citation convention that distinguishes them. Bare `§` for recipes (the high-volume case), qualified for conventions and loom internals.
- **Q1=A + Q4=flat**: consistent. The recipe catalog file is shallow and skimmable.
- **Q4=flat + Q3=D**: consistent. Flat means citations need no family prefix; bare `§` works as the default.
- **Q5/Q6 ↔ Q2**: the parallel-work invariant lives in CONVENTIONS.md (Q2), and CONVENTIONS.md is the natural home for the exception register. Internally consistent.
- **Q7 ↔ Q1**: Sweep 1 creating SUBSTRATE-COMPOSITIONS.md commits the project to the Q1=A answer. If the panel went C instead, Sweep 1 changes shape. Round 1 must converge on Q1 before Sweep 1 is authored.

The one cross-question tension I'd flag for the skeptic to chew on: **am I just adding a file when one would do?** Q1=A means three substrate-prose files (CONVENTIONS, SUBSTRATE-COMPOSITIONS, LOOM-CONVENTIONS) rather than the current one. That's a real surface-area cost. The defense is that the three files map cleanly to three distinct semantic roles (cross-family rules / cross-family recipes / loom-specific contract), and the discoverability cost of one giant umbrella file is also real. But the skeptic should press on whether the contributor's "where do I find X" question is actually better served by three files vs one with three top-level sections. I think yes — file names are bigger semantic handles than section names — but it's not a slam dunk.

---

## TL;DR of recommended defaults

- **Q1**: `projects/SUBSTRATE-COMPOSITIONS.md` (new file).
- **Q2**: `projects/CONVENTIONS.md` (new file) for cross-family framing; recipes stay in SUBSTRATE-COMPOSITIONS.md; LOOM-CONVENTIONS.md keeps its loom-internal contract role unchanged.
- **Q3**: Each ev-loop body opens with a one-line preamble pinning bare `§` to SUBSTRATE-COMPOSITIONS.md; cross-file refs are qualified (`CONVENTIONS.md § …`).
- **Q4**: Flat namespace of eleven coequal recipes; rename `§ Triage PR comments + draft responses` to something shorter and verb-shaped for cohesion with peers.
- **Q5**: Encode the invariant as a declarative table of mutating verbs with `{kind: append-only | branch-partitioned | declared-exception}` plus reason; the test iterates the table.
- **Q6**: PLAN.md and manifest.json are the obvious declared exceptions worth naming explicitly. Everything else should be classifiable into one of the three buckets or refactored.
- **Q7**: Keep 1 → 2 → 3 → 4. Extraction-first surfaces the naming decisions that Sweep 3's framing should rest on.

---

## Files referenced

- `/home/krambuhl/work/aart.camp/projects/LOOM-CONVENTIONS.md` — current canonical reference; the historical note at lines 444-449 confirms `projects/CONVENTIONS.md` was retired with trout and the name is available for reuse.
- `/home/krambuhl/work/aart.camp/.claude/skills/ev-loop-confidence/SKILL.md` — current home of the duplicated "Substrate compositions" section (line 39 onward); the body uses `§ Foo` citations into its own embedded section today (lines 27, 44).
- `/home/krambuhl/work/aart.camp/.claude/skills/ev-loop-interactive/SKILL.md` — paired ev-loop body carrying the same duplicated section.
- `/home/krambuhl/work/aart.camp/bin/loom`, `/home/krambuhl/work/aart.camp/bin/draft`, `/home/krambuhl/work/aart.camp/bin/griot`, `/home/krambuhl/work/aart.camp/bin/guild` — all four family CLIs exist, confirming the four-family taxonomy is real and not aspirational.

### From whiteboard-performance

Acknowledged — the CLAUDE.md context is the standard project-level one we already have. Back to the perf-shaped finding.

Now I have enough to give a real Q6 answer. Here's the audit, ordered by how clearly each verb fits or violates the "append-only or branch-partitioned" invariant.

### Q6 audit — hotspots survey

**Clean appends (invariant-respecting):**

- `bin/guild findings append` — uses `appendFileSync` on `.guild-findings.jsonl` (findings.ts:166). Textbook append-only.
- `bin/loom event log` (via `lib/events.ts:56`) — `appendFileSync` on `events.jsonl`. Clean.
- `bin/griot operator-checks` (operator-checks.ts:55) — `appendFileSync` on the log path. Clean.

**Branch-partitioned writes (also invariant-respecting):**

- `bin/griot capture` (capture.ts) — writes into a fresh per-capture `folderPath`. Each invocation creates a new folder; no two captures collide on the same file. This is the "branch-partitioned" half of the invariant, just spelled as "directory-partitioned." Worth naming that explicitly in the CONVENTIONS prose.
- `bin/loom pr` (pr.ts:372) — writes a per-branch responses file (target is keyed off branch). Branch-partitioned.

**Read-modify-write on shared files (the hotspot category):**

- **`bin/guild whiteboard append`** (whiteboard.ts:188-204) — reads the existing whiteboard, computes the next content, `writeFileSync`s the whole thing back. This is NOT append-only at the filesystem level. Two concurrent `whiteboard append` calls against the same whiteboard would race: both read state N, both compute state N+1 from different inputs, both write — last writer wins, one round's sections are silently lost.

  This matters for Phase 6 because the whiteboard is the literal mechanism this Phase-6 panel is using right now. It's a real shared mutable hotspot. The mitigation isn't necessarily "rewrite to append" — whiteboard markdown semantically wants to be a single coherent document — but it does mean the contract should be: "whiteboard appends are serialized by the orchestrator; never call `whiteboard append` from parallel agents."

- **`bin/loom` manifest/session/retro/checkin writes** (`lib/manifest.ts:35`, `lib/session.ts:75`, `lib/retro.ts:95`, `lib/checkin.ts:122`) — all read-modify-write JSON files. But these are *single-writer-per-project* by design (one phase update at a time, one checkin at a time). They're hotspots in the abstract, but not in practice because the loop sequences them.

- **`bin/draft`** (draft.ts:318) — `writeFileSync(planMdPath, composed)`. PLAN.md is rewritten wholesale. Same single-writer-per-project pattern.

- **`bin/guild whiteboard init`** (whiteboard.ts:119) — idempotent (no-op if file exists); writes a fresh header otherwise. Not a hotspot.

**Recommendation for the CONVENTIONS.md framing:** the invariant as stated ("append-only or branch-partitioned") is *almost* right but needs a third category to be honest about what the substrate actually does. I'd phrase it as a three-way taxonomy:

1. **Append-only**: writes use `appendFileSync` semantics; concurrent calls are safe. (jsonl logs, findings.)
2. **Partitioned**: each call writes to a path no other concurrent call will touch (per-branch, per-capture-folder, per-session). Concurrent calls are safe because they don't collide.
3. **Single-writer-serialized**: read-modify-write of a shared file (PLAN.md, manifest.json, whiteboard.md). Concurrent calls are NOT safe; safety depends on the orchestrator never invoking them in parallel.

The parallel-work invariant becomes: *no verb in categories 1 or 2 may regress into category 3*. Category 3 verbs exist and are okay, but they're the constrained surface — adding a new one requires a deliberate decision and the contract has to note it.

This reframing also gives Q5 its test shape:

- For category-1 verbs: run twice, assert the file grew by exactly one record and the prefix is preserved byte-for-byte.
- For category-2 verbs: run twice with different keys, assert both target paths exist and are independent.
- For category-3 verbs: don't test concurrency-safety; instead, assert the verb is *registered* in a known list so a future PR that adds a new shared-file rewriter can't sneak in without updating the registry. (This is the cheapest possible "lint" — basically `expect(Object.keys(CATEGORY_THREE_VERBS).sort()).toEqual([...])` as a tripwire.)

The bundle/runtime concern I'd ordinarily raise doesn't apply, but the *test* runtime concern does: keep category-1 and category-2 tests in-process (import the verb's main, call it directly) rather than spawning `bin/<family>` subprocesses. Twelve verbs at ~50ms-per-subprocess-spawn is half a second per test run; in-process is sub-millisecond.

## Summary by question

- **Q1, Q2, Q3, Q4, Q7**: outside my lens, defer to react-architect / docs-IA voices.
- **Q5**: test shape works as a three-way registry-driven assertion (above). Keep tests in-process to avoid subprocess-spawn tax.
- **Q6**: real hotspot is `bin/guild whiteboard append` (read-modify-write on shared markdown). Loom's manifest/session/retro/checkin and draft's PLAN.md writes are also category-3 but safe-by-orchestration. Recommend reframing the invariant as a three-category taxonomy rather than a two-category one so the docs match what the code actually does.

Relevant files:
- `/home/krambuhl/work/aart.camp/.claude/cli/verbs/guild/whiteboard.ts` (the read-modify-write hotspot, lines 188-204)
- `/home/krambuhl/work/aart.camp/.claude/cli/verbs/guild/findings.ts` (clean append-only reference, line 166)
- `/home/krambuhl/work/aart.camp/.claude/cli/lib/events.ts` (clean append-only reference, line 56)
- `/home/krambuhl/work/aart.camp/.claude/cli/verbs/griot/operator-checks.ts` (clean append-only reference, line 55)
- `/home/krambuhl/work/aart.camp/.claude/cli/verbs/griot/capture.ts` (partitioned-write reference, per-folder)
- `/home/krambuhl/work/aart.camp/.claude/cli/lib/manifest.ts` (single-writer-serialized reference)
- `/home/krambuhl/work/aart.camp/.claude/cli/verbs/draft.ts` (single-writer-serialized reference, line 318)

### From whiteboard-react-architect

Useful texture. `bin/guild whiteboard` (lines 119, 204 of whiteboard.ts) calls `writeFileSync` on a non-append path — overwriting the whole whiteboard file. That's the orchestrator's append-by-section behavior at a higher level (each round writes a new section into the file), but at the filesystem level it's a full rewrite. Worth flagging as a candidate hotspot for Q5/Q6 — but a11y/perf/skeptic engineers will probably press there. My lane is API shape, not the test-suite shape.

I have enough now. The orchestrator wants my one section.

---

This brief sits mostly outside my lens — there's no React API surface, no `'use client'` boundary, no hook composition question in play. Documentation architecture isn't nothing, though, and a couple of the questions rhyme with API-shape decisions I do think about all day: where a reader's eye lands, how a citation reads at the call site, and whether one growing concept should be split into a family. I'll lead where those rhymes are real and defer where the design-systems and skeptic lanes own the call.

**Where I defer outright.** Q4 (recipe granularity), Q5 (test shape), Q6 (cross-family hotspot audit), and Q7 (sweep ordering) are substrate-engineer and skeptic territory. The append-only invariant test is a substrate-shape question — what I noticed in passing is that `.claude/cli/verbs/guild/whiteboard.ts` does `writeFileSync` of the full whiteboard file (lines 119, 204), which *looks* like a hotspot at the syscall level but is append-only at the section level (each round appends one engineer's section). That's exactly the kind of "is this a hotspot or not?" call that wants the skeptic and substrate-engineer voices, not mine. Flagging the artifact only so it's not invisible to them.

**On Q1 (where the catalog lives) — lead with a clear API-shape lean toward Option A, a dedicated file.** The recipes are *one concept per file* in the same way good components are one concept per file. LOOM-CONVENTIONS.md is already 440+ lines about loom's verb surface and substrate boundary; folding cross-family recipes (griot, guild) into it commits the same antipattern as a `<DataTable>` that grows real-time props until it can no longer be cleanly named. The name "LOOM-CONVENTIONS" stops being honest the moment it owns griot+guild recipes. Better: keep LOOM-CONVENTIONS as the loom-internal reference, author `projects/SUBSTRATE-COMPOSITIONS.md` as the recipe catalog, and let each file stay namable without "and." When you can't name a doc without joining two concepts with "and," it's doing too much — the same heuristic I'd apply to a component.

**On Q2 (meta-conventions home) — recommend the split (Option D), but with one caveat.** Recipes and framing are genuinely different artifacts: framing is read once by a new contributor onboarding, recipes are dereferenced repeatedly from ev-loop bodies during execution. Different read patterns, different cadences, different audiences. Split them. *Caveat*: LOOM-CONVENTIONS.md § "Historical note" explicitly says `projects/CONVENTIONS.md` was retired in trout-sunset and "no longer exists." Reanimating that filename for a new purpose will confuse anyone who reads the historical note and then finds the file present. Either pick a different name (`projects/SUBSTRATE-CONVENTIONS.md` to mirror `SUBSTRATE-COMPOSITIONS.md`, keeping the namespace coherent) or update the historical note in the same PR to say "retired in trout-sunset, reintroduced in substrate-cli Phase 6 with a different scope." The naming-is-architecture principle from CLAUDE.md cuts hard here — don't reuse the same name for a different concept.

**On Q3 (citation form) — Option D, with the preamble.** This is the closest thing in the brief to an API-call-site question and it's where I have the strongest lean. The bare `§ Compose PR` reads better at every individual call site than `projects/SUBSTRATE-COMPOSITIONS.md § Compose PR` — citation noise compounds when an ev-loop body cites recipes a dozen times. The full-path form is the symmetrical-but-verbose API (`<Stack direction="vertical">`); the bare form with a one-line preamble is the same idea factored out (`<VStack>` after `<Stack>` becomes too noisy at the call site). Each ev-loop body opens with one line — *"All § references in this body resolve to `projects/SUBSTRATE-COMPOSITIONS.md`"* — and every recipe citation downstream stays terse. This also future-proofs the move: if the catalog file is ever renamed or split, the preamble changes in two files (the two ev-loop bodies), not in fifty citation sites.

**One contradiction to surface for the next round.** If Q1 lands on Option B (fold into LOOM-CONVENTIONS.md) and Q3 lands on Option A (bare section reference), then bare `§ Compose PR` has to resolve into a file named after loom even though half its recipes are griot/guild. That's the naming-vs-scope mismatch the brief itself flags, and it'll quietly poison any future reader trying to figure out where to add the next recipe. Option A + bare-citation works cleanly. Option B + bare-citation creates a slow-burn debt. The panel should either pick A or accept the full-path citation form to make the scope mismatch readable at every call site.

**What I'd want resolved by the next round.** Whether the catalog is its own file (my lean) or an appendix (design-systems / skeptic call, since cohesion vs. proliferation is their lane). And the naming choice for the framing doc — *not* `CONVENTIONS.md` if `LOOM-CONVENTIONS.md` is going to stay, because the asymmetry is jarring. `SUBSTRATE-CONVENTIONS.md` + `SUBSTRATE-COMPOSITIONS.md` reads as a coherent pair; `CONVENTIONS.md` + `LOOM-CONVENTIONS.md` reads as a leftover.

**Relevant paths I read:**
- `/home/krambuhl/work/aart.camp/projects/LOOM-CONVENTIONS.md` (especially the "Historical note" at lines 442-449 — the retired-CONVENTIONS.md citation)
- `/home/krambuhl/work/aart.camp/.claude/skills/ev-loop-confidence/SKILL.md` (recipe section starts at line 39, "Format reference" line 30)
- `/home/krambuhl/work/aart.camp/.claude/cli/verbs/guild/whiteboard.ts` (lines 119, 204 — full-file writes worth a Q6 glance from substrate-engineer/skeptic)
- `/home/krambuhl/work/aart.camp/.claude/cli/verbs/guild/findings.ts` (line 166 — `appendFileSync`, clean append-only example for the Q5 test)
- `/home/krambuhl/work/aart.camp/.claude/cli/verbs/griot/operator-checks.ts` (line 55 — another `appendFileSync` example)
- `/home/krambuhl/work/aart.camp/projects/2026-05-16-substrate-cli/whiteboards/5-new-agent-families.md` (prior-round panel voice + design-systems lean toward explicit-naming-of-the-convention; the same instinct applies to Q3 here)

### From whiteboard-skeptic

Acknowledged — noted, continuing with the substrate question (the aart.camp project CLAUDE.md isn't load-bearing here, this work is on the substrate CLI side).

I have enough to pressure-test. Here is the skeptic section for Round 1.

---

## Skeptic — Round 1

The plan is well-scoped and the four sweeps are individually defensible. I'd push back on three things that I think will compound if not addressed inside Sweep 1's contract. Two of them are about hidden lock-in in the citation form; one is about the parallel-work invariant being weaker than the language suggests.

### Finding 1 — The catalog-location choice (Q1/Q2) is the kind of API decision that locks in

The recipes will be cited from at least two ev-loop bodies today, plus probably griot/guild prose and future loops. Once `§ Compose PR` is in the wild as a citation form (Q3-A), the home of that section is **the** name and moving it later means a coordinated edit across every citer.

Concrete worry on Q1-B (fold into `LOOM-CONVENTIONS.md`): the name says "loom" but the recipes that Sweep 2 adds (`Load rollup`, `Capture finding`, `Append finding`, `Derive panel`) are griot+guild. You'd be importing semantic dissonance the moment Phase 6 lands — the file's name promises loom-internal stuff, the body delivers cross-family. The "Format reference: LOOM-CONVENTIONS.md" line on line 30 of each ev-loop body is *already* a small lie if loom-conventions ends up holding guild recipes. The deeper risk: every future cross-family recipe extends that mismatch, and the rename later requires churn across every citer.

Concrete worry on Q1-A (new `SUBSTRATE-COMPOSITIONS.md`): cleanest semantically, but you now have three top-level docs in `projects/` (LOOM-CONVENTIONS, SUBSTRATE-COMPOSITIONS, and whatever houses the framing from Q2). Discoverability for a fresh contributor degrades — which file do I read first?

Concrete worry on Q1-C (`CONVENTIONS.md` as umbrella): merging LOOM-CONVENTIONS in is a significant churn risk (440+ lines of stable reference text moves, and every citation against it needs verification). Splitting it (CONVENTIONS = framing, LOOM-CONVENTIONS = loom verb surface, separate catalog = recipes) is cleaner but is three documents.

**Remedy** — pick the answer in the Sweep 1 contract that makes the **citation form portable**, not the one that minimizes today's file count. Concretely: I'd argue for Q1-A + Q2-A (separate `SUBSTRATE-COMPOSITIONS.md` catalog, separate `CONVENTIONS.md` framing doc), and accept the three-file outcome. The reason: when griot grows a fifth recipe in 2027, you add it to the catalog without renaming anything; when the framing rubric gains a third axis, you edit `CONVENTIONS.md` without touching recipes. Each file has one job. The cost is one extra file in `projects/`; the benefit is the citation form `§ Compose PR` stays stable forever because there's exactly one place it can live.

If you go with Q1-B (fold into LOOM-CONVENTIONS), **commit to renaming LOOM-CONVENTIONS.md in the same PR** (e.g. to `SUBSTRATE-CONVENTIONS.md`). Otherwise the name lies, and the lie compounds.

### Finding 2 — Q3 bare-citation form (`§ Compose PR`) is load-bearing in a way the question downplays

The options frame this as a stylistic call. It is not — it's a coupling decision.

- Q3-A (`§ Compose PR`): readable, but creates an implicit invariant that exactly one document in the world owns `§ Compose PR`. The moment a second document defines a `## Compose PR` section (e.g. someone writes a `RETRO.md` with a "Compose PR" section on retro PRs), the citation ambiguates silently. There's no tooling today that catches this.
- Q3-B/C (`LOOM-CONVENTIONS.md § Compose PR`): verbose at call sites, but the citation is self-locating — a fresh reader following a citation knows exactly where to go. Also survives the catalog file being renamed in a single find/replace.
- Q3-D (preamble): clever, but every ev-loop body gets a one-line preamble that's also part of the implicit contract. New loops have to remember to include it. The failure mode is silent (a loop without the preamble just has dangling bare citations).

The remedy depends on Q1, which is the contradiction the brief itself called out: if Q1-A wins (separate catalog file), the bare form (Q3-A) is OK *only if* you commit to "there is exactly one catalog file; never define `## Recipe Name` sections elsewhere in `projects/` markdown." That's an invariant worth writing down in `CONVENTIONS.md` so the next contributor (human or agent) doesn't accidentally create a collision.

**Remedy** — I'd lean Q3-B/C (full path + section). Yes it's verbose. But the ev-loop bodies cite recipes maybe a dozen times each — the verbosity tax is small, the unambiguity benefit is permanent. If you really want bare citations, write the "only one file defines §-recipes" invariant into `CONVENTIONS.md` AND add a check in the parallel-work test (Sweep 4) that scans `projects/*.md` for duplicate `## §-named` section headers. That's a real test, not a manual rule.

### Finding 3 — "Append-only or branch-partitioned" is a slogan, not yet a testable invariant

Q5/Q6 are the parts of the plan I'd push hardest on. The slogan reads well in CONVENTIONS.md, but "append-only" has a technical meaning (the file is only ever opened with `O_APPEND`, never rewritten in place) that I'd bet at least one current verb in `bin/loom`/`bin/draft` violates.

Specifically, candidates worth auditing before writing the test:
- `bin/loom phase update` — does it append a phase-update event, or does it rewrite `PLAN.md` (which is mutation, not append)? The PLAN.md revise path (per the user's memory note) is explicitly a non-hand-edit, CLI-owned mutation. That's *not* append-only.
- `bin/loom checkin write` — likely appends to `events.jsonl`, but does it also rewrite a "latest checkin" pointer somewhere?
- `bin/draft revise` — almost certainly rewrites PLAN.md. By the slogan's letter, this violates append-only.

If PLAN.md mutation is the canonical counter-example, then "append-only or branch-partitioned" needs a third clause: "or branch-scoped sole-writer" (PLAN.md lives on a feature branch and only one agent writes it per session). Otherwise the test in Sweep 4 will either be trivially passing (because it only tests `findings append` and `events log`, the verbs you already know are append-only) or it'll fail honestly against the real surface.

**Remedy** — before writing the test, do the audit Q6 hints at. Enumerate every mutating verb across the four CLIs; classify each as (append-only file write / branch-partitioned mutation / shared mutable hotspot). The test then becomes: "for each verb classified as append-only, assert the file it writes is opened with append semantics and the verb doesn't seek." For the branch-partitioned ones, the test is weaker — maybe just a registry check that says "this verb is declared branch-partitioned and the test acknowledges that." For shared mutable hotspots: that's the advisory-finding output PLAN.md line 522-523 promises. If the audit turns up *zero* hotspots, that's a strong claim worth verifying; if it turns up two or three, this phase shouldn't pretend to ship the invariant cleanly — it should ship the invariant *as audited*, with the exceptions named.

The compounding risk if you ship the slogan without the audit: future contributors read "all CRUD verbs are append-only or branch-partitioned" in CONVENTIONS.md and design new verbs against the slogan, not against the actual practice. Six months later somebody adds a verb that mutates a shared file because "that's how `bin/draft revise` already does it" and the invariant has decayed.

### Lower-priority notes

- **Q4 (granularity)**: flat list of 11 recipes vs grouped by family — I'd argue flat is fine for now. 11 items is below the threshold where grouping pays for itself, and the family grouping invites the implicit claim that recipes are *only* per-family (when something cross-family like "Compose PR" already spans loom + guild verbs). Revisit at ~20 recipes.
- **Q7 (ordering)**: I'd flip the case the brief proposes. Doing Sweep 3 (framing) before Sweep 1 (extraction) means you're writing CONVENTIONS.md prose about a catalog file that doesn't exist yet — the framing references things the reader can't follow. Extraction-first is right *if* the Sweep 1 contract knows the catalog's final name. The risk is doing Sweep 1, then realizing in Sweep 3 the framing wants a different name, then renaming inside the same PR. Mitigation: commit to the catalog filename in the Sweep 1 contract before extraction starts, even if Sweep 3's prose isn't written yet.

### Round-2 hook

The thing I'd most want to pressure-test in Round 2 is whether the panel converges on Q1-A (separate catalog) for the "clean semantics" reasons, or on Q1-B/C (fold into existing doc) for the "fewer files" reasons. Those are the kind of decisions where the consensus can be a rationalization — "fewer files is simpler" *feels* right but locks in the LOOM-name-vs-cross-family-scope mismatch. Worth checking in round 2 that the consensus is grounded in citation-stability, not file-count aesthetics.

---

**Files referenced**:
- `/home/krambuhl/work/aart.camp/.claude/skills/ev-loop-confidence/SKILL.md` (lines 30, 39 — `Format reference` line + `## Substrate compositions` section)
- `/home/krambuhl/work/aart.camp/.claude/skills/ev-loop-interactive/SKILL.md` (lines 37-303 — the parallel `Substrate compositions` block with 7 named recipes)
- `/home/krambuhl/work/aart.camp/projects/LOOM-CONVENTIONS.md` (440+ lines; the existing format reference, scope is loom-internal today)
- `/home/krambuhl/work/aart.camp/projects/2026-05-16-substrate-cli/PLAN.md` (lines 522-523 referenced by the brief)
- `/home/krambuhl/work/aart.camp/projects/2026-05-16-substrate-cli/whiteboards/6-extraction-extension.md` (this whiteboard; currently a stub with header only)

### From whiteboard-sketch-ideation

This phase is entirely substrate documentation work — `projects/LOOM-CONVENTIONS.md`, `projects/CONVENTIONS.md`, ev-loop skill bodies, `bin/<family>` test shapes, and the parallel-work invariant. None of it touches `sketches/`, the `<Sketch>` wrapper, `registry.ts`, the sketch-page shell, or the gallery's framing of sketches.

Out of scope for the generative-art / sketch-creative lens. Deferring entirely to the substrate-shaped voices on the panel (loom/draft/griot/guild conventions are not my territory).

No file paths to flag — the relevant files for this work live under `projects/` and `.claude/skills/ev-loop-*/`, none of which intersect with the sketch portfolio.

