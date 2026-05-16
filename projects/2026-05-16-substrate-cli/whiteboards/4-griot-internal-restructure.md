# Whiteboard: Phase 4: griot internal restructure

## Round 1

### From whiteboard-a11y

# Accessibility perspective: Phase 4 griot internal restructure

## Carve-out

This work is substrate plumbing — Node CLIs (`bin/griot`), skill markdown files (`/griot-load`, `/griot-compact`), JSON sidecars (`state.json`, `rollup.json`), and a migration script. There is no rendered UI, no DOM, no focus management, no screen-reader surface, no keyboard interaction, no color/contrast question, no motion. The "user" of these artifacts is either another agent (consuming `rollup.json` rendered as prose) or the human running `bin/griot` from a terminal.

The accessibility lens I bring — semantic HTML, focus management, keyboard parity, reduced motion, programmatic label association — has no surface to land on here. I'm carving out.

## One small adjacent note (take or leave)

The one thread that brushes accessibility-adjacent territory, and only barely, is the **plain-language principle** I lean on for microcopy. It applies obliquely to two artifacts in this PR:

- **`bin/griot use --as=llm` rendered prose**: when the CLI renders `rollup.json` to LLM-friendly prose, the rendered text is what shapes the agent's downstream understanding. Terse, direct, unambiguous phrasing in the render template helps the agent the same way it helps a screen-reader user: less to disambiguate, less to mis-read. Worth keeping the render template's language plain and the field-to-prose mapping mechanical and predictable (so the prose is round-trippable in the reader's head). This is a design-systems / performance call more than an a11y call, though — flagging only, not leading.

- **Migration-script output to terminal**: if the one-time migration script prints status to stdout, the convention of "plain language, no inside-baseball jargon, no decorative ASCII that screen-readers stumble over" applies to anyone running the script with a terminal screen-reader. Low-stakes — it runs once at merge time — but worth a passing thought if the script prints progress.

Neither of these rises to the level of a unit-contract concern. Design-systems and performance own the substantive calls in this PR.

## Deferrals

- **Schema/naming** for `state.json` and `rollup.json` fields → defer to **whiteboard-design-systems**.
- **`/griot-load` vs `/griot-compact` vs `bin/griot use` naming coherence** → defer to **whiteboard-design-systems**.
- **`rollup.json` parse cost at session-start, render cost in `bin/griot use --as=llm`, migration-script perf** → defer to **whiteboard-performance**.
- **Atomic-cutover vs dual-read, PR bundling, L-004 split for `/griot-load`, citation-grep verification** → defer to **whiteboard-skeptic**.
- **Node CLI / skill-body architecture shape** → defer to **whiteboard-react-architect** (though they likely also carve out, since there's no React).

## Bottom line

No a11y findings to shape the D1/D2/D3 unit contracts. The unit-contract author should not expect to cite an "a11y" section by name from this whiteboard — there isn't a substantive one to cite. If a later phase introduces a rendered UI surface (a dashboard for browsing learnings, a web view of `rollup.json`, anything with a DOM), the a11y lens re-engages then.

### From whiteboard-design-systems

Good. I now have enough to ground my perspective in the actual artifacts. Two important observations before the design pass:

1. The existing `learning.md` files I've sampled actually don't carry YAML frontmatter — they're already pure prose with a draft footer. The frontmatter must live elsewhere (the rollup entries don't carry per-entry frontmatter either; they're prose blocks with `Promoted:` / `Origin:` inline metadata). So the "YAML frontmatter on MD" the brief refers to may be a state file I'm not seeing, OR the brief is describing the *future* state being formalized. Either way, the brief's framing is the source of truth.

2. `config.yaml` already enumerates a `paths:` table — `rollup`, `citations`, `session_notes`, `archived`. That config is the closest thing griot has to a *naming registry*, and it's going to need touch-up in Phase 4. The schema/naming choices I make below should land cleanly into that table.

---

### The semantic spine: name the state, not the storage

The single biggest design-systems call in this phase is whether the new sidecar file is called `state.json` or something more semantic. `state.json` is honest about what it stores but inert as a name — it tells you the *format* (JSON) and the *bucket* (state), but not *what state*. Compare to the existing griot vocabulary in the folder:

- `prompt.md` — what triggered it
- `wrong.md` — what Claude did
- `correction.md` — what the human said
- `learning.md` — the distilled lesson
- `rubric.md` — the binary assertions
- `full_transcript.md` — the raw evidence

Every one of those names answers "what does this file MEAN in the griot pipeline?" — they're roles, not formats. A `.json` suffix breaks that pattern cosmetically (the others are `.md`), and that's *fine* — extension reflects format, name reflects role.

The question is whether `state` is the right role-name. The fields the brief lists — classification, evaluator, code, frequency-count, status, promoted_as — are all *pipeline-position* fields. They answer "where is this note in the griot lifecycle?" My pull is toward `pipeline.json` or `lifecycle.json` over `state.json`. "State" is what a React engineer thinks; "pipeline position" is what a griot consumer thinks. **But** — and this is where I check my own instinct — `state.json` is the boring, conventional, terminal-readable name, and griot is a personal pilot, not a public design system. The cohesion cost of inventing a clever name nobody else uses is real. Recommendation: keep `state.json`, but commit to it as the *semantic* name (the state of *this note in the griot pipeline*), and resist the urge to ever shorten it to `meta.json` or generalize it to `note.json` in a future refactor. Document the role in the README's directory layout block (the table I just read at lines 38-64).

A secondary call: there's a four-MD-file body (`prompt`, `wrong`, `correction`, `learning`, plus `rubric`, plus `full_transcript`) and one JSON sidecar. The brief positions the JSON as a *sidecar to the prose*. That framing is correct and worth preserving in any contract language — the prose files are the substance; `state.json` is the machine index pointing at where this substance sits in the pipeline. If a future contract starts talking about state.json as "the source of truth for the note," push back: the prose is the source of truth, state.json is the routing label.

### rollup.json schema: the body field is the load-bearing decision

The rollup entries today are *narrative prose with structured headers*. Look at L-001 in rollup.md (lines 1-26 above):

- Title line (`## L-001: Node 24 strips TS — use \`node\` directly`)
- `Promoted: <date>` line
- `Origin: <slug>` line
- `### Learning` prose block (multi-paragraph, prose with caveats)
- `### Rubric` bullet list

The JSON-ification temptation is to flatten this to `{id, title, promoted, origin, learning, rubric}` with `learning` and `rubric` as scalar strings. That works for transport but destroys the *authoring affordance* — nobody writes multi-paragraph prose comfortably inside a JSON string literal. The rewriter agent and rubric-author agent both produce this prose; they'd be writing into a JSON field that has to be escaped, and any human inspecting `rollup.json` would be reading `\n\n###` instead of headings.

The cleanest split I see, which preserves the system's authoring intent:

```
{
  "id": "L-001",
  "title": "Node 24 strips TS — use `node` directly",
  "classification": "L",
  "promoted": "2026-05-11",
  "origin": "2026-05-06T10-22-36-node-24-strips-types",
  "body": "<markdown string: the Learning section prose>",
  "rubric": ["<criterion 1>", "<criterion 2>", "<criterion 3>"]
}
```

Three design-systems calls in this shape:

- **`body` stays markdown.** That's the "faithful round-trip" the brief asks about. The JSON gives you per-field handles (`id`, `title`, `classification`) for routing and rendering, but `body` is a string-of-markdown — the same prose that lives in rollup.md today, just escaped. `bin/griot use --as=llm` renders the JSON by emitting `## ${title}\n\n${body}\n\n### Rubric\n${rubric.map(...)}` and you get back the rollup.md format losslessly. This is the same pattern as how Figma variables store hex literals but expose them through semantic-token names: the underlying data is preserved verbatim, the schema layer adds *handles*, not transformation.
- **`rubric` is an array of strings**, not a single markdown string. Rubric criteria are already enumerated bullets and machine-checked by the judge panel; modeling them as a flat list of strings gives downstream consumers (the judge dispatcher, calibration analysis) typed access without re-parsing markdown bullets. This is the one place where schema discipline buys real value beyond round-tripping prose.
- **`classification` becomes a first-class field**, not just an `L-` prefix on the id. Today the L/AP/etc. distinction (whatever AP-NNN stands for — antipattern? applied-pattern?) lives only in the id string. Lifting it to its own field means filters and stats stop string-parsing the id. The id remains the human-readable handle; `classification` is the machine handle. This is the same pattern as `color.background.surface` vs `color.gray.200` — the structured field encodes meaning the string was carrying implicitly.

One thing worth pressing on: the brief's pinned Decision says *"rollup is LLM-only output."* I want to nudge back on that framing slightly. The JSON is the source of truth; the LLM-prose render is *one* output. There may also be a human-readable render (a `--as=human` flag, or just `cat` of `bin/griot use` with a sensible default). Don't paint the JSON into a corner where its only consumer is the LLM render path — leave room for `bin/griot use --as=human` to exist later if you want a maintainer to read the validated learnings without LLM ceremony. The Decision is right that the *prose-in-the-repo* artifact is gone; it's not (yet) right that the only render target is LLM-shaped output.

### Naming the new skill: `/griot-load` vs the existing vocabulary

The brief introduces `/griot-load`. Let me lay the existing skill vocabulary next to it (from README lines 28-33):

- `/learnings-capture` — fast capture, no LLM
- `/learnings-use` — start-of-session loader, installs citation contract
- `/griot-compact` — manual run of the judge panel
- `/learnings-report` — weekly summary

There's already a vocabulary split happening here that's confusing on its own: some skills are `learnings-*` (capture, use, report) and some are `griot-*` (compact). That split is presumably intentional — `griot-*` is the orchestration tier, `learnings-*` is the user-facing surface — but it's not articulated anywhere I can see. Adding `/griot-load` to the `griot-*` family is fine *if* the family means something coherent, and from the brief, `/griot-load` sounds like it's user-facing (loads rollup for a session, like `/learnings-use` does today).

**Naming question that needs answering before D3 lands:** is `/griot-load` a *replacement* for `/learnings-use`, or a *peer*? If replacement, the rename should be called out as a deprecation in the same PR (the `git mv` move). If peer, what's the difference? The brief says `/griot-load` "wraps the render step as the addressable user surface" — that sounds like `/learnings-use`'s job description. If both exist after Phase 4, the next reader will spend cycles figuring out which to invoke.

My pull: rename `/learnings-use` → `/griot-load` (or vice versa) as part of Phase 4. Two skills with the same job and different names is a cohesion failure. If the broader project intent is to unify the family under `griot-*`, the Phase 4 PR is the right place to do it, since you're already touching the rollup-loading path. If the intent is to keep `learnings-*` as the user surface and `griot-*` as the machinery, `/griot-load` is misnamed and should be `/learnings-load` or fold into `/learnings-use`. Pick the family deliberately; don't grow a parallel one by accident.

Either way: **add a note to the README's skill table in the same PR.** That table at lines 28-33 is the authoritative inventory of skills, and any new skill that doesn't show up there is invisible to the next person reading the repo.

### Schema/naming consistency across griot artifacts: what `config.yaml` is going to need

Look at the `paths:` block in config.yaml lines 76-90. `rollup: learnings/rollup.md` is going to need to become `rollup: learnings/rollup.json` in the same commit that introduces the new format. That's a one-line change but it's a load-bearing one — anything that reads `paths.rollup` (the skill bodies, scripts) is going to receive the new path. Cohesion check: is anything in the codebase reading the old `rollup.md` path through a different mechanism (hardcoded constant, env var, CLAUDE.md reference)? The Phase 4 PR contract should include a "find all `rollup.md` references" sweep — grep for `rollup.md` literal, grep for `paths.rollup`, grep for `learnings/rollup` to catch path-fragment references — and update them all atomically. This is exactly the "naming is architecture" lens: same path expressed two ways will drift the moment you change one.

Same sweep applies for `state.json` — the moment it's introduced, every reader of the old `learning.md`-with-frontmatter shape needs to switch. The brief's atomic-cutover instinct is correct *for naming cohesion reasons*, not just for code-correctness reasons: a transitional period where both shapes exist is a transitional period where the next reader has to learn two vocabularies.

### Pressure-testing the open questions

On the open questions the brief flags, here's where the design-systems lens lands:

**Cutover atomicity (single commit vs dual-read tolerance):** dual-read tolerance is the wrong abstraction for this kind of name change. Dual-read is appropriate when you have multiple long-lived consumers maintained by different teams that can't all flip in one PR. Here the consumers are: one bin script, one skill body, one PR migration of in-flight notes. All in one repo, one PR-author, one merge. The cost of dual-read is *permanent code surface* (two parsers, two writers, branching logic forever unless you remember to come back and rip it out — which you won't, and the next reader inherits both paths and has to figure out which is canonical). The cost of atomic cutover is *one merge with coordinated changes*. Atomic wins on every dimension that matters here: simpler code, clearer git history, no zombie code path. The brief's instinct is right.

The one caveat: the migration of in-flight session-notes is a *data* migration, not a code migration. The migration script should be idempotent and re-runnable — if you re-run it on already-migrated notes, it should be a no-op, not a crash. That's not dual-read; that's defensive migration.

**`/griot-load` body — wrapper or value-add:** the design-systems instinct here is that *the user-facing surface should be the same shape across the family*. If `/learnings-capture` and `/griot-compact` have a similar body shape (preamble, what-it-does, invocation), `/griot-load` should match. The wrapper-vs-value-add question is the wrong frame — the right frame is "does this skill explain itself to the next maintainer in the same way the siblings do?" If `bin/griot use --as=llm` does all the work, the skill's job is to be a documented, discoverable, name-stable handle for that invocation. Pure wrapper is fine as long as the wrapper is named, documented, and family-consistent.

**L-004 split for `/griot-load`:** the design-systems lens here is mostly indifferent (L-004 is a runtime constraint, not a naming one), but I'll note: if `/griot-load`'s first invocation comes via `/ev-run` at the *next* session's start, and Phase 4's authoring session never invokes it, the L-004 constraint is satisfied incidentally. The contract should *say* that explicitly though — "Phase 4 ships `/griot-load` but does not invoke it; first invocation is at next-session `/ev-run`" — so a future reader doesn't accidentally add a "smoke test the new skill" step to D3 that would violate L-004.

**PR sizing:** the design-systems lens leans hard on conceptual unity here. Three coupled restructures + a new skill *is* one conceptual change: "rotate griot's storage format from prose-with-frontmatter to prose-plus-typed-sidecar, and rotate rollup from prose to JSON-with-render-step." Those are facets of one rotation, not three rotations. The CLAUDE.md "one conceptual change per PR" rule supports the bundling — the splitting heuristic is conceptual unity, not line count. Where I'd push back: the `/learnings-use` → `/griot-load` rename (if you go that direction) is *adjacent* to this rotation but not the same conceptual change. That rename could either ride along (if it's one mechanical mv + table update) or be a tiny precursor PR. Either works; don't make it three PRs.

