# Whiteboard: Phase 1 of the draft-cli project: ship a small CLI

## Round 1

### From whiteboard-skeptic

I have enough context. Here is my skeptic-lens read for round 1.

---

## Skeptic — round 1: pressure on `projects/2026-05-15-draft-cli/PLAN.md`

The plan is in good shape overall — small surface, three flat verbs, sibling-not-parent posture toward loom, TDD discipline lifted from a methodology that's already proven. The shape is right. So I'll skip the "this could be smaller" reflex and concentrate on three concerns that I think have real probability and real impact, plus one alternative worth pinning before code lands.

### 1. The loop-side revision composer is the load-bearing piece, and it's being treated as a wiring step

The PLAN frames the CLI as the substrate and the skill as the conversation. That framing is correct for `/draft-plan`. But for `revise`, the actual judgment lives in **whoever composes the revision file** — and right now that's `ev-loop-confidence` / `ev-loop-interactive`, which the PLAN describes in one bullet (Phase 1, deliverable 6).

The bullet says the loop will:
- detect a scope-shift signal (heuristic, no schema yet)
- summarize the change to the user
- "compose a revision file (full new PLAN.md content reflecting the change)"
- call `bin/draft revise`

That middle step — *the loop composes a full new PLAN.md* — is doing an enormous amount of work in one phrase. It's a re-authoring of the canonical planning document, in-flight, by a skill whose primary job is shepherding a unit of work. Concrete risks:

- **Silent regression of decisions.** A grill-me session may have produced ten resolved decisions in `## Decisions`. A scope-shift composer working from "evaluator finding plus current PLAN" has no incentive to preserve the unrelated nine — it's writing a *full* replacement. The Decisions section drifts, and because revisions are full overwrites (not patches) and live only in git history, the drift is invisible unless someone diffs.
- **RESEARCH.md goes stale immediately.** PLAN is updated; RESEARCH.md is explicitly untouched by `revise`. After two or three revisions the RESEARCH trail describes a decision tree that no longer matches the plan. The PLAN says RESEARCH.md is a "working artifact alongside the canonical one" — but it becomes a *historical* artifact the moment the first revision lands. That may be fine, but it should be named: RESEARCH.md is a birth-time artifact, not a living one.
- **No revision rationale in-tree.** The reason a plan changed is captured only in the git commit message (which the CLI presumably authors). Six months later, when someone asks "why did Phase 2 change shape?", they get `git log PLAN.md` and a sequence of commit subjects. That's probably fine for this codebase, but it should be a *decision*, not an oversight. The PLAN's "no `REVISION-N.md` files" decision is good aesthetically; pin the commit-message format as the substitute and require the loop wiring to follow it.

**Concrete remedy options** (pick before writing the loop wiring):
- Make `revise` require a `--rationale=<string>` flag (or `--rationale-file=`) and bake it into the commit message in a stable shape (e.g., `[draft revise] <slug>: <rationale>`). Then `git log --grep` becomes the revision trail.
- Or: have `revise` append a one-line entry to a tail-end `## Revision log` section inside PLAN.md itself (date, one-line rationale, commit SHA). Lightweight, lives in-tree, survives outside-of-repo viewing. This is the "obvious naming hook" — a place future maintainers can look without digging into git history.
- Either way, **write a fixture for the loop's revision composer before the loop wiring lands.** It's not just a CLI verb; it's a skill that *re-authors a load-bearing markdown file*. It deserves the same fixture+test rigor the CLI verbs get, even if the test is "given this PLAN.md + this evaluator finding, the composer produces a revision that preserves Decisions section X."

### 2. "Permissive on the offer side" cuts the wrong direction

The PLAN's risk section says: *"start permissive on the offer side, let user dismiss; iterate based on real signal."* I'd push back on that default.

A loop skill that pauses mid-unit-of-work to ask "should we revise the plan?" is a *high-cost interruption*. The user is mid-deliverable; their attention is in the work; the loop's job is to keep them there. Offering a revise on a borderline signal costs more than missing it.