**Migration script lifecycle:** `bin/griot migrate` reads cleaner than `.claude/scripts/<one-off>.ts`. The `bin/griot` namespace is already the griot CLI surface; making migration a subcommand keeps the entry-point discoverable (`bin/griot --help` lists it), keeps it tested in the same harness as the rest of `bin/griot`, and means the next time you need to migrate format-N to format-N+1 (which you will), there's already an established place for it. The "run once and discard" framing is the failure mode — migration scripts get rediscovered and re-run, and a discarded one becomes a "where did we put that?" problem six months later.

The archived session-notes question is real and design-systems-shaped: if the new `state.json` shape becomes the system's only shape, the archived notes (which I see plenty of in the glob) become *historical artifacts in a deprecated format*. Two valid moves: (a) migrate them too (one-time, mechanical) so the entire corpus is one shape, or (b) explicitly mark `archived/` as a graveyard format-frozen at the time-of-archive. Option (a) preserves cohesion across the whole `session-notes/` tree at the cost of touching archived data; option (b) accepts a vocabulary discontinuity at the archive boundary. My pull is (a) — the cohesion cost of "two shapes coexist in the same tree, distinguished only by directory" is high enough that touching the archive is worth it. But this is a soft pull; option (b) is defensible if anyone scripts against the archived notes assuming the old shape.

### Things the unit-contract author can cite

For the three D1/D2/D3 contracts that follow, the design-systems sections to anchor against:

- **D1 (session-notes folder shape):** "The semantic spine: name the state, not the storage" — `state.json` is fine as a name with the caveat that it's the *pipeline-position* state, not "state" in the abstract; the prose files remain the source of truth and the sidecar is the routing label.
- **D2 (rollup format change):** "rollup.json schema: the body field is the load-bearing decision" — `body` stays markdown-as-string for faithful round-trip, `rubric` becomes a typed array, `classification` lifts to its own field, and "rollup is LLM-only output" gets softened to "LLM is the primary render target but the schema doesn't preclude a `--as=human` render later."
- **D3 (/griot-compact body updates + /griot-load skill):** "Naming the new skill" — resolve the `/learnings-use` vs `/griot-load` relationship before the contract lands; if `/griot-load` is the replacement, do the rename in the same PR and update the README skill table; if it's a peer, the contract has to articulate the difference.
- **Cross-cutting (all three contracts):** the `config.yaml` `paths:` block update and a repo-wide grep sweep for `rollup.md` / `learning.md`-frontmatter references are non-negotiable parts of the atomic cutover — same-name-two-ways is the cohesion failure mode this whole phase is trying to *not* create.

### Files referenced