The asymmetry: a missed scope shift costs *one stale phase description* that you discover when you read PLAN.md next. A spurious offer costs *a context switch out of the unit-of-work*, plus the user has to evaluate the offer, plus they're now thinking about plan shape instead of the deliverable. Multiply by every deliverable in a project.

**Concrete remedy:** start *restrictive* — only offer revise when at least two signals concur (e.g., evaluator finding *and* user comment, or whiteboard contradiction *and* an explicit phase-boundary). Better to miss in v1 and iterate up than to train the user to dismiss the prompt. The "dismiss it" pattern is the failure mode where the prompt becomes background noise and a real scope shift gets dismissed reflexively.

This is a small framing flip in the PLAN, but it changes how the loop wiring gets built.

### 3. The plan-not-found / refuses-on-existing-PLAN behavior has a paste-from-elsewhere edge case

`plan` refuses if PLAN.md already exists, suggests `revise`. `revise` errors with `plan-not-found` if PLAN.md is missing. Both behaviors are right in isolation. The edge case: **what if the project directory exists, was scaffolded by `/trout-plan`, has Config.md / MANIFEST.md but no PLAN.md yet** (because trout-plan was interrupted, or scaffolds in a different order, or the user manually `rm`'d PLAN.md to redo it)?

- `draft plan` should succeed (no PLAN.md → write one). PLAN says it creates the directory; what happens when the directory exists but PLAN.md doesn't?
- `draft revise` will throw `plan-not-found` — fine, but the error should suggest `draft plan` as the remedy, not just say "plan not found."

This is a small surface area but it's the kind of "happens once, costs five minutes of debugging" thing that the structured error pattern is designed to absorb. Cheap to handle test-first: write a fixture for "directory exists, PLAN.md missing" for both verbs.

A related one: **`/trout-plan` and `/draft-plan` on the same slug, same day.** Collision check is on PLAN.md existence (good decision, documented). But the `git add`+`git commit` from the second skill will sweep up Config.md / MANIFEST.md if they were written but not yet committed by the first skill. Worth being explicit: `draft plan` `git add`s only PLAN.md and RESEARCH.md by name, not a directory-level add.

### Alternative worth pinning: does the loop need to call the CLI at all?

The PLAN's framing is: `/draft-plan` is a user-invoked skill, `bin/draft revise` is CLI-only because revisions are surgical. But the loop's revision flow is doing skill-shaped work (composing a full new PLAN.md from context, summarizing the change to the user, asking for confirm). That's a `/draft-revise` skill in everything but name — the PLAN even calls out deferring its lift to a skill if "loop-side revision composition turns out to want its own grill-me ceremony."

I'd flip the framing: **the loop calls `/draft-revise` (which is internally a thin skill: compose revision file, ask for confirm, shell out to `bin/draft revise`).** Same CLI surface, but the composer logic lives in a skill where it can be inspected, iterated, and eventually given a grill-me posture without restructuring the loop wiring. The "no `/draft-revise` skill" decision was made to keep revisions surgical, but the composer-in-the-loop *is* the skill — it's just hidden inside two different loop skills, in prose, where it will drift.

This is the lock-in concern: once `ev-loop-confidence` and `ev-loop-interactive` both embed a revision composer in their prose, changing the composition logic means editing two skills in lockstep. If a third loop ever appears, three. The "lift to skill later" deferred item becomes much harder once two loops have inlined the logic.

**Concrete remedy:** ship `/draft-revise` in Phase 1 as a *minimal* skill (no grill-me ceremony, just: take inputs, compose revision file, shell to CLI). The loops invoke it instead of inlining. Cost: one extra SKILL.md file. Benefit: single locus for revision-composition logic, an obvious place to add a grill-me ceremony later without touching loop wiring.

### What I'm not flagging

- The TDD discipline, fixture layout, JSON-by-default convention, and shim shape — those are lifted from loom-cli where they've been pressure-tested. No new risk.
- The flat-verb namespace decision — right call for three verbs.
- Coupling to loom-cli's lib — flagged in the PLAN's own Risks; the mitigation (small import surface, lockstep updates) is realistic.
- Template drift between `/draft-plan` and `/trout-plan` — also flagged in PLAN's Risks; mitigation is reasonable for a portfolio-scale project.

### Summary of the three things I'd want pinned before code lands

1. **Pin the revision rationale story.** Either `--rationale` on the CLI verb with a stable commit-message shape, or a `## Revision log` tail section in PLAN.md. The "git history is the revision trail" implicit decision needs to be made explicit and operationalized.
2. **Flip scope-shift detection from permissive to restrictive in v1.** The asymmetry favors missing shifts over spurious offers.
3. **Lift `/draft-revise` to a thin skill now, not later.** The composer logic exists either way; putting it in a skill avoids inlining it into two loop skills and locking in that shape.

### From whiteboard-react-architect

Good. I have enough to react. Here is the React-API architecture lens applied to this CLI design — same shape, different surface (verbs are components, fixtures are stories, the skill is a render-prop, the loop wiring is a parent passing state down).

---

## Where the design is load-bearing

**The big architectural commitment: draft is angular to loom, but coupled through `lib/`.** PLAN says draft is a "sibling consumer" of loom's substrate. That's the right framing — it's the CLI equivalent of "composition over configuration." Two small CLIs sharing a primitive layer beats one mega-CLI with mode flags. The Risk section already flags the coupling, and the mitigation (small import surface, lockstep updates) is correct. I'd just make one thing explicit before code lands:

**Pin the import surface in writing.** Right now the plan says "imports `resolveProject` and `LoomError`." That's two things. Make that the contract — if Phase 1 grows to need a third thing from `lib/`, that's a signal to pause and ask whether the thing should be extracted into a neutrally-named `cli/lib/` (not `loom-cli/lib/`). The naming is the architecture, as CLAUDE.md says. Today `lib/` lives at `.claude/cli/lib/` which is *already* neutrally-scoped — but the error class is `LoomError`. The first time draft throws a `LoomError`, somebody's going to read the stack trace and wince. Worth deciding now whether:

- (a) `LoomError` becomes `CliError` (substrate rename, one PR, before draft lands), or
- (b) draft accepts the asymmetry and we document "LoomError is the shared substrate error, despite the name" once, in one place, and move on.

I lean (a) — the rename is cheap right now, only loom-cli imports it, and the name will outlive the asymmetry by years. But (b) is defensible if you want to keep Phase 1 small. The skeptic will probably push harder on this than I am.

---

## Hook composition vs. monolithic hook (verb composition vs. monolithic verb)

The CLI surface is three flat verbs. Good. That's the composable-primitives instinct. One concern: **the `plan` verb is doing three things** — creates directory, writes two files, runs git. Compare to loom's verbs which (from the namespace registry) seem to be scoped tighter. Is `plan` actually one concept?

I think yes, *if* you read it as "atomically commit the initial planning artifact pair." The atomicity is the invariant — you don't want PLAN.md committed without RESEARCH.md, or either committed without a git commit. That's the single-invariant case where the monolithic shape wins. So `plan` is correct as-is, but the test fixture should make the atomicity visible: a fixture that exercises partial failure (e.g. git commit fails after files are written — what's the recovery story?). Today the plan doesn't mention that branch. Worth pinning.

**Hidden risk: there is no rollback story.** If `bin/draft plan` writes PLAN.md, writes RESEARCH.md, and then `git commit` fails (pre-commit hook rejects, signing fails, whatever) — you have two untracked files in a fresh project directory. Re-running the verb hits the "PLAN.md already exists" guard. The user is stuck deleting files by hand. The fix is small: either (a) wrap the file writes in a try/catch that cleans up on commit failure, or (b) make the "already exists" guard smarter — *if PLAN.md exists but isn't committed, re-running plan is allowed and overwrites*. I'd lean (b) because it matches how humans recover ("just run it again"). Pin this before code lands.

---

## Server-component-first / client-component-when-interactive (CLI translation: pure function first, side-effecting verb when necessary)

The translation here: **how much of `draft.ts` is pure parse/dispatch logic vs. file-system-and-git side effects?** Looking at `loom.ts`, the existing pattern is great — `parseInvocation`, `formatHelp`, `formatUnknownVerbError`, `dispatch` are all pure and exported. Side effects live only in `main()`.

Draft should mirror this exactly. Each verb wants two layers:

- **Pure**: `planVerb(args, env): {filesToWrite, commitMessage, gitArgs}` — returns a plan, doesn't execute.
- **Effectful**: a thin wrapper that takes the plan and runs the IO.

Why this matters for testability: the fixture-first TDD methodology works much better against pure-function output than against "did the right side effects happen." Today the plan implies fixture-driven tests against verb behavior, which suggests the side effects will be mocked or stubbed somehow — but that's a footgun. Pin the pure/effect split now, and the tests get cleaner for free.

This is also where you'd push back on a draft-specific risk: **the git commit is implicit in every verb that writes**. That hides a side effect — exactly the "predictable behavior" smell from my lens. Is there a `--no-commit` flag? Should there be? In a skill-driven world the skill always wants to commit; in a loop-driven world the loop also wants to commit. But for tests and for the recovery scenarios above, having `--no-commit` (or equivalent: `bin/draft plan --dry-run`) means you can test the file-writing layer without git involvement. Cheap to add. Worth pinning yes-or-no before code.

---

## Prop API shape (CLI flag and verb shape)

`plan <slug-or-topic> --plan-file=<path> --research-file=<path>` — readable at the call site. Good. `revise <slug> --revision-file=<path>` — also readable. `read <slug>` — readable.

Two API-shape notes:

1. **The "slug-or-topic" asymmetry in `plan`.** Other verbs take a slug (resolved through `resolveProject`). `plan` takes either a slug *or* a fresh topic (because the project may not exist yet). That's a real bifurcation in the prop API, and the verb is doing slug-resolution-or-creation depending on the input shape. Read at the call site, it's fine — the user knows whether they're planning fresh or amending. But the implementation has two code paths conditional on argument shape, which is the asymmetric-API smell. Worth at least naming this in the verb's docstring: "If `<slug-or-topic>` matches an existing project's slug suffix, errors with `project-already-exists`. Otherwise, treats as a new topic and creates `projects/<today>-<slugify(topic)>/`." Make the bifurcation explicit so the next reader (human or agent) isn't surprised.

2. **`--plan-file=` and `--research-file=` symmetry.** Good. Both required, both same shape. The open question about stdin piping is the right call to defer — temp files are simpler for skills, and stdin would force one-file-at-a-time which breaks the atomicity invariant above.

---

## State location (CLI translation: where does state live across the draft / loom / skill boundary?)

This is the question I want to press hardest on.

PLAN.md and RESEARCH.md live in `projects/<date>-<slug>/`. The skill writes them through `bin/draft plan`. The loop, on scope-shift, composes a *new full PLAN.md* and writes it through `bin/draft revise`. Git history holds the working revisions.

Three things to pin:

**(a) What state does the skill carry between turns of the grill-me interview?** The grill-me is "relentless interview, one decision at a time." That implies a multi-turn conversation where the skill needs memory of the decision tree as it walks. Where does that memory live? Two options:

- In the LLM context (the skill prose tells the model to track the tree in working memory, and at the end synthesizes RESEARCH.md). Cheap. Fragile if the interview is long enough to push earlier turns out of context.
- In an incrementally-written scratch file (`.draft-scratch.md` or similar, written turn-by-turn, finalized into RESEARCH.md at the end). More durable, but introduces a third file the CLI has to know about — and now draft owns more state than "commit PLAN+RESEARCH atomically."

PLAN currently implies option (a) — the skill synthesizes RESEARCH.md at the end. I think that's the right v1 call, but worth saying so explicitly in the SKILL.md so the next agent who reads it doesn't accidentally introduce scratch-file plumbing. If grill-me sessions reliably blow context, *then* revisit. Defer-and-name, don't preempt.

**(b) Where does scope-shift detection state live?** The loop notices a signal, pauses, summarizes to the user, composes a revision file, calls `bin/draft revise`. That's a stateful conversation inside the loop, not inside draft. Good — draft stays angular. But the *composition of the revision file* is where the architecture risk hides. The loop has to author a full new PLAN.md from (old PLAN.md + the new signal). That's a non-trivial synthesis step, and it's happening inside `ev-loop-confidence` / `ev-loop-interactive` rather than in a draft-owned skill.

This is the "single big stateful hook" smell. The loop is being asked to do scope-shift-detection AND revision-composition AND the existing loop work. Three jobs. The skeptic will push on this from the "is the loop the right home" angle; I'll push from the API angle: **the loop should call a thing, not be a thing**. Even if `/draft-revise` isn't a user-facing skill, there's a case for `/draft-compose-revision` as an *internal* skill the loop invokes — a small focused skill that takes (old PLAN, signal context) and emits a revision file. The loop stays loop-shaped; the revision composition lives next to draft.

PLAN currently says explicitly "no `/draft-revise` skill." I agree with that as a *user-facing* statement. But I'd press on whether there should be an *internal* composition skill the loop reaches into. Defer-and-name: build v1 with the composition inline in the loop, but if revision quality becomes a problem ("the loop's revisions are bad"), the next move is to factor out the composition skill, not to grow the loop.

**(c) Slug-resolution state across draft and loom.** Both CLIs read from `projects/`. If a project is born via draft and then `/trout-plan` runs on the same slug later (or vice versa), both tools see it. The collision check is on PLAN.md existence. Good. But: **what about MANIFEST.md?** If `/trout-plan` runs first, it scaffolds MANIFEST.md. If `/draft-plan` runs second, it… also wants to create the project. Draft doesn't know about MANIFEST.md (intentionally angular). Does `bin/draft plan` refuse if the directory exists but PLAN.md doesn't? Today's PLAN says "creates `projects/<date>-<slug>/` if PLAN.md doesn't already exist." Ambiguous on whether existing directory is OK.

I lean: directory existing is fine, PLAN.md existing is the only collision check. That matches PLAN's "Decisions" section ("Collision check is on PLAN.md existence, not directory existence. Allows `/draft-plan` and `/trout-plan` to coexist on the same slug if needed."). So this is already decided correctly — I'd just verify the fixture for `plan` covers the "directory exists, no PLAN.md" case explicitly.

---

## Composition over configuration (the prop-explosion check)

The verb surface is three verbs, no subnamespaces, flat. That's the composition instinct. Good. The skeptic might push "should draft be a verb of loom instead?" — `loom plan grill-me`, say. I'd argue no: the substrate-vs-skill axis is real, and draft has a different lifecycle (skill-led interview, loop-led revisions) than loom's verb surface (manifest CRUD, phase tracking, etc.). Two small CLIs with a shared lib beats one CLI with mode flags. The naming is the architecture.

One thing to watch: **the loop wiring is the configuration risk.** Today's plan says ev-loop-confidence and ev-loop-interactive both gain a scope-shift detection step. Two consumers, same step. The moment a third loop wants it, that's a duplication signal — extract the detection into a shared loop primitive. Not v1 work, but worth naming in the deferred list: "if a third loop adopts scope-shift detection, factor it out." Today it's two copies, which is fine; three copies is one too many.

---

## Predictable behavior (hidden side effects)

The CLI verbs do three side effects: filesystem writes, filesystem reads, git commit. The git commit is the implicit one — every write verb commits. Per the side-effect note above, I'd want `--no-commit` for testability and recovery. Beyond that:

- **`resolveProject` reads the filesystem.** Already documented behavior in loom, fine.
- **`plan` creates a directory.** Mention in the verb's help string that it's a side-effecting write. The user reading `bin/draft plan --help` should not be surprised by directory creation.
- **`read` is the one pure-ish verb.** Stays pure, good.

One subtle one: **the slug resolution for `plan` is *not* through `resolveProject` when creating fresh** (because the project doesn't exist yet). It's only through `resolveProject` for `revise` and `read`. So `plan` has its own slug logic: "if input has date prefix and matches existing, error; otherwise slugify and prepend today's date." That's a small new function — maybe `createSlug(topic, today): slug` — and it should live in `lib/project.ts` next to `resolveProject` to keep slug grammar in one place. Pin this before code: **don't let `draft.ts` grow its own private slug-creation logic when the substrate is right there**. If `createSlug` doesn't exist in loom's lib yet, add it as a tiny prerequisite PR (or first commit in the draft PR), with its own test. Reuse beats duplication every time, especially for naming primitives.

---

## Summary of things to pin before writing code

1. **`LoomError` rename to `CliError`** — or explicit decision to keep the name and document the asymmetry. Lean rename.
2. **Recovery story for partial-write/commit-failure** — likely "re-running `plan` overwrites uncommitted PLAN.md."
3. **Pure / effect split per verb** — mirror loom.ts's `parseInvocation`/`dispatch` shape; verbs return plans, a thin wrapper executes.
4. **`--no-commit` (or `--dry-run`)** — yes/no, lean yes for testability and recovery.
5. **Internal composition skill for revisions** — defer building, but name the deferral. Loop composes inline in v1; factor out if revision quality slips.
6. **`createSlug` belongs in `lib/project.ts`**, not inside `draft.ts`. Tiny prerequisite or first commit in the PR.
7. **Fixture coverage for the edge cases** — directory-exists-but-no-PLAN.md, partial-write recovery, git-commit-failure. Not just happy paths.
8. **Document the "slug-or-topic" bifurcation in `plan`** — explicit in help text and docstring so the next reader sees both code paths.

The overall shape is good: small, composable, angular, test-first. The risks are mostly at the seams — error naming, recovery, where composition state lives. Pin those, then ship.

### From whiteboard-design-systems

Acknowledged the project CLAUDE.md.

OK. Pulling on the design-systems thread now — this isn't React/CSS, but everything I care about (semantic naming, composition vs. configuration, matching existing vocabulary, on-the-rails-plus-escape-hatches, naming as architecture) applies just as cleanly to a CLI surface and its skill counterparts. A CLI is a design system for verbs.

## The naming surface is doing more work than the plan acknowledges

Three flat verbs — `plan`, `revise`, `read` — sit inside the same repo as `loom`, which has eight namespaces full of verbs. The plan calls the flatness "small enough that loom's multi-namespace registry is overkill," and that's fine for implementation. What it doesn't address: a user typing at the command line now has to hold two mental models in parallel — *loom's verbs are namespaced, draft's verbs are not*. That's a vocabulary fork inside one substrate. The skeptic will probably press the "do you need a new CLI at all" question; my version of that pressure is narrower: **even if draft stays separate, its verbs should read like they live in the same family as loom's verbs.**

A few naming pulls worth resolving before code:

- **`plan` as a verb is overloaded.** `loom phase ...` has `start` / `complete` / `read`; `loom project scaffold` exists. The natural symmetry would be `draft scaffold` or `draft create`, not `draft plan`. Reading `bin/draft plan` parses, on first encounter, as "draft a plan" (gerund) rather than "create the draft, verb=plan." Compare to `bin/draft revise` which is unambiguously imperative. The mixed grammar is a small smell. Options: `draft new`, `draft create`, `draft scaffold`, or keep `plan` and explicitly own that draft's verb-vocabulary is plan-shaped (`plan`/`revise`/`read` all act on the plan). I'd lean toward the third — own it, and rename `read` to `read-plan` or just accept that *every draft verb acts on PLAN.md*. The vocabulary cohesion comes from naming the implicit object.

- **`/draft-plan` skill vs. `bin/draft plan` verb collide in the user's head.** Same words, two different things. A user who's used `/trout-plan` will instinctively type `/draft-plan` and get the interview; a user who's used `bin/loom project scaffold` will instinctively type `bin/draft plan` and get the CLI. These are different surfaces serving different audiences (human-in-conversation vs. skill-in-orchestration), but the matched naming hides the asymmetry. Worth considering: name the skill `/draft` (verbless, since it does the one thing the user invokes it for) and let the CLI keep `plan`. Or rename the CLI verb to something the skill *doesn't* match (`commit`, `write`, `scaffold`). The current naming makes the seam invisible, which is the opposite of what good naming does at a boundary.

- **`RESEARCH.md` as the file name for the grill-me trail.** "Research" describes *content type* (gathered information), not *the artifact's role in the system*. The role is: this is the decision-tree-as-walked, the working scratch alongside the canonical PLAN. Closer-to-meaning names: `DECISIONS.md`, `INTERVIEW.md`, `EXPLORATION.md`, `DRAFT-NOTES.md`. `RESEARCH.md` is a recognizable convention from other tools, which is an argument *for* keeping it — but the convention does literal-describe rather than role-describe. Worth at least naming the choice: "we're using `RESEARCH.md` because the convention is widely understood, even though the file's actual role is closer to `INTERVIEW-TRAIL.md`." Pin the decision so future readers don't think it's accidental.

## Composition over configuration shows up in the verb shape

`plan` takes `--plan-file=<path>` and `--research-file=<path>`. `revise` takes `--revision-file=<path>`. That's three flag names for what is conceptually *one operation*: "here is the markdown content, write it to the right place." The plan even calls out the open question of whether to accept stdin instead. My read: the flag-per-file pattern is configuration-shaped. A composition-shaped surface would be:

```
draft plan <slug> < plan.md
draft plan <slug> --research < research.md  # secondary file
```

or even more composable:

```
draft write <slug> --target=plan < plan.md
draft write <slug> --target=research < research.md
```

That second shape makes RESEARCH.md and PLAN.md *the same kind of thing* (a project markdown artifact) parameterized by which one — which is what they actually are at the storage layer. The current shape names them as separate first-class concepts in the CLI, which means adding a third artifact later (DECISIONS.md? CHANGELOG.md?) requires another flag and another code path, not a parameter value. The flat-verb-with-target-flag shape is the "high abstraction with semantic knob" pattern, and it scales.

Counter-argument I'd accept: if `plan` is literally always "write both PLAN.md and RESEARCH.md atomically as a single commit," then keeping them as named flags makes the atomicity legible at the call site. The orchestrator skill *does* always produce both. So maybe the right shape is:

```
draft plan <slug> --plan=plan.md --research=research.md  # atomic, both required
draft revise <slug> --plan=new-plan.md                   # PLAN.md only
```

Note the shortening from `--plan-file` to `--plan` — the `-file` suffix is type-describing (literal) where the flag name should be role-describing (semantic: "the plan content lives here"). Similar tightening: `--research-file` → `--research`, `--revision-file` → `--plan` (since a revision *is* a new plan; calling it a "revision" in the CLI surface bakes the temporal framing into a flag that's just "new content"). The verb already encodes "this is a revision"; the flag doesn't need to.

## The `read` verb is the place where prior-art cohesion really matters

The plan flags this as an open question ("does `read` add value over `cat`?"). The design-systems answer is: yes, *if and only if* it matches loom's `read` shape exactly. Same JSON-by-default, same `--pretty` flag, same payload structure for "this is a markdown file at this path." If loom's `phase read` emits `{ "path": "...", "content": "...", "phase": {...} }`, draft's `read` should emit a structurally compatible payload (`{ "path": "...", "content": "...", "plan": {...} }` or similar). A reader writing a script that introspects projects shouldn't have to learn a second envelope.

The plan says "JSON output by default on reads; `--pretty` for human view (same convention as loom-cli)." Good — but make this an explicit decision pinned in `## Decisions`, not a passing line in the surface description. The convention IS the API contract.

## The implicit "draft" state needs to be a named concept somewhere

> "Draft" is the implicit state of a plan-in-progress, known-only-when-complete. No `REVISION-N.md` files.

This is fine as an implementation decision. But the *name of the CLI is `draft`*, and the *state it manages is "draft"* — and those two things are doing different work. The CLI is named for the thing it produces (a draft plan); the state is the lifecycle phase of that plan (drafting vs. final). When the project archives, the plan becomes "final" — but `bin/draft` still wrote it, and `bin/draft read` will still read it, even when it's no longer a draft.

This is a minor lexical pull, but worth resolving in prose: is `draft` (the CLI) named for *what it does* (drafts) or *what it produces* (drafts)? If the former, then `bin/draft read` reading a finalized plan is mildly weird. If the latter, then `bin/draft` is fine, but the README/help text should say "draft: the planning artifact CLI" not "draft: a planning CLI." Tiny, but naming-as-architecture means saying out loud what the noun refers to.

## On the escape hatch (and the absence of one)

The plan deliberately omits `/draft-revise` — revisions are CLI-only. That's the "no ceremony for the surgical case" instinct, and I agree with it as a default. But there's no documented escape hatch for the case where a revision *does* need conversation. A user who wants to grill-me a revision today has to:

1. Run `/draft-plan` against a fresh slug (won't work — collision).
2. Edit PLAN.md by hand and commit.
3. Run `/trout-plan` (which presumably has its own behavior on existing projects).
4. Manually compose a revision file and call `bin/draft revise`.

Option 4 is the de-facto escape hatch, but it's not named as one. The plan should explicitly say: **"to grill-me a revision, run a conversation with the assistant, have the assistant compose a revision file, then `bin/draft revise <slug> --revision-file=<file>`."** That's the off-the-rails path made legible, which is exactly the design-system pattern: the escape hatch is *named* and *blessed*, not *discovered*.

## Risks worth adding to the list

- **Verb-grammar drift between draft and loom.** If loom's verbs are noun-namespaced (`project scaffold`, `phase start`) and draft's verbs are bare imperatives (`plan`, `revise`), users developing instincts in one space will mis-type in the other. Pin a sentence in `## Decisions`: "draft verbs are bare because draft's implicit noun is always PLAN.md; loom verbs are namespaced because loom manages many nouns." That makes the asymmetry intentional rather than accidental.

- **`/draft-plan` skill reaches across the seam to invoke a bin shim.** The plan describes this as "shells out to `bin/draft plan`." Good — clean separation. But the skill needs a documented contract for *what it passes* and *what it expects back* (exit code conventions, JSON payload on success/failure). Without that contract, every future skill revision risks drifting the call shape. Worth a small "Skill-to-CLI contract" subsection in the PLAN, or at least one bullet in `## Decisions`.

- **PLAN.md template living in `/trout-plan` and being reused by `/draft-plan`.** Risk #1 in the plan calls this out as "template drift." The mitigation is "cross-reference." A stronger mitigation: extract the template structure to `projects/PLAN-TEMPLATE.md` (or similar canonical location) and have both skills point at it. That's the "one source of truth, two consumers" pattern — same logic as `sketches/registry.ts` being the single source of truth for sketches. Defer if it feels premature, but name it as the obvious next step if a third writer appears.

## Things I'd pin in `## Decisions` before any code lands

1. Verb grammar: bare imperative because the implicit noun is always PLAN.md. (Or namespace it `plan ...` if symmetry with loom matters more than terseness — pick one and own it.)
2. Flag naming: role-describing (`--plan`, `--research`), not type-describing (`--plan-file`). Or keep the `-file` suffix and own that the CLI is filesystem-shaped at its surface. Pick one.
3. `RESEARCH.md` vs. role-describing alternative. Decision either way is fine; the *naming-the-decision* is the point.
4. The escape hatch for grill-me revisions. Even if it's just "talk to the assistant, then call `bin/draft revise`," it should be a sentence in the README/SKILL.md.
5. The skill-to-CLI contract (JSON payload shape on success, exit codes, error code stability).