- `/home/krambuhl/work/aart.camp/learnings/rollup.md` — current rollup format, source for the JSON schema decisions
- `/home/krambuhl/work/aart.camp/learnings/config.yaml` — paths table that needs the rollup.md → rollup.json update
- `/home/krambuhl/work/aart.camp/learnings/README.md` — skill inventory table (lines 28-33) and directory layout block (lines 38-64) that need updating in the same PR
- `/home/krambuhl/work/aart.camp/learnings/session-notes/2026-05-08T16-04-25-latent-config-no-import-shallow-typecheck/learning.md` — sample of current `learning.md` shape (pure prose, no frontmatter visible)
- `/home/krambuhl/work/aart.camp/learnings/session-notes/2026-05-04T03-07-19-substrate-api-stability/` — another live session-note folder; full sibling-file inventory for the D1 contract to enumerate
- `/home/krambuhl/work/aart.camp/learnings/session-notes/archived/` — the archived notes whose migration is the design-systems "graveyard or cohesion sweep" call

### From whiteboard-performance

I've seen enough. The session-notes-with-frontmatter file I read is actually already pure-prose with no YAML frontmatter — interesting; the brief's "today uses YAML frontmatter" may be referring to a subset or the in-progress notes. Let me lock in my perspective.

## Performance perspective

### Setting the cost frame

Three things to keep in mind as I push on this design:

1. **The hot path here is session startup, not user interaction.** `/ev-run`'s loader step runs at the top of every session. Whatever cost we add to "load and render the rollup" is amortized across the session, but it gates everything else — first-paint of agent attention. The budget is small but not zero.
2. **The cold path is `/griot-compact`.** It runs at session compact, occasionally. A bit more work here is fine; it's not in anyone's way.
3. **The migration is a one-time cost.** Anything we spend on a migration script runs once per environment, then never again. Don't over-engineer it.

The bundle-size lens doesn't apply directly (this is Node CLI substrate, not browser code), so I'm translating those instincts to: cold-import cost, parse cost, and the "work we don't have to do" gradient. The `useMemo`-isn't-free instinct translates to "dual-read tolerance isn't free" — every branch we add to read-old-shape-OR-read-new-shape is permanent code-path complexity that gets evaluated forever for a migration that ran once.

### On the rollup.json schema and parse cost

`rollup.md` today is 234 lines, ~13 learnings + however many antipatterns, parsed by two regex passes (`/^## L-\d+\b/gm` and `/^### AP-\d+\b/gm`) and one section-extraction pass for antipattern curation. That's already sub-millisecond work. Reading L-006's framing: "Parsing a small markdown table is sub-millisecond (single-digit microseconds per parse for files under a few hundred lines), so performance is not a concern for the kind of substrate work this applies to."

That same logic cuts the other way here: **switching from md-with-regex to json-with-JSON.parse is not a performance win.** Both are sub-millisecond at this size. So the schema decision should be driven by *render correctness and downstream ergonomics*, not parse-cost. If anything, JSON.parse over a file that contains markdown-body fields means you parse twice — once for the structure, then markdown-rendering at injection time for the body fields. Net: a hair slower than today, but still in the noise.

The thing that *does* matter for cost: **don't store the rendered-prose output anywhere.** The pattern should be "rollup.json is the canonical store; `bin/griot use --as=llm` renders on demand; nothing caches the rendered form." If we cache, we introduce a stale-cache invalidation problem on every `/griot-compact` write. The render is cheap enough that the right answer is "always re-render, never cache." That's both a performance call (cache invalidation is more cost than rerender) and a correctness call.

On the schema shape itself — and yielding to design-systems on the field naming — my cost-receipt is: **store `body` as markdown string, not as a structured tree.** A structured tree (sections array, bullet points as nodes) would be slower to render, larger on disk, and would force us to write a markdown→AST encoder in the compact path and an AST→markdown renderer in the use path. Two encoders is two bugs. Store the markdown verbatim; let `--as=llm` concatenate with light framing. The "JSON discipline" we get from per-field typing is real for `id`, `title`, `classification`, `promoted_date`, `origin_slug`, `rubric_criteria` (array of strings) — but the prose body is irreducible content and shouldn't be over-modeled.

### On cutover atomicity: hard cut, not dual-read

The brief asks whether dual-read tolerance (read both old and new shape during migration) is worth it. From a perf-lens angle, dual-read costs forever; the migration costs once.

Concretely: a dual-read `loadRollup()` that tries `rollup.json` then falls back to `rollup.md` adds two cold-path branches and a stat-or-read per startup. Tiny in absolute terms — but it lives in `bin/griot use --as=llm`, which runs on every session start, forever, even years after the migration is irrelevant. Compare that to a one-time conversion script run at PR-merge time: zero ongoing cost.

Same for session-notes shape. If `/griot-compact`'s routing logic dual-reads (try `state.json`, fall back to frontmatter), every compact pays that cost forever. Hard cutover is cheaper in the long run *and* eliminates an entire class of "which shape is this folder in?" bugs.

The cost-benefit landing: hard cutover wins on perf and on code-shape complexity. The argument *for* dual-read would be "the migration might fail partway and we want graceful degradation" — but that's a robustness argument, not a performance one, and PLAN.md's atomic-commit shape already addresses it (no intermediate state ever exists).

### On `bin/griot use --as=llm` render cost

This is the hottest function in the design. It runs on every `/ev-run` invocation. Some sketches of what render-time work looks like:

- Read `rollup.json` (one disk read, ~10-20KB at current size, milliseconds).
- `JSON.parse` (microseconds at this size).
- Iterate entries, emit framed markdown per entry. Probably looks a lot like the existing rollup.md format, just composed programmatically.
- Append citation contract (already a constant in `use.ts`).
- Apply antipattern top-N curation (already in `use.ts`).

The only real cost question I see: **don't introduce a markdown-AST library here.** If the body is stored as a markdown string, the renderer is a template literal — `## ${title}\n\nPromoted: ${date}\n...${body}\n\n### Rubric\n...`. No `unified` / `remark` / `mdast-util-*` dependency. Those would be 50-200KB of code load on every CLI invocation for zero benefit. Stick to string concatenation; the substrate's existing patterns (look at `use.ts:71-80` and `useVerb`'s composition shape) prove this is sufficient.

The `--as=llm` flag suggests other render modes might come later (`--as=json`, `--as=human`?). That's fine architecturally, but resist any temptation to introduce a templating engine. Each `--as=*` mode is a function that takes `{entries, antipatterns}` and returns a string. Three small functions beats one configurable renderer.

### On `/griot-load` skill body: pure pass-through

The skill is the addressable user surface. From a cost angle, the skill body should be **as close to "invoke this Bash command and inline its stdout" as possible**. The skill is loaded into context every time it's invoked; every paragraph of skill-body prose is tokens spent before the actual work happens.

If `bin/griot use --as=llm` already emits the citation contract, the rollup body, and the tier-separation note (as `use.ts` does today), then `/griot-load`'s SKILL.md doesn't need to restate any of that — just say "invoke this command, the output is self-describing, follow its instructions." That's also the cleanest contract: one source of truth for the citation rules (the CLI's output), not two (CLI output + skill body that paraphrases).

The brief asks "are there any cases where the skill should add value beyond what the CLI prints?" My answer: probably not, and if there are, push that value *into* the CLI so the next consumer (an `/ev-run` direct-Bash call) gets it too. The skill should be a thin user-invocable handle on the CLI, not a place where logic lives.

### On `/ev-run` bypassing skill composition

The brief says `/ev-run`'s rollup-loading step calls `bin/griot use --as=llm` via Bash directly, with no skill composition. Performance-wise this is the right call: skill composition has setup cost (loading the skill body into context, evaluating its frontmatter, the Skill-tool roundtrip) that direct-Bash doesn't pay. For a step that runs at session start and gates everything else, shaving that overhead matters more than the "consistency" of always going through skills.

The cost we pay for this: two consumers of the same primitive (`/ev-run` via Bash; `/griot-load` skill via user invocation). If the CLI's stdout shape ever changes, both consumers need to handle it. Mitigation: keep the CLI's stdout contract stable and tested (`use.test.ts` already exists; extend it).

### On the migration script: throwaway, but committed

`.claude/scripts/` is the right home, following the existing convention (Node 24 native TS per L-001, sibling `.test.ts`, vitest). Commit it. Run it once. The "tested and committed but never re-run" pattern is fine — the test verifies the conversion logic against fixtures, and the script is documentation of what the migration did.

**Don't** add it as a `bin/griot migrate` verb. That promotes it to a permanent surface and invites future "migrate from N to N+1" verbs accreting. Throwaway scripts belong in `.claude/scripts/`, where their throwaway-ness is structural.

On stragglers in archived session-notes: the brief notes PLAN scope is "only the live `learnings/rollup.md` migrates." From a perf lens, archived notes that nobody reads at runtime are zero ongoing cost regardless of shape. Leave them. If `/griot-compact`'s routing logic only reads from `learnings/session-notes/` (not `archived/`), archived shape is irrelevant. Verify this assumption before locking the contract.

### On the citation grep

PLAN.md flags "Likely transcript-only, but verify in P4." From a perf lens, the citation grep runs in the Stop hook — also a hot path, fires after every assistant turn. If it currently greps the transcript only (regex over the response text for `Applied: L-NNN`), the rollup-location change is irrelevant to it. The grep doesn't need to know where the rollup *lives*; it just needs to know what citation IDs look like.

The thing to verify: does any part of the citation-update logic *open* `rollup.md` to validate that L-NNN exists, or to update some count? If yes, that file-read needs to switch to `rollup.json` and JSON.parse, and we should make sure the parse is gated behind "only if a citation was actually found in the transcript" so the no-op case stays free. If no, this is a pure transcript-grep and Phase 4 doesn't touch it.

### On PR sizing: bundling is justified, but the migration script can split

I'll let skeptic carry the main argument here, but my cost-of-coupling read: the four pieces (state.json shape, rollup.json shape, /griot-compact body updates, /ev-run loader change) are genuinely atomic — there is no intermediate state where the system works, because every reader and every writer needs to agree on the format. Splitting them creates a window where `/griot-compact` writes the old shape and `/ev-run` reads the new, or vice versa.

The piece that *could* split is the **conversion script itself**. Land the conversion script first as a no-op (or land it in the same PR but with the dispatcher unchanged), run it manually pre-merge to produce the new files, then the second PR flips the readers/writers and includes the new files. This is more work for marginal gain — I'd default to "one PR" but flag it as a fork if review is choking on size.

The `/griot-load` skill is the one piece that arguably has independent value (it's a brand-new user surface), but per L-004 its invocation is session-bounded anyway, so coupling it to the format change doesn't change the cutover behavior.

### What we should measure after this lands

(Per the "measure before optimizing, but flag what to measure after" instinct.)

- **`/ev-run` session-start time delta**: time from invocation to first agent action. If `bin/griot use --as=llm`'s render time is meaningfully larger than the current `cat rollup.md` plus citation-contract append, that's a regression worth catching early. Should be in the noise but worth a one-time check.
- **`/griot-compact` write time delta**: writing JSON with a markdown body is heavier than appending to a markdown file. Probably still milliseconds, but worth a sanity check.
- **rollup.json file size**: as learnings accrue, the file grows. The antipattern top-N curation in `use.ts` handles unbounded antipattern growth; verify the equivalent capping exists for learnings if the design anticipates 100+ of them. (Current count is 13; not urgent.)

### Files that informed this perspective

- `/home/krambuhl/work/aart.camp/learnings/rollup.md` — the current rollup format and content, basis for sizing the parse-cost argument
- `/home/krambuhl/work/aart.camp/.claude/cli/verbs/griot/use.ts` — the current `griot use` verb implementation, including the citation contract constant and antipattern curation logic that need to survive the format change
- `/home/krambuhl/work/aart.camp/.claude/cli/griot.ts` — the verb dispatcher, where a new `--as=llm` flag would land in the `use` verb
- `/home/krambuhl/work/aart.camp/learnings/session-notes/2026-05-04T03-07-19-substrate-api-stability/learning.md` — sample current session-note (notable: this one is pure prose, no YAML frontmatter, suggesting the migration's "in-flight notes" scope may be smaller than the brief implies; worth confirming during contract negotiation)

### From whiteboard-react-architect

## React architect — carve-out

This Phase 4 work lives entirely in Node CLIs (`bin/griot`), skill markdown bodies (`/griot-compact`, `/griot-load`, `/ev-run`), and on-disk artifact shapes (`state.json`, `rollup.json`, `learning.md`). There is no React surface here — no components, no hooks, no `'use client'` boundary calls, no prop API to shape, no state-location ladder to walk.

The closest analogies to my lens would be:

- **`bin/griot use --as=llm` as a "render function"**: the CLI takes structured data (`rollup.json`) and renders to a target format (LLM prose). That's structurally similar to a React component that takes props and renders. But the API-shape decisions there (flag names, output format contract) are CLI ergonomics, not React-API ergonomics — design-systems owns naming consistency across griot surfaces, and that's where that pressure-test belongs.
- **`/griot-load` as a "thin wrapper component"**: the question of "how much synthesis vs pure pass-through" rhymes with the React question of "is this component pulling its weight or should it just be the underlying primitive?" But the answer space here is skill-architecture, not React-architecture — the addressable-user-surface argument is about command discoverability and the two-axis skill rubric, not about composition vs configuration in a component tree.

If a future phase introduces a React surface for browsing learnings (a griot dashboard, an in-app rollup viewer, anything that renders `rollup.json` in the browser rather than piping it to an LLM), that's where my lens activates — schema shape of `rollup.json` would matter for client/server-component boundaries and for whether the data shape suits hook composition. None of that is in Phase 4 scope.

**Carving out.** Deferring this whiteboard section to design-systems (schema/naming), performance (parse cost, render cost, migration perf), and skeptic (atomic cutover, PR bundling, L-004 split). No relevant file paths to share from the React-API lens for this phase.

### From whiteboard-skeptic

# Skeptic — Phase 4 Pressure Test

Let me sit with this for a beat before I press on anything. Phase 4 is a substrate restructure that touches three formats (session-notes shape, rollup format, skill body) plus a migration plus a new skill plus an `/ev-run` loader change, all coupled, all in one PR. The carve-out framing is right — a11y, React, and sketch-ideation have nothing to grab onto here. This is plumbing, and the plumbing is load-bearing because *every future session* loads `rollup.json` at start and *every future learning* gets written through the new `state.json` path. The blast radius if a corner of this goes wrong is "the next session can't load its memory" or "the next captured learning can't be promoted," which are the kinds of bugs that get noticed late and hurt the trust in the whole substrate.

So: not a "don't ship" pressure test. A "let's make sure the consensus on these six open questions isn't false consensus" pressure test. I'll pick the four I think have real probability and real impact, and pass cleanly on the rest.

---

## Finding 1: The atomic-cutover framing is hiding a recovery question, not just a transition question

The PLAN.md framing of cutover atomicity asks "single commit vs transitional dual-read." That's the wrong axis to optimize on. The real axis is: **what happens when a session is mid-flight across the merge boundary?**

Concretely. Imagine I have a session that started Monday morning. `/ev-run` loaded `rollup.md` at session start (old format). Mid-session, I `git pull` to grab a coworker's PR (in a multi-author repo this is rare, but this is your own substrate, so substitute: I rebase my working branch onto main, which now has Phase 4 merged). My in-memory session state still thinks rollup is prose. The next `/griot-compact` invocation in this session reads `state.json` it didn't expect to find, or worse, writes to `rollup.md` (old writer logic still in transcript-loaded skill body) while the file on disk is now `rollup.json`.

The atomic-cutover-in-one-commit guarantees the *repository* never has an intermediate state. It does not guarantee a *running session's loaded skill body* matches the on-disk format. Skills are loaded into context once; the transcript carries the old body even after the file changes.

This isn't a hypothetical — it's the L-004 session-boundary rule applied in reverse. L-004 says "the session that authored a skill can't invoke it." The dual of that is "a session that loaded the old skill body can't safely invoke against new on-disk state."

**Concrete remedy options, ranked by my preference:**

1. *(preferred)* Make `bin/griot capture` and `/griot-compact`'s file-reading paths **detect format and refuse loudly**. If `capture` sees a `learning.md` with YAML frontmatter (old shape) it errors with "session predates Phase 4 cutover; restart session to pick up new skill body." If `/griot-compact` sees `rollup.md` instead of `rollup.json` it does the same. The cost of dual-detect-and-error is one branch in each entry point; the benefit is that the failure mode is a clear error message instead of silent corruption.
2. The dual-read tolerance window the PLAN.md asks about. I think this is *worse* than option 1, because dual-read code paths are the kind of debt that doesn't get cleaned up. Phase 3 followup 2 just landed; a Phase 4 followup to "remove the dual-read fallback" is the kind of thing that lives on the todo list forever.
3. Do nothing and trust that you'll just `/clear` between merges. This is probably what'll actually happen in practice. The question is whether the failure-mode-when-you-forget is acceptable.

I'd push for option 1. The unit contract for D1 (session-notes) and D2 (rollup) should both name the format-detection error path as in-scope.

---

## Finding 2: rollup.json schema discipline vs prose round-trip — the framing is a false dichotomy

The open question framed this as "per-field typing vs faithful markdown round-trip" — implying you have to pick. You don't. The honest answer is: **the prose narrative IS one of the fields**, and the schema discipline lives in the other fields.

What I'd want the schema to look like, concretely:

```
{
  "id": "L-042",
  "title": "Don't hand-edit PLAN.md",
  "classification": "feedback" | "skill-correction" | "decision-pin" | ...,
  "promoted_date": "2026-04-12",
  "origin_slug": "2026-04-12-c-plan-md-handedit",
  "body_md": "...full markdown prose, including any rubric criteria, examples, ...",
  "rubric_criteria": ["criterion 1", "criterion 2"]  // optional, only if structured
}
```

The `body_md` field is just a string containing markdown. The render-at-injection-time step (`bin/griot use --as=llm`) concatenates the body_md fields with section headers derived from title + classification. Schema discipline on the structured fields, prose freedom in `body_md`.

The risk I'd flag here is **the temptation to over-structure `body_md` into sub-fields**. Someone in a future PR will look at `rollup.json` and think "we should split body_md into `summary`, `details`, `example`." Don't. That's the path to schema churn and breaking every existing entry on each refinement. The current `rollup.md` content is human-written narrative; let it stay narrative.

**Concrete remedy**: the D2 unit contract should name `body_md: string` (markdown content) as a load-bearing decision and explicitly state that further structuring of body content is out of scope for Phase 4 and would require its own design pass. This is the kind of "API choice that gets locked in by consumers" I want named in the contract so a future PR doesn't drift it.

The second concern in this finding is **what happens to rubric_criteria for entries that don't have rubric structure?** The current rollup.md is mixed — some entries have rubric blocks, some don't. If the field is optional, the JSON parser handles it fine, but the LLM render step has to decide: do entries without rubrics render differently, or is the rubric section just omitted? Name the rendering contract in D2.

---

## Finding 3: The bundling-into-one-PR call is wrong, and the split-line is visible

PLAN.md says "One PR" for Phase 4. CLAUDE.md says "one conceptual change per PR." The bundling argument is "tight coupling — you can't ship rollup.json without the writer + reader + migration." I want to pressure-test that.

Here's the dependency graph as I read it:

- **D1 (session-notes shape)**: changes `bin/griot capture` writer + `/griot-compact` reader + adds migration for in-flight session-notes folders.
- **D2 (rollup format)**: changes `/griot-compact` writer + adds `bin/griot use --as=llm` renderer + adds `/griot-load` skill + changes `/ev-run` loader-step + adds one-time rollup.md→rollup.json migration.
- **D3 (`/griot-compact` body updates)**: routing reads state.json; promotion writes to rollup.json.

D3 is the dependency point. D1 and D2 each require a corresponding update to `/griot-compact`'s body. That's why PLAN.md bundled.

But notice: **D1 and D2 are independent of each other.** D1 is about how new captures are written and stored. D2 is about how the rollup gets read at session-start and written at promotion-time. The only thing coupling them is "/griot-compact touches both," but `/griot-compact` is a skill body — it can absorb a D1 update and a D2 update as two separate sections of its routing logic, in two separate PRs.

**The clean split:**

- **PR 4a (D1 only)**: session-notes shape change. `bin/griot capture` writes state.json + body MDs. `/griot-compact` routing logic reads state.json instead of YAML frontmatter. Migration script for in-flight notes. `rollup.md` still exists and still gets written to in the old prose format. This PR is small and self-contained.
- **PR 4b (D2 only)**: rollup format change. `rollup.json` introduced. `bin/griot use --as=llm` renderer. `/griot-load` skill. `/ev-run` loader-step changes. Migration script for rollup.md → rollup.json. `/griot-compact` promotion logic switches its write target from `rollup.md` to `rollup.json`. This PR depends on 4a having merged so the state.json read path is already in place when /griot-compact's promotion logic runs against the new format.

The split-line is at the **/griot-compact body**, which absorbs changes from both PRs. That's fine — `/griot-compact` is a single file with multiple sections; touching it twice in two PRs is normal.

The argument for bundling was "you can't ship rollup.json without also updating /griot-compact's writer and /ev-run's reader and the migration." That's true *within D2*. It's not true across D1 and D2. PLAN.md conflated "D2's parts are coupled" with "D1 and D2 are coupled."

**Concrete remedy**: split the phase-4 deliverable into 4a and 4b. The unit-contract author for D1 should write a contract that's mergeable independently of D2. D2's contract can name 4a as a prerequisite. This also makes review easier — 4a is "session-notes get a sidecar" which is one clear conceptual change; 4b is "rollup is now machine format with a render-at-injection step" which is another.

The bonus: if 4b reveals a problem with the rollup schema (Finding 2 territory), 4a is already merged and not at risk.

---

## Finding 4: L-004 implication for /griot-load is not "deferred to next session" — it's "the authoring session can't test the loader path end-to-end"

The open question framed L-004 as: "/ev-run is the consumer, /ev-run runs at session start, so the first invocation of /griot-load is naturally in the next session anyway." That's almost right, and the "almost" matters.

L-004 says the authoring session can't *invoke* the skill. But the authoring session *can and should* test the underlying machinery: `bin/griot use --as=llm` should work end-to-end in the authoring session, even though `/griot-load` itself can't be invoked. The risk is that the authoring engineer says "L-004 means I can't test this, ship it" and skips the bash-level verification that the renderer actually produces the right output.

**Concrete remedy**: the D2 unit contract should explicitly carve out:

1. `bin/griot use --as=llm rollup` must be invocable and tested in the authoring session (it's a CLI command, not a skill — L-004 doesn't apply).
2. `/griot-load` skill body is authored but its first end-to-end invocation is deferred to the next session.
3. The skill body itself should be near-trivial wrapper (per the open question's "trivial wrapper" framing) — *because* it can't be tested in the authoring session, the less logic in the skill body, the lower the risk that an untested bug ships.

That last point answers the "how much synthesis vs pure pass-through" question directly: **pure pass-through, because L-004 means you can't pressure-test synthesis logic in the authoring session.** The skill body should be: invoke `bin/griot use --as=llm rollup`, return the output, period. Any synthesis goes in the CLI, where it can be tested with a normal bash invocation.

This also has a naming-architecture consequence (design-systems territory, but worth flagging from skeptic angle): if `/griot-load` is a pure wrapper, why does it exist as a skill at all? The answer is "user-invocable surface area" — a user can type `/griot-load` to refresh their rollup mid-session without having to remember the bash command. That's a real reason. But the skill body should be honest about being a wrapper; don't add synthesis logic to justify the skill's existence.

---

## Passes (clean)

- **Migration script lifecycle** — design-systems and performance can handle this. I don't have a sharper concern than "put it in `.claude/scripts/`, test it, commit it, run it once at PR-merge time, and don't delete it because future archaeology will want it." If there's an archived-project straggler concern, it'd want a scoped read of `learnings/` first to verify scope.
- **Stop-hook citation grep** — PLAN.md says "likely transcript-only, but verify in P4." That's a verification task, not a design question. I'd flag that the verification has to actually happen before the PR merges, not as a "we'll check after," but I don't have a concern beyond "do the verification."

---

## Summary of where the unit contracts should cite this section

- **D1 (session-notes shape)**: cite Finding 1 (format-detection error path) and Finding 3 (D1 is PR 4a, mergeable independent of D2).
- **D2 (rollup format)**: cite Finding 1 (format-detection error path), Finding 2 (body_md as markdown string, out-of-scope further structuring), Finding 3 (D2 is PR 4b, depends on 4a), Finding 4 (pure pass-through skill body, CLI-level testing).
- **D3 (/griot-compact body updates)**: absorbed across PR 4a and PR 4b per Finding 3; no standalone contract needed.

No relevant file paths were read for this contribution — this was pure pressure-testing of the brief's design questions against the substrate context already in the prompt.

### From whiteboard-sketch-ideation

This is substrate plumbing — Node CLIs, skill markdown, griot's internal state shape, rollup format migration. None of it touches `sketches/`, the `<Sketch>` wrapper, `registry.ts`, the sketch-page shell, or the gallery's framing of sketches as a collection.

Carving out. Deferring to design-systems on schema/naming consistency across griot artifacts, performance on the rollup parse cost and migration script, and skeptic on the atomic-cutover and PR-bundling pressure-tests.

No relevant file paths from the sketch lens.

