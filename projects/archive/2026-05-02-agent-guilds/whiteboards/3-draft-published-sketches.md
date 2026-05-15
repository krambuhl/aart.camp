# Whiteboard: Should aart.camp adopt a draft/published distinction for sketches?

## Round 1

### From whiteboard-react-architect

Good — I have the picture now. Both `app/page.tsx` and `app/sketch/[slug]/page.tsx` are server components that consume `registry` directly. The sketch component itself is the only `'use client'` boundary (via `dynamic()` inside the registry). That's already a clean architecture, and it's the lens I want to bring to this question.

## My take: yes, but the shape matters a lot

The architectural cost of a draft flag is genuinely low here, and the alternatives are worse than they look. Let me walk through the reasoning, then propose a shape.

### Why I lean yes (from the React-API angle)

The sketch authoring loop is: copy a file, iterate in `npm run dev`, decide it's done, commit. The "iterate in dev" step has a real friction point today — to run the sketch in dev, you either:

1. Add it to `registry.ts` (and now it's "published" the moment you push), or
2. Hit the file path directly somehow, which doesn't work because the page shell (`PageHeader`, metadata, layout) is wired through the registry.

So today, the registry isn't just "what's public" — it's also "what's runnable in the dev shell." Those are two different concerns wearing the same hat. That's the architectural smell. The proposal is really *separating the registry's two jobs*, and once you say it that way, it's hard to argue against.

A draft flag isn't adding a concept — it's surfacing one that already exists implicitly (the gap between "I'm working on this" and "I'm publishing this"), and which today is handled by *not committing the registry entry*. Which means the file lives on disk, isn't reachable via the page shell, and the author has to either keep an uncommitted diff or comment things out. That's the kind of workflow tax that turns into "I'll just publish it half-baked."

### The shape I'd advocate for

Keep the registry as a single flat list — but extend the entry type:

```ts
interface SketchEntry {
  slug: string;
  meta: { title: string; date: string };
  component: React.ComponentType;
  draft?: boolean;  // optional, defaults to false/published
}
```

Then derive two views from it, co-located with the registry:

```ts
export const publishedSketches = registry.filter((s) => !s.draft);
export const allSketches = registry; // dev-only consumers
```

The two pages then read different views:

- `app/page.tsx` (the gallery) reads `publishedSketches`. Always. In dev and in prod. The gallery is the public face — drafts don't belong there, even locally, because that's how you accidentally ship one.
- `app/sketch/[slug]/page.tsx`'s `generateStaticParams` reads `publishedSketches`. This is the load-bearing bit: drafts do not produce static pages at build time, so they cannot ship to prod even if a stale CDN cache or a typo'd link points at them.
- `generateStaticParams` reading `publishedSketches` means in production, hitting `/sketch/<draft-slug>` returns the 404 (via `notFound()` on the unknown-slug branch), because no static page was generated.
- In dev, Next.js doesn't pre-generate — it renders on demand. So the `registry.find()` in the page component will still resolve a draft slug in dev as long as the `find` is reading the full `registry`, not the filtered list. That's the one place I'd want the page component to consume `registry` (the full list) so dev-mode "type the URL directly" still works for the author.

That last bit is the cute part: the gallery is filtered, the build-time params are filtered, but the runtime lookup is unfiltered — and the net behavior is "drafts work in dev, drafts 404 in prod, drafts never appear in the gallery." No environment branching in component code. The filtering does the work.

### Why I'd resist the alternatives

A few shapes I'd push back on if they came up:

- **Separate `drafts.ts` registry.** Tempting (it physically separates concerns), but it splits the source of truth and creates the "what list does this consumer read?" question at every callsite. The `draft: true` flag keeps the registry as a single ordered list, which preserves the chronological-numbering invariant — drafts still get their permanent number when they're created, they just don't show up until they're ready. That matters because the number is the slug, and you don't want to renumber on publish.
- **Environment-gated rendering (`if (process.env.NODE_ENV === 'development')`)** scattered through components. This is the path of "implicit effects on prop change" from my perspective list — it makes the component's behavior depend on a non-obvious global. The filtered-list-at-the-data-layer approach keeps components pure: they render whatever they're handed, and the filtering happens once at the data boundary.
- **A `'use client'` boundary that knows about draft state.** No. The draft distinction is build-time/server-time metadata. It should never reach a client component, because it's not user-facing state — it's authoring state. Keeping the filter in the server-rendered parents (`app/page.tsx`, `generateStaticParams`) keeps the client bundle untouched.

### One thing I'd flag for the design-systems sibling

The naming question is real and not mine to land. `draft: true` reads fine to me as an engineer, but the design-systems lens might prefer something more semantic to the actual concept here — `unlisted`, `wip`, `private`, `unpublished`. There's a meaningful distinction between "this is a draft I'm still working on" and "this is finished but I'm not ready to publish it" — those could be the same flag or two flags depending on whether the author cares. I'd defer to design-systems on the word, but I'd lobby for *one* flag, not two, unless there's a concrete second use case.

### One thing I'd flag for the skeptic

The honest pressure-test on this proposal is: does the author actually need it? Today the workflow is "commit when done." If that's working, a draft flag is solving a problem nobody has. The case for it lives or dies on whether there's an actual unfinished-sketch-in-progress pain point, or whether this is speculative infrastructure. I lean yes because the registry-as-runner / registry-as-publisher conflation is a real architectural smell regardless of whether anyone's hitting it right now — but the skeptic should push on "is this worth building today vs. when the first half-finished sketch wants to live in the repo."

### From whiteboard-design-systems

Acknowledged — I've read the project CLAUDE.md and will hold its framing ("this is a creative coding playground, not production software; good enough is good enough; sketches are stable infrastructure-adjacent") as the backdrop for my section.

---

The question reads like a product/CMS question, but underneath it's really a naming-and-vocabulary question — what does an entry in `sketches/registry.ts` *mean*? — and that puts it squarely in my lane. I'll lead there, defer where it stops being mine.

The instinct to reach for "draft" / "published" worries me, and I want to say why before saying what I'd do instead. Those words come from CMS-land — WordPress, Contentful, Sanity. They imply a workflow: an editorial pipeline, a review step, a staging environment, eventually a "publish" button. aart.camp has none of that. It has a developer with a text editor, a registry file, and a git branch. Importing CMS vocabulary into a single-author static site smuggles in a mental model that doesn't fit the substrate. The literal-vs-semantic test I usually apply to colors applies here too: "draft" describes a *state in someone else's workflow*, not what the thing actually IS in this codebase. A so-called "draft" sketch on aart.camp isn't a draft in the CMS sense — it's an *unlisted* sketch, or a *work-in-progress*, or an *experiment*. Those words mean different things, and the difference matters.

What is actually being asked for, semantically? I count at least three things hiding under "draft" that the proposal collapses together:

1. **"I'm still iterating on this — don't put it in the gallery yet, but let me hit it at a dev URL."** That's a *visibility* concern. The sketch exists, it's just not surfaced.
2. **"This is an experiment I might never finish — it shouldn't claim a permanent numbered slot."** That's a *commitment* concern. Adding to the numbered registry is a statement that this thing is part of the canon.
3. **"I want to share this with one person to get feedback, but not publish it broadly."** That's an *audience* concern, and it's the one that most closely maps to "draft" in CMS-speak — and I'd argue aart.camp doesn't actually need it.

Conflating these under one boolean (`draft: true`) is exactly the prop-matrix smell. The clean move is to ask which of the three you actually have, and name *that*.

If it's #1 — the iteration case — I'd lean toward a separate space rather than a flag on the registry. The vocabulary already exists in the codebase, sort of: `sketches/` is the canon, and a sibling concept like `sketches-wip/` (or a `wip/` subfolder, or a separate `wipRegistry`) cleanly separates "in the gallery, permanent URL, numbered" from "I'm playing with this." The dev server can mount both; the build only emits the canon. The numbered convention stays sacred — a number is a commitment — and the playground gets its own room. This composes with the existing model instead of bolting a state machine onto it.

If it's #2 — the commitment case — the answer is even simpler: *don't add it to the registry yet*. The registry IS the publish step. The proposal is essentially asking "can registry membership mean two different things now?" and my pushback is: it already means one clear thing, please don't dilute it. The current model is honest. Adding `draft: true` makes registry membership ambiguous — "is this in the gallery? depends on a flag" — and now every consumer of the registry has to learn the flag. `app/sketch/[slug]/page.tsx`, the gallery, the sitemap, any future RSS feed, any link checker. The cost compounds.

If it's #3 — the audience case — that's the one the proposal seems to be reaching for, and I'd push back hardest here. aart.camp is a personal portfolio. The "share with one person" workflow is `npm run dev` plus a screenshare, or a Vercel preview deploy on a branch, or "look at my screen." Building a draft/published distinction into the data model to serve that workflow is a lot of permanent surface area for an occasional need that other tools already handle.

On naming, if some version of this does ship: please not `draft` and `published`. Those words carry a workflow connotation that misleads the next reader (or the next agent). If the distinction is "appears in the public gallery vs. not," the semantic name is something like `listed` / `unlisted` (YouTube's vocabulary, which fits a portfolio-of-works model far better than CMS vocabulary). If the distinction is "finished vs. in-progress," then `status: 'wip' | 'final'` is honest. Pick the word that matches the actual semantic and the implementation reveals itself — `unlisted` implies "filter out of the gallery list," `wip` implies "this is an artifact about completeness, not visibility." They look similar but they're not the same thing, and choosing carelessly between them now means living with the wrong word forever.

One smaller note in my lane: whatever shape this takes, the registry's `SketchEntry` type is the contract. If a flag is added, it should be a discriminated union or a clearly optional field with a defaulted meaning, not a boolean that quietly changes how every downstream consumer behaves. The current `SketchEntry` is beautifully minimal — `slug`, `meta`, `component`. Three fields, each load-bearing, none ambiguous. Adding a fourth needs to clear a higher bar than "it'd be convenient."

**What I'd want the next round to resolve:**

- Which of the three needs above is actually driving this? If it's #1, the WIP folder approach probably wins on simplicity-per-feature. If it's #2, the answer is "the system already works, don't change it." If it's #3, I'd want to hear why preview deploys aren't enough.
- I defer to `whiteboard-react-architect` on the registry-API shape question — whether this is best expressed as a field on `SketchEntry`, a separate registry, or a folder-level convention is a call-site readability question as much as a naming one.
- I defer to `whiteboard-skeptic` on whether this is a problem worth solving at all on a single-author portfolio. The CLAUDE.md line "good enough is good enough" is doing real work here.

### From whiteboard-performance

Got the lay of the land. Here is my section.

---

## Performance perspective

Yes — and the performance receipt is the cleanest argument *for* a draft distinction, not against it. Let me walk through why, and what shape minimizes cost.

### The current cost shape

Every entry in `registry.ts` is a `dynamic(() => import('./N-name'))` import. Three things follow from that:

1. **`generateStaticParams` in `app/sketch/[slug]/page.tsx` iterates `registry` directly** and builds a static page per entry at build time. Today that is `registry.length` HTML files (currently 53 sketches). A draft sketch added to the registry today ships a build artifact, a URL, and (because the homepage maps the same array) a gallery row.
2. **The homepage in `app/page.tsx` is server-rendered and maps `registry` into `FileListing`** — so every registry entry is also a gallery row. There is no filter step.
3. **The dynamic imports are referenced statically in the registry file**, which means Next's build sees them as reachable chunks. Each one is code-split into its own chunk (good — that part is already lean), but they're all enumerated in the module graph from the registry's perspective. Adding a sketch to the registry adds a chunk to the build manifest regardless of whether it's gated.

So the question "does a draft distinction add cost?" inverts to "does it *remove* cost?" — and the answer is yes, modestly, in three places:

- One fewer static page per draft (HTML + RSC payload per sketch route).
- One fewer gallery row rendered (negligible per row, but it's user-facing noise, not just bytes).
- One fewer reachable chunk in the build graph if the draft is gated *before* the `dynamic()` reference exists in the production registry.

That last one is the lever. The rest are rounding error.

### The shape I'd reach for

There are roughly three shapes a draft mechanism can take, in order of increasing leanness:

**Shape A — runtime flag on the registry entry.** Add `draft?: boolean` to `SketchEntry`. `generateStaticParams` filters it out; `app/page.tsx` filters it out. The dynamic import still sits in the registry array.

- Pro: trivially small diff. One field, two filter calls.
- Con: the chunk still exists in the production bundle graph. Anyone who knows the slug pattern can hit `/sketch/53-tsuru-draft` directly — and because the route file does `registry.find(...)`, you'd need a second filter inside `SketchPage` to `notFound()` on drafts, otherwise the page renders. Easy to forget.
- Cost receipt: ~zero added bytes, ~one chunk per draft still ships to production, slightly more conditional logic in three places.

**Shape B — split-array registry.** `registry.ts` exports `publishedRegistry` (used everywhere today) and `draftRegistry` (used only in a dev-only listing page, or just left unused in production). Drafts live in a separate array.

- Pro: the production code paths only ever see `publishedRegistry`. `generateStaticParams`, the gallery, and `SketchPage` all get the safe set by default — no filter step to forget. The "what's public" answer is structurally enforced, not policy-enforced.
- Con: the dynamic import lines for drafts still exist in the file, so the chunks are still in the build graph. Mild registry-file bloat.
- Cost receipt: same chunk cost as Shape A, but the contract is harder to misuse. This is what I'd lean toward.

**Shape C — environment-gated registry.** The draft entries are wrapped such that `process.env.NODE_ENV === 'development'` (or a `NEXT_PUBLIC_SHOW_DRAFTS` flag) is the only condition under which they get added to the array. In production builds, drafts genuinely don't exist in the module graph — the `dynamic()` calls aren't referenced, so the chunks aren't emitted.

- Pro: maximum leanness. Drafts cost literally zero in production. The dev experience (working on a draft locally) is unchanged because `npm run dev` resolves the dev branch.
- Con: more cognitive overhead in the registry file. Conditional shapes are slightly harder to read than flat arrays. Need to be careful that the conditional doesn't accidentally do work at module-eval time on the server.
- Cost receipt: zero production cost. Best for the bundle, worst for registry readability.

### My recommendation

**Shape B, possibly evolving to Shape C if drafts become common.**

The reasoning: the cost difference between A and B is essentially nothing at the bytes level, but the *correctness* gain is real — splitting the array means the default code paths can't accidentally render a draft. That matters more than the chunk savings.

C is appealing for "drafts cost zero" but it's premature optimization for a portfolio site that currently has zero drafts and adds maybe a handful per year. The per-draft chunk is small (each sketch is a few KB of p5 setup/draw code, code-split into its own lazy chunk that nothing references from the published paths). I'd revisit C if drafts ever pile up to ~10+ at once or if a draft accidentally pulled in a heavy shared dep.

### Things I'd flag regardless of shape

- **The `SketchPage` route handler needs to also reject drafts** by slug, not just the gallery. Otherwise the URL is still reachable via direct navigation even if `generateStaticParams` doesn't enumerate it. In Shape B this happens for free because `registry.find` is scoped to `publishedRegistry`. In Shape A you'd need to remember the filter.
- **No bundle-size concern from the draft mechanism itself.** A `draft?: boolean` field or a second exported array is a handful of bytes at the source level and zero bytes at the runtime level (tree-shaken from any usage that doesn't reference it).
- **Worth checking the build output after the unit lands**: I'd want to confirm that draft chunks in Shape B are genuinely not in the homepage's reachable graph (they shouldn't be, since `app/page.tsx` would only import `publishedRegistry`), and that the gallery RSC payload doesn't accidentally include draft metadata.

### Deferring cleanly

The "is this even worth doing" question and the registry-shape-API question are more in `whiteboard-react-architect`'s lane — I have a slight preference for Shape B on cost-of-correctness grounds, but the composition-vs-flag tradeoff is theirs to lead. The "what does a draft URL look like for the author working on it" question (preview routes, dev-only listing page) overlaps with sketch-ideation's idioms — defer there if it comes up.

### From whiteboard-a11y

# Accessibility perspective

Honestly? This is mostly out of my lane. A draft/published flag is a content-pipeline and information-architecture question — it lives upstream of the user-facing markup I usually care about. The shipped page for a published sketch and the shipped page for a "promoted from draft" sketch will be structurally identical, and that's where my concerns actually live.

So I'll defer to react-architect on the registry shape, to performance on the build-time exclusion, and to skeptic on whether the problem is real. But I do have a few small things to surface that *would* land in my lane if this ships, and a couple that the unit contract should pin down so a11y doesn't get retrofitted in.

## The thing I want to gently flag: gallery affordance, if drafts ever leak

If the design is strictly "drafts are invisible in production, full stop," there's nothing for me to say. The public gallery sees only published sketches, the linearized read order is unchanged, screen-reader users have the same experience they have today. Clean.

But I've seen this pattern drift. The shape that often emerges is: "drafts are hidden in prod, but visible in dev." Then someone adds "...and visible in prod if you have a `?preview=1` flag." Then someone adds "...and we should show a 'draft' badge so the author knows which is which." The moment a "draft" badge exists in the rendered UI, it becomes my problem, because:

- A badge that's only a color swatch (e.g., a muted dot, or "draft" in `color: brand-muted`) without a text label fails the "color as semantic, not decoration" check. A color-blind user or a screen reader gets nothing.
- A badge that's a small icon needs an accessible name. `<DraftIcon aria-label="Draft" />` or a `<VisuallyHidden>Draft</VisuallyHidden>` companion.
- A badge that's *positioned* near a sketch card but not programmatically associated with it (sibling div rather than inside the card's labeled region) gets read in the wrong place in the linearized order — "Draft. Sketch 53. Untitled experiment." reads fine; "Sketch 53. Untitled experiment. ... Draft." (later in DOM order) reads as orphaned noise.

So: **if the design ever surfaces draft state visually, the registry entry should carry enough metadata that the badge has a text label, not just a visual cue.** That's a one-line contract addition — `status: 'draft' | 'published'` is already a text token; just make sure the rendering layer treats it as a label, not a color.

## The thing the unit contract should pin down

Two questions worth deciding explicitly at the whiteboard, even if the answer is "we'll never surface this":

1. **Does a draft sketch's URL slug exist?** If a draft sketch has `slug: 53-foo` in the registry but no static page, then anyone who guesses or shares the URL gets a 404. That's fine for most cases, but if the author is sharing dev-server URLs to get feedback ("hey check out localhost:3000/sketch/53-foo"), the recipient on the deployed site hits a 404 with no context. A 404 page that says "this sketch isn't published yet" is friendlier than a generic 404 — but that requires the 404 handler to know about drafts, which is a small contract addition. I'd lean: don't do this, keep 404s generic, accept the friction. But name the call.

2. **Does the registry's draft state affect prev/next navigation between sketches?** If sketch 52 and 54 are published but 53 is a draft, does the gallery skip 53? Does the per-sketch "next sketch" link skip 53? Almost certainly yes — drafts should be invisible end-to-end — but the contract should say so, because otherwise you get the bug where keyboard-tabbing through the gallery lands on a hidden-but-tabbable element, or the "next" link 404s. The keyboard-parity concern is: whatever the mouse-driven gallery does about drafts, the keyboard-driven path needs to do identically.

Neither of these is exotic. They're both "the design needs to decide, so the implementer isn't guessing."

## Where I defer

- **Whether to ship this at all** — skeptic's call. If the existing workflow (work in a branch, merge when done) covers the use case, the answer might be "no, just use git."
- **Registry shape** — react-architect. Whether it's `status: 'draft'`, a separate `drafts` array, a `published: boolean`, or a file-naming convention is their domain.
- **Build-time exclusion mechanics** — performance / react-architect. Whether drafts are filtered at `generateStaticParams`, at registry-import time, or via a build env var is downstream of the contract.
- **What "draft" means semantically** in tokens or component naming — design-systems if it touches the design vocabulary, which I don't think it does here.

## Summary

The a11y bar for this feature, *if it ships in the shape described* (drafts invisible in prod, no UI surface), is approximately zero — there's nothing rendered for me to worry about. The bar gets real the moment a "draft" indicator appears anywhere a user can see it, and the cheap insurance is: make sure the registry's draft-state field is text-shaped (a label, not just a flag), so any future badge has a programmatic name to lean on. Pin down the slug-exists-but-no-page question and the prev/next navigation question in the contract. Otherwise, defer.

### From whiteboard-sketch-ideation

# Sketch ideation perspective on the draft/published question

This one's squarely in my lane, and I want to push back on it pretty firmly. Not because the implementation is hard (it isn't — a `published?: boolean` on the registry entry and a filter on the gallery query is maybe twenty lines), but because I think the framing is wrong for what this site is.

## The portfolio framing is doing real work

The CLAUDE.md line — "each sketch is a finished thing" — isn't just a description, it's a constraint that shapes the kind of work that ends up here. When the only way to put a sketch into the codebase is to commit to its existence in the gallery, there's a forcing function: you don't add a sketch until it's actually a sketch. That pressure is healthy. It's the difference between a portfolio (curated, intentional, each piece earning its place) and a sketchpad (lots of half-formed things, the good ones harder to find amid the noise).

A draft state quietly inverts that pressure. The moment "in progress in the gallery but hidden" becomes a thing, the bar for landing a sketch drops, because you can always say "I'll mark it draft and come back." And in practice, those drafts accumulate. I've seen this pattern in every personal site I've ever touched: the drafts/ folder becomes a graveyard of 60%-done ideas that the author keeps meaning to finish. The portfolio framing exists precisely to prevent that.

## The local dev story doesn't need a draft flag

The proposal says drafts "would still live in the codebase (so the author can work on them in dev)." But — the codebase already supports this perfectly fine without any new concept. To work on a sketch locally, you do exactly what you do today: create the file, iterate in dev, add it to the registry when it's done. The intermediate state (file exists, not in registry) IS the draft state. It's just unceremonious about it.

If the problem the proposal is trying to solve is "I want to iterate on a sketch with the full sketch-page shell around it, not just a bare p5 canvas," that's a slightly different problem and the answer might be a dev-only route like `/sketch/_dev/<filename>` that picks up any sketch file in a `sketches/_drafts/` folder, completely outside the registry. That gives you the dev affordance without polluting the registry shape or the public/private distinction.

But honestly, I'm not even sure that's needed. The current `<Sketch>` wrapper is small enough that pointing your dev server at a working file is fine. The friction of "add the registry entry when you're ready" is appropriate friction.

## The numbered-sketch convention has opinions about this too

Here's something subtle. The chronological numbering (`53-name.tsx`, `54-name.tsx`...) is a public artifact. Once `53` exists in git history with a name, that number is spoken for. A draft system creates an awkward question: does a draft consume a number? If yes, you can end up with gaps (sketch 53 was drafted, abandoned, never published — now 54 follows 52 in the gallery, which is fine but weird). If no, then drafts need a separate naming scheme and you're maintaining two parallel conventions.

Both answers cost something. The current "no drafts" answer means the numbering only advances when something real ships, which keeps the chronology meaningful.

## What I think the underlying urge actually is

When someone asks for a draft state on a portfolio, I'd gently push on what's really being asked. Usually it's one of:

1. **"I want to start sketches without finishing them."** This is the urge to lower commitment, and I'd argue the site should resist it. The constraint is the feature.

2. **"I want to share a WIP with a friend without making it public."** A real need, but solved better by a dev-only preview link, a Vercel preview deploy, or just a screen share — not by encoding "draft" as a first-class state in the data model.

3. **"I have a sketch that's broken/embarrassing and I want to hide it."** That's a deletion or an unpublish, which is a different operation than draft. And per the URL-contract note in my lens — removing a numbered sketch breaks old links, which is a real cost worth weighing case by case rather than systematizing.

4. **"I want a place for experimental code that isn't a sketch yet."** That's what a `sketches/_experiments/` folder outside the registry is for, with no special infrastructure.

None of those four needs is best solved by a draft/published distinction in the registry. Each has a better, smaller-blast-radius answer.

## If the call goes the other way

If the consensus lands on "yes, add drafts," the shape I'd advocate for is the *least* invasive possible:

- Drafts live in `sketches/_drafts/` (folder-based, not flag-based), completely outside `registry.ts`.
- A dev-only route discovers them; production build excludes the entire folder.
- No number is assigned until the sketch moves into `sketches/` and gets a registry entry.
- No "draft" UI in the public gallery at all — drafts are invisible to the public site.

That keeps the registry shape clean (still one source of truth, still chronological, still "if it's here, it's public"), and treats drafts as a dev-environment scratch space rather than a published-site concept.

## Boundaries

The gallery framing question (how this affects the presentation of the sketch collection) — I lead on that and the answer above is mine. The registry-shape question, if drafts do get added, brushes against react-architect's lane for the data model and design-systems' lane for the gallery chrome; I'd defer on those specifics. The "do drafts need different URL handling" question is partly an a11y/SEO concern (don't want hidden pages crawlable) which I'd flag to a11y and performance.

## TL;DR

My push: don't add this. The portfolio framing — "if it's in the registry, it's finished and public" — is one of the things that makes this site feel intentional, and a draft state would erode it for a benefit that's better served by a `_drafts/` folder outside the registry entirely. If the team really wants the affordance, do the folder-based version, not a flag in the registry.

### From whiteboard-skeptic

Now I have enough to pressure-test concretely. The registry is touched in four places, and the SketchLayout's prev/next navigation reads off `registry` by index — which is the buried risk the affirmative answer needs to reckon with.

---

The other engineers are likely to converge on "yes, add a `draft: true` flag, filter in the gallery and `generateStaticParams`, done." That's a clean two-line shape. I want to pressure-test three things that won't surface on the affirmative reading.

**1. The prev/next navigation lives inside the same array the draft flag would filter.** Look at `app/sketch/[slug]/layout.tsx:14-22` — `SketchLayout` does `registry.findIndex` and walks `registry[idx - 1]` / `registry[idx + 1]` to build the footer. If a draft is filtered out of `generateStaticParams` (so it gets no static page) but the *layout* still sees the full registry, the indexing is harmless. But if a future engineer (correctly noticing "drafts shouldn't show up in nav") filters the registry array itself at the import site, the chronological neighbors of a sketch that sits next to a draft will silently change. That's the exact failure mode of a flag prop creeping into half the codebase: each consumer has to remember which view of "the registry" it wants. The remedy is concrete — don't add a flag to the entry, expose two derived arrays from `sketches/registry.ts`: `registry` (everything, used by the route layer for dev/preview) and `publishedSketches` (the filtered gallery view). One source, two named views, no flag-branching at call sites. If the affirmative is going to win, this is the shape it should take.

**2. "Drafts still live in the codebase but don't generate static pages" has a subtle dev/prod asymmetry.** In dev, the draft is reachable at `/sketch/53-wip` because Next renders it on demand. In prod, `generateStaticParams` omits it, so the route 404s. That's fine — *until* the author shares a dev URL with someone, or bookmarks one and forgets it's draft-only, or (more realistically) deploys a preview branch to Vercel and finds the preview also 404s because SSG only emitted the published set. The remedy: be explicit about which environment a draft is viewable in. The simplest contract is "drafts are visible in `npm run dev` only, never in any deployed build." If preview-link sharing for drafts is desired, that's a different feature (a `?preview=token` query param, or an env-gated build flag) and shouldn't ride along on this change. Name what's in scope.

**3. The numbering convention does work the draft flag would partly undo.** `NN-name.tsx` is chronological *and* the slug *and* the registry order. Today, "the number was assigned" is functionally synonymous with "this is published" — that's why the project gets away with no draft concept. The moment you can hold slot `63-experiment.tsx` as a draft for two weeks while shipping `64-other-thing.tsx`, the number stops meaning "chronological order of publication" and starts meaning "chronological order of *starting*." That's a small thing, but it's a semantic shift in the only metadata the system has, and per CLAUDE.md "naming is architecture." The honest compounding-debt question: is the author okay with numbers no longer corresponding to publish order? If yes, fine, but call it out in the registry's contract so the next person doesn't re-derive the old assumption. If no, then drafts should sit in an un-numbered staging area (`sketches/drafts/wip-name.tsx`, no registry entry at all) and only get their number on publish — which is closer to how the current system already works informally (don't add to the registry until done).

**My read on whether to adopt it.** This is a portfolio for one author. The current "don't add to the registry until done" workflow already *is* a draft system — it just keeps the in-progress file out of `registry.ts`. The proposed change is solving "I want the sketch reachable at a dev URL while iterating, without committing to publish." That's a real but small need. If the answer is yes, I'd push hard for the *no-flag* shape: drafts are simply files in `sketches/drafts/` with their own dev-only route, not entries in the main registry with a `draft: true` marker. The flag-on-the-entry version invites the prev/next bug, the semantic-numbering drift, and the "every consumer of registry now has to know about drafts" tax. The directory-separation version costs nothing at the consumer sites and keeps the registry's invariant ("entries are published things") intact.

What I'd want resolved in round 2: do the architect and design-systems engineers actually want a flag, or would they also prefer the two-arrays-or-two-directories shape once the prev/next coupling is pointed out? That's the false-consensus risk worth checking.

## Round 2

### From whiteboard-react-architect

The skeptic was right — the prev/next is doing exactly the index-walk they flagged, and that's load-bearing for the page chrome on every sketch route. Here's my round 2.

---

I want to lead with the honest part: **the skeptic landed a clean hit, and I've shifted.** Reading back my round 1, I was advocating for `draft?: boolean` on `SketchEntry` with derived views (`publishedSketches` filtered out of `registry`). I framed it as "the filtering happens once at the data boundary, components stay pure." That framing is true *in isolation* for the two consumers I was thinking about — `app/page.tsx` and `generateStaticParams`. It's wrong in the codebase as it actually exists, because there's a third consumer I didn't account for, and it's the one that breaks the model.

`app/sketch/[slug]/layout.tsx:14-22` is doing `registry.findIndex(...)` and then `registry[idx - 1]` / `registry[idx + 1]` to build the prev/next footer. The prev/next nav reads positions out of the same array I was proposing to extend with a `draft` field. That means *every consumer of the registry now has to answer "which view am I supposed to read?"* The layout wants the *full* array (so positions stay stable as drafts come and go), the gallery wants the *filtered* array (so drafts don't surface), and `generateStaticParams` wants the *filtered* array (so drafts don't ship). The flag shape forces each call site to know that distinction — and worse, it forces the *next* engineer (or the next agent) to know it too, with no compiler help.

That's the prop-matrix smell turned into a data-shape smell. I argued in round 1 that "the filtering does the work" — but it only does the work if every consumer reaches for the right derived view, and there's nothing structural preventing them from grabbing `registry` and walking it by index. The minute someone correctly thinks "drafts shouldn't appear in nav" and filters at the layout, the chronological neighbors of any sketch adjacent to a draft silently shift. That's the bug that's hard to even see in review.

### The shape I'd advocate for now: folder-based, no flag

I'm landing where the skeptic, sketch-ideation, and design-systems landed: **drafts are a directory, not a field.** Concretely:

- `sketches/_drafts/` holds in-progress files. They are not entries in `registry.ts`. Full stop. The registry's `SketchEntry` contract stays the three-field minimum it is today — `slug`, `meta`, `component` — and registry membership keeps meaning exactly one thing: "this is in the gallery and has a permanent URL."
- A dev-only route (something like `app/sketch/_draft/[file]/page.tsx`, gated so it's a 404 in production builds) discovers files in `sketches/_drafts/` and renders them inside the same `<Area>` + `<Sketch>` shell that published sketches use. That gives the author the full page chrome while iterating, which is the actual workflow gap the original proposal was trying to close.
- No number is assigned to a draft. It's just `wip-tsuru.tsx` or whatever. The number gets picked at the moment the file moves from `_drafts/` into `sketches/` and gets a registry entry — which is when "this is part of the canon" actually becomes true. This preserves the chronological-numbering invariant the skeptic correctly pointed out my flag shape would erode.

The React-API-shape win here is that `SketchEntry`, `registry`, and every consumer of `registry` stay untouched. No new optional field that every call site has to remember to filter. No derived-views naming exercise. The `'use client'` boundary doesn't move. `generateStaticParams` doesn't change. The layout's `findIndex`/index-walk keeps working because the array it's walking is still "everything in the public gallery, in order." Zero blast radius on the existing component graph.

The cost moves into a new place — the dev-only route — but that's the right place for it. A dev-only route is *expected* to have build-time behavior that differs from prod (the whole point is "this exists in dev, not in prod"), so the asymmetry is local and named, not smuggled into a data model that's otherwise about published artifacts.

### Where this leaves the previous tensions

- **Flag vs. folder.** Folder. I was wrong to lean flag; the prev/next coupling is the receipt. Performance's Shape B (split-array registry) is the *next-best* answer if for some reason folder-separation isn't viable, but folder-separation is strictly cleaner because it doesn't even require the registry file to know drafts exist.
- **Naming (`draft`/`published` vs. `unlisted`/`listed` vs. `wip`/`final`).** Mostly moot if we go folder-based — there is no flag to name. The folder itself can carry the semantic: `sketches/_drafts/` is fine, `sketches/_wip/` is fine, and the underscore-prefix is a readable "this is meta, not content" cue. I'd defer the exact folder name to design-systems but I'd resist `_drafts` for the same CMS-vocabulary reason they raised in round 1. `_wip/` or `_experiments/` reads more honestly for what this site is.
- **Should it ship at all (sketch-ideation's pushback).** Their "constraint is the feature" argument is real, and I want to credit it: the current "don't add to the registry until done" workflow *is* already a draft system, just implicit. My round 1 architectural-smell argument ("registry-as-runner vs. registry-as-publisher") still stands as a *real* conflation, but it's only worth resolving if the author is actually hitting the friction. If they're not — if the current "iterate in dev with a bare canvas, add to registry when done" workflow is fine — then sketch-ideation is right that this is speculative infrastructure and the answer is "not yet." The folder-based shape is what I'd build *if* it ships; whether to ship it is the author's call and I'd weight sketch-ideation's pushback heavily.
- **Skeptic's direct callout on me.** Acknowledged and addressed: I'm off the flag shape. The two-derived-arrays shape they offered as a fallback is a reasonable middle path, but the folder shape is strictly better because it doesn't require the registry to model drafts at all — and the whole point of my lens is "one concept per component / one concept per data structure." `SketchEntry` should keep meaning "a published sketch."

### One small thing I'd still flag

If the folder-based shape ships, the dev-only route handler needs to share the page chrome with the real sketch route (the `<Area>` + `<Sketch>` wrapper, the `PageHeader`, etc.) without duplicating it. That's an extract-the-shell-into-a-shared-component move — probably `<SketchPageShell>` or similar — so the draft route and the real route both consume it. Otherwise the draft view drifts from the real view, the author iterates in a shell that doesn't match production, and "I'll publish it tomorrow" becomes "wait why does it look different now." That's a small refactor, not a blocker, but it's the React-API piece that belongs in scope if this ships.

### From whiteboard-design-systems

Good — I have the prior round in full. Let me think about where I sit now after reading the others.

---

I want to start by saying where I've moved, because I think I have — though not where you might expect.

**On flag vs. folder: I've hardened, not softened.** Reading react-architect's Shape A side by side with sketch-ideation's folder proposal and skeptic's "two-arrays-or-two-directories" framing, I'm now more confident that the folder shape is the right answer for this codebase specifically, and I want to say why in design-systems terms rather than just restating preference.

The registry today is a *contract*, not just a list. `SketchEntry` has three fields and each one is load-bearing — `slug`, `meta`, `component`. Every consumer (gallery, `generateStaticParams`, `SketchLayout` prev/next, any future sitemap or RSS) reads that contract and assumes the same meaning across the board: "this is a published thing, here's its name, here's how to render it." Adding a `draft?: boolean` doesn't extend the contract — it forks it. Now `SketchEntry` means *one of two things*, and every consumer has to learn which view of "registry" applies to them. That's not composition, that's configuration creeping in through a back door. Same prop-matrix smell I'd push back on in any shared component.

The folder shape (`sketches/_drafts/`, no registry entry until publish) keeps the contract honest: registry entries are still always-published, the type stays three fields, and every consumer reads the registry the way it always has. The "draft" concept doesn't enter the data model at all — it's a *filesystem location*. That's a much cleaner separation than a flag, because filesystem location is already a load-bearing axis (the `sketches/` folder *is* the canon), so we're extending an existing vocabulary instead of inventing a new one.

React-architect's Shape A is genuinely elegant on its own terms — the "filtered for build, unfiltered for dev" asymmetry is cute and would work. But it works *despite* introducing the fork, not because of it. Skeptic's prev/next observation is the receipt: the moment you have a flag, every consumer has to remember which view they want, and the prev/next bug is the first place that bites. Performance's Shape B is the same shape with a different surface — splitting the array enforces the discipline structurally, which is better than relying on policy, but it's still two named lists where today there's one.

So: I'm aligned with sketch-ideation and skeptic on shape. The folder approach has the lowest-blast-radius for the contract.

**On naming: I'm walking back "unlisted/listed" slightly, and I want to say so explicitly.**

In round 1 I floated `unlisted/listed` (YouTube vocabulary) and `wip/final` as alternatives to `draft/published`. After reading the room, I think I was solving a problem that the folder shape makes disappear. If drafts live in `sketches/_drafts/` and never enter the registry, there's no field to name — no `status`, no `draft: true`, no `published: false`. The vocabulary question evaporates because the data model doesn't have to express the distinction at all. *Where the sketch file lives* expresses it.

That's the cleanest possible answer on the naming front, and I should have seen it in round 1. I was naming a field that shouldn't exist. Credit to sketch-ideation for the folder framing — it dissolves the naming problem rather than answering it.

The one place naming still matters: the folder name itself. `_drafts/` is the proposal on the table. I'd gently push on the underscore prefix and the word "drafts" together:

- The `_` prefix is a useful convention in some ecosystems (Next.js uses it for "private folders" that aren't routed) — it signals "infrastructure, not content." That's a good fit here, because the folder is dev-affordance, not a canonical part of `sketches/`.
- "drafts" still imports the CMS connotation I pushed back on in round 1. If I'm being consistent, I should push on it here too. `_wip/`, `_scratch/`, or `_experiments/` would all carry the "this is a playground, not a publication pipeline" framing better. `_wip/` is my preference — it's short, it's honest, it doesn't pretend there's a workflow.

But I want to soften that pushback: if the folder is dev-only and never appears in any user-facing surface or in the registry's type system, the cost of the word "drafts" is much lower than it would be as a field name. The word only lives in a path on the author's filesystem. That's a much smaller surface than a `draft: true` field that propagates through the type system into every consumer. So `_drafts/` is fine, `_wip/` is slightly better, and this is a small call rather than a load-bearing one.

**On the skeptic's three-needs framing and my three-things-hiding-under-draft:**

Yes, we're converging — and I want to confirm it explicitly, because I think this is the cleanest framing the whiteboard has produced.

My three (visibility / commitment / audience) and skeptic's three (the prev/next coupling, the dev/prod asymmetry, the numbering-semantics drift) are looking at the same thing from different angles. Mine asks "what is the author actually trying to do?", skeptic's asks "what does the data model accidentally do if we add a flag?". They both land at the same answer: the proposal collapses concerns that should stay separate, and the folder shape keeps them separate because *it doesn't try to encode the distinction in the data model at all*.

Specifically:

- My **#1 (visibility — iterate at a dev URL)** = the only need the folder shape actually addresses, and it addresses it cleanly. Sketch-ideation's `_drafts/` + dev-only route is exactly this.
- My **#2 (commitment — don't claim a permanent number yet)** = skeptic's numbering-semantics concern. The folder shape solves this for free: a file in `_drafts/` doesn't have a registry entry, doesn't have a number, doesn't consume a chronological slot. The number is assigned *at the move-into-`sketches/` moment*, which preserves "the number means published-publication-order" — the exact invariant skeptic is protecting.
- My **#3 (audience — share-with-one-person)** = the need none of us think the system should serve. Preview deploys and screen shares handle it. Don't build for this.

So my round-1 framing and skeptic's round-1 framing are the same critique with different vocabularies. I'll confirm: aligned. The folder shape is the answer that respects both framings.

**Where I'd nudge react-architect:**

The "registry has two jobs — what's runnable and what's published" framing in round 1 is sharp, and I agree with the diagnosis. Where I'd push is on the prescription. The two jobs *should* be separated, but they don't have to be separated *inside the registry*. Separating them at the filesystem level — `sketches/` is the canon, `sketches/_wip/` is the runnable-but-not-published space — does the same architectural work without introducing a flag. The registry stays single-purpose (published things), and the dev-only route handles the "runnable" job for the WIP folder. That preserves what's good about the current registry contract while addressing the friction you correctly identified.

**One small design-systems concern for the implementation, if this ships:**

If a dev-only route picks up files from `sketches/_wip/`, that route needs to not pretend to be a published sketch in any way the author might confuse with reality. No `PageHeader` chrome that looks identical to the published version, or — if it does use the same chrome for fidelity-of-iteration reasons — a clear, *labeled* affordance that says "this is a WIP, not a published sketch." The risk is the same risk a11y flagged: a draft state that visually mimics a published state is a foot-gun. The label should be text, not just a color or border treatment, so it survives any future visual redesign without losing its meaning. This is the design-systems-aligned version of a11y's "make sure the badge has a label" point.

**Position check:**

- Round 1: pushed back on CMS vocabulary; proposed `unlisted/listed` or `wip/final` as alternatives; preferred folder over flag.
- Round 2: still against CMS vocabulary; *withdrawing* the field-naming alternatives because the folder shape removes the field; *strengthening* the folder preference now that skeptic's prev/next observation and performance's Shape-A-vs-B framing make the cost of a flag concrete; aligned with sketch-ideation and skeptic on shape.

If anyone still wants the flag shape after this round, the burden is on them to address the prev/next coupling, the numbering-semantics drift, and the consumer-side fork in the registry contract — three concrete costs the folder shape simply doesn't pay.

### From whiteboard-performance

Good — I have the cost surfaces I need. Now my round 2 take.

---

Round 1 me was reasoning about Shape B (split-array, both arrays in `registry.ts`) versus the strawman flag-on-entry. Sketch-ideation and design-systems put a fourth shape on the table that I didn't price out — drafts in `sketches/_drafts/` entirely outside the registry, surfaced by a dev-only route. Let me run the cost lens over that, because it changes my recommendation.

## Pricing Shape D (folder-outside-registry)

The mechanical question: where do the chunks live in the production build graph?

In Shape B, even if `publishedRegistry` is the only array imported by `app/page.tsx` and `generateStaticParams`, the *file* `sketches/registry.ts` still contains `dynamic(() => import('./_draft-foo'))` lines for any draft entries. The module evaluator sees those import expressions when it evaluates the registry module — and `app/page.tsx` imports the registry module to read `publishedRegistry`. Webpack/Turbopack will resolve and emit the chunks for those drafts even though no published code path will ever call the lazy loader. They sit in the build manifest as orphaned chunks. Small (a few KB each), but they exist.

In Shape D, there is no `dynamic(() => import('./_drafts/foo'))` anywhere in production code. The `_drafts/` folder is referenced only by a dev-only route file — and that route file can be excluded from production builds (Next.js will tree-shake an `if (process.env.NODE_ENV !== 'production') return notFound()` guard at the page-component level, but more cleanly: the route itself can live behind a build-time conditional, or the underscore-prefix can be used to signal "this is a convention but not a route"). Either way: zero production references to `_drafts/*`, zero emitted chunks, zero build-manifest entries.

So the cost ladder I drew in round 1 — A ≈ B < C for production leanness — gets a new rung. **Shape D is structurally equivalent to my Shape C (the environment-gated one) on the cost dimension, but without the readability tax I worried about.** Conditional shapes in a flat array are uncomfortable; a folder convention is just a folder convention. The file system is doing the gating, not the array constructor.

That's a meaningful update. I was reaching for Shape C as "best for the bundle, worst for readability" and trading it away. Shape D collapses that tradeoff — it gets Shape C's zero-cost production characteristic via a totally different mechanism (filesystem separation rather than conditional inclusion), and it inherits Shape B's "default code paths can't accidentally render a draft" structural property *more strongly than Shape B does*, because the draft files literally aren't in the registry module at all. Nothing to filter, nothing to forget.

## Reconciling with my round 1 recommendation

I said Shape B on cost-of-correctness grounds. I want to update that to **Shape D, if anything ships**. The argument:

- **Build graph cleanliness**: Shape D is the only shape where draft chunks genuinely don't enter the production module graph. Shape B leaves orphaned chunks. Per-draft this is rounding error (a few KB), but the property "production builds contain zero draft artifacts" is structurally clean in a way Shape B isn't.
- **No filter step anywhere**: In Shape B, the contract is "remember to read `publishedRegistry`, not `registry`." Even with derived arrays, that's a discipline tax on every future consumer (the layout, a future RSS feed, a future sitemap). In Shape D, there's only ever one registry, and it's the published set by construction. The skeptic's concern about prev/next navigation in `layout.tsx:14-22` — which reads off the full registry by index — doesn't exist in Shape D, because the full registry IS the published set.
- **Bundle delta to flag after the unit lands**: with Shape D, the prediction is "zero delta in the production bundle, zero delta in the build manifest." That's a satisfying, easy-to-verify claim. With Shape B, the prediction is "small delta proportional to the number of drafts," which is harder to notice and easier to drift on.

## The dev/preview asymmetry the skeptic raised

The skeptic flagged: drafts visible in `npm run dev` but invisible in Vercel previews is a real friction. Vercel previews run the production build, so drafts that depend on dev-only mounting won't appear there. Does that change my environment-gating call?

From my lens, no — it sharpens it. The friction is real, but the answer to it isn't "make drafts visible in previews by default," because that quietly puts draft content in front of anyone with the preview URL (link sharing, search engine crawling of preview domains, the usual). Vercel previews are production builds for a reason: they're meant to be a faithful preview of what production looks like.

If preview-link sharing for drafts is a desired feature, it should be a separate, explicit mechanism — an env-gated build (`SHOW_DRAFTS=1 vercel deploy`) or a query-param preview token. Both of those compose fine with Shape D (the dev-only route's gating condition just gets extended), and neither composes well with Shape B (you'd have to expose the full registry conditionally, which is exactly the readability tax I was trying to avoid). So Shape D's environment story is "dev: visible. preview: invisible by default, opt-in via env flag if ever needed. prod: invisible, full stop." That's a clean three-rung contract.

The skeptic's friction is genuine but I read it as an argument for explicit preview-tokens-when-needed, not for relaxing the production exclusion. Defer to the skeptic on whether that opt-in path is worth designing now or deferring entirely.

## On whether this ships at all

Sketch-ideation's "constraint is the feature" argument and react-architect's "registry-as-runner vs. registry-as-publisher smell" are the two real positions to reconcile, and they're not in my lane. But there is a cost-shaped angle worth surfacing:

**The cost of the current system, in my lens, is approximately zero.** "Don't add to the registry until done" produces no chunks, no build artifacts, no consumer-side filtering, no contract surface for future consumers to learn. Every shape on the table (A through D) is strictly more expensive than that at the build-cost level, even if the delta is small.

That doesn't settle the question — react-architect's smell-argument is about authoring ergonomics, not build cost, and I won't pretend the cost dimension dominates here. But the honest cost receipt is: today's system is the cheapest possible. Anything we add is paying for an authoring-ergonomics gain. Whether that gain is worth paying for is sketch-ideation's and skeptic's call.

If we do ship something, Shape D is the cheapest of the non-trivial shapes — meaningfully cheaper than B, which I was advocating for in round 1.

## Where I've genuinely updated

- **Round 1**: Shape B, on cost-of-correctness grounds, with C as "premature optimization."
- **Round 2**: Shape D, because the folder-based separation gives me Shape C's zero-cost production property *without* C's readability cost. I underweighted Shape D in round 1 because it came in framed as a sketch-ideation/design-systems concern; running it through the cost lens, it's also the leanest shape on the build dimension.

If the consensus lands on "ship something," I'm now in alignment with sketch-ideation and design-systems on Shape D — for cost reasons rather than the framing reasons they led with, but converging at the same shape.

### From whiteboard-a11y

Got it. The prev/next code is exactly as the skeptic described — index walking on the raw `registry` array, which makes it a load-bearing site for whichever shape we land on. Here is my round 2.

---

Short one. The skeptic and react-architect have surfaced enough that my two round-1 questions have clarified — at least to the level where I can put a stake in the ground rather than just naming them.

**On "does the draft slug exist as a URL?"** — clarified. The emerging shape (drafts reachable in `npm run dev`, 404 in prod because `generateStaticParams` omits them) is the right default from an a11y standpoint. The 404 should stay generic. I floated a "this sketch isn't published yet" friendlier 404 in round 1; on reflection, that's a leak — it would require the production 404 handler to know about the existence of draft slugs, which means draft metadata reaching prod, which is exactly what we're trying to avoid. Drop that idea. A generic 404 is the honest answer, and it's also the only answer that doesn't dilute the "drafts don't exist in prod" invariant. The skeptic's point #2 (the dev/prod asymmetry, and the trap of sharing a dev URL that 404s in prod) is real but it's an *author workflow* problem, not an a11y problem — the user landing on a 404 has the same experience either way.

**On "does prev/next skip drafts?"** — this is the one that's gotten interesting, and the skeptic was right to put a pin in it. Looking at `app/sketch/[slug]/layout.tsx:14-22`: it does `registry.findIndex` and walks `registry[idx ± 1]`. So today, *whatever array `registry` resolves to is the navigation order*. That means the answer to my round-1 question is decided by which shape wins:

- **Flag-with-derived-views (react-architect's shape).** If `SketchLayout` keeps consuming the raw `registry` (full list including drafts), then in dev a published sketch sitting next to a draft will have the draft as its prev/next neighbor — and the link will work in dev (because draft pages render on demand) but 404 in prod (because no static page). That's a broken keyboard path in prod that works in dev. Bad. The fix is to have `SketchLayout` consume `publishedSketches`, same as the gallery and `generateStaticParams`. Then drafts are invisible to prev/next end-to-end, the keyboard path matches the mouse path, and there's no dev/prod asymmetry in the *navigation* (only in whether the draft itself is reachable by direct URL). The contract addition is: **`SketchLayout` reads `publishedSketches`, not `registry`. Drafts, viewed in dev, have no prev/next footer — or have one pointing at the published neighbors (53's "prev" is 52, its "next" is 54 even if 53 is a draft sitting between them).** Either is fine for a11y; the implementer should pick one and the contract should name it.

- **Folder-separated (sketch-ideation / skeptic's shape).** This problem evaporates. Drafts aren't in the registry at all, so `SketchLayout`'s `findIndex` literally cannot land on one. The keyboard path is structurally correct by virtue of drafts not existing in the navigation array. This is the cleaner answer from my lens — fewer places for the contract to leak, fewer call sites that have to remember which view of the registry they want.

So my refined position: **either shape can be made keyboard-correct, but folder-separation gets there by construction, and flag-with-views gets there by remembering to filter at the third call site (the layout) that round-1 hadn't surfaced.** That's exactly the kind of "every consumer has to learn the flag" tax design-systems flagged in round 1 — and the layout file is concretely the third consumer (gallery, `generateStaticParams`, layout). The skeptic's prev/next observation is the receipt that the tax is already nontrivial.

**On design-systems' three-needs decomposition.** Their split (visibility / commitment / audience) helped me locate where a11y enters: it enters only if "draft state" becomes *visible* somewhere a user can perceive it. None of the three needs as decomposed actually requires that:

- Visibility-as-iteration → dev-only, no public surface, no a11y impact.
- Commitment → "don't add to registry" → no a11y impact.
- Audience-sharing → handled by preview deploys, no a11y impact.

The a11y bar stays approximately zero *as long as drafts don't render a badge or indicator anywhere a user sees it.* That's true under both shapes. My round-1 note about "if a draft badge ever ships, make sure the registry field is text-shaped, not just a boolean" still stands as a forward-looking insurance contract, but it's not blocking either shape.

**Net.** I lean folder-separation, mildly, on keyboard-parity grounds: it makes the prev/next correctness structural rather than policy. But I'd accept flag-with-views as long as the contract explicitly names *which view `SketchLayout` consumes* (`app/sketch/[slug]/layout.tsx:14`) so it doesn't become a fourth place the implementer has to remember. Deferring further on the shape itself — react-architect and the skeptic are doing that work and the a11y delta between the two has narrowed to "one extra call site that needs to remember the filter," which is their tradeoff to weigh.

### From whiteboard-sketch-ideation

Good — I have the layout file and the registry shape. Now I can write my round 2 contribution honestly.

---

## On the architect's smell

I want to take this one seriously before saying where I land, because react-architect made an argument my round-1 didn't have a clean answer to. The framing — *the registry is doing two jobs (publish AND dev-runnable) and a draft flag is just surfacing that conflation* — is a real claim, and worth chewing on.

So: is it a real architectural smell?

I think it's a real *observation* but I'm not convinced it's a smell. Here's why. The two jobs the architect names — "what's runnable in the dev shell" and "what's public" — collapse into one job in this codebase precisely because of the portfolio framing. The site's invariant is "if it's in the registry, it's a finished sketch, and finished sketches are public." That's not two concerns wearing one hat; that's one concern that the architect is reading as two because most CMS-shaped systems separate them. The registry-as-runner / registry-as-publisher distinction *exists* in WordPress and Sanity because those systems assume an editorial workflow with drafts. aart.camp's substrate assumption is that the workflow doesn't have drafts — the file system is the draft area, and registry entry is publish.

That said, I'll concede something concrete: the architect's point about *how the author actually iterates today* lands. The current workflow forces one of these:

- Add the registry entry and commit-but-don't-push (lives on a local branch),
- Add the entry and keep it uncommitted (works, but you can't shut your laptop and resume without thinking about it),
- Iterate by visiting some other shell-less URL and lose the `PageHeader` chrome.

None of those are terrible. The first one is basically how I'd actually work. But the architect isn't wrong that there's a small papercut in "the gallery shell is the right environment for tuning a sketch's framing, and the only way to get the gallery shell is to publish." That's a real, if small, observation about the substrate.

So I've shifted slightly: the smell is real but smaller than the architect framed it. It's a *workflow papercut*, not a structural concern-conflation. Different remedy bar.

## Where the architect's shape lands me

The proposed shape (one registry, optional `draft?: boolean`, three derived views with `generateStaticParams` filtering and the runtime `find` unfiltered) is technically clever — the dev/prod asymmetry falls out of Next's rendering model rather than from environment branching. I respect the elegance. But two pieces of it still bother me, and they're sketch-portfolio-flavored bothers, not architecture bothers:

**The numbering still drifts.** The skeptic flagged this in round 1 and I want to second it from my lane: once `53-tsuru` can sit in the registry as a draft for two weeks while `54-haneda-night` ships, the number stops meaning "chronological order of finishing" and starts meaning "chronological order of *starting*, with delays." The current registry (which I just re-read) is dense with sibling-numbered work: `42-robot-thought` through `52-robot-thought-11` are clearly a series that landed in close succession. That density is part of how you can read the author's working rhythm off the registry. A draft flag introduces silent gaps in that signal — not as gaps you can see (the number sequence is still contiguous in the file), but as gaps in *meaning* (date ≠ publish order anymore). I care about this because the registry as it stands is itself a kind of generative artifact — chronologically authored, you can see streaks and pauses. That's worth preserving.

**The "drafts work in dev, 404 in prod" trick is cute but it teaches the wrong mental model.** If you can hit `/sketch/53-wip` locally and it just works, you stop thinking about whether your sketch's framing is gallery-ready, because the gallery shell is just there. The friction of "to see this in context, you have to publish it" is doing curation work. Remove it and curation becomes a separate, easy-to-skip step.

So even with the architect's clean shape, the sketch-portfolio cost is real.

## On the folder-based consensus

You're right that design-systems, the skeptic, and I converged on something folder-shaped (`sketches/_drafts/`, or `sketches-wip/`, or similar — un-numbered, un-registered, dev-only route). I do think that's strictly better than the flag-on-entry version, and I'll say why in my-lane terms:

- **The numbered-sketch convention stays sacred.** A number only gets assigned at the moment of publish. Drafts use names, not numbers. That preserves what the registry's chronology means.
- **Registry entries stay unambiguous.** "If it's here, it's public, finished, numbered, permanent." No flag, no derived view confusion.
- **The substrate of "drafts are files that aren't in the registry" is preserved.** The folder version makes that existing implicit pattern explicit (here's the place for them) without changing what the registry IS.

## But — would I ship the folder version?

Here is where I want to be honest about whether I've updated. **I have not updated to "yes, build the folder version now."** I've updated to "if the team is going to build something, the folder version is the right shape." Those are different positions and I want to name the difference.

The reasons I'd still not build it today:

1. **Nobody has named a real in-progress sketch that needs this.** Across the conversation, the use case has stayed abstract ("when the author has a WIP..."). The current `sketches/` folder has 53 sketches in it and zero un-registered files lying around. The pain isn't observed; it's anticipated. CLAUDE.md's "good enough is good enough" cuts directly against anticipated infrastructure.

2. **A `_drafts/` folder with a dev-only route is small but not zero.** It needs: a folder convention, a dev-only route handler (`app/sketch/_dev/[filename]/page.tsx` or similar), a way to skip those files in the build, a decision about whether `_drafts/` shows up in the gallery shell or in a separate dev index, and a CLAUDE.md update so the convention is documented for next-time-you. That's maybe a day of work for an unverified need.

3. **The "appropriate friction" argument is unchanged.** When you have to add the registry entry to see your sketch with its title and date and `PageHeader`, that's a small but consistent prompt: *is this thing actually ready to claim a number and a title?* That prompt has shaped this site's collection toward intentionality. Removing it — even just into a separate `_drafts/` folder — relaxes that prompt by a meaningful amount.

So my position is: **don't ship at all unless and until the author hits the papercut concretely**, AND if you do, **the folder version is the right shape**. Those aren't contradictory; they're the two halves of a "wait, then if needed, do the smallest thing" answer.

## On a11y's prev/next concern

This is the part of the panel I want to amplify, because it sharpens my position. a11y asked: if `53` is a draft and `52`/`54` are published, does prev/next skip `53`? Looking at `app/sketch/[slug]/layout.tsx:14-22`, the prev/next is literally `registry[idx - 1]` / `registry[idx + 1]` — index-based against the array order.

There are only two correct behaviors:
- The layout reads `publishedSketches` (filtered), so prev/next walks only published — and a draft sketch viewed in dev has *no neighbors at all*, or wrong neighbors (it'd find itself in the unfiltered array but its neighbors-in-the-filtered-view don't include it).
- The layout reads `registry` (unfiltered) and prev/next can land on a draft slug, which then 404s in prod (because `generateStaticParams` doesn't emit it).

Either way you have to think about it, and both options have a "huh, that's subtle" flavor. The folder-based approach sidesteps this entirely — drafts aren't in the registry at all, so prev/next has nothing to reason about. That's a real point in the folder shape's favor that the architect's flag-shape doesn't get.

The a11y framing of this (keyboard navigation parity, no orphaned tab stops) is the right framing — but it's also a *sketch-portfolio* concern, because the prev/next chronology is part of how a visitor reads the work as a sequence. If clicking "next" from sketch 52 lands on sketch 54 with no indication that 53 ever existed, the gallery has a small lie in it. The current registry honestly reflects the work; a draft-aware registry has to either show the lie or be careful about hiding it.

## What I'd want the round to land on

- If consensus is forming around the folder-based shape, I'm aligned on the shape but I'd still vote "wait until there's a concrete need" on the question of whether to build it now. The "constraint is the feature" argument hasn't been refuted — it's just been narrowed. The friction the architect identified is real and small; the curation pressure that friction provides is also real and not small.
- If the team does build it, two contract pins from my lane:
  - **Drafts are un-numbered.** `sketches/_drafts/name.tsx`, no number prefix. The number gets assigned at publish-time, when the file moves to `sketches/` and gets a registry entry. This keeps `NN-name.tsx` meaning "chronological order of publication."
  - **Drafts are dev-only, full stop.** No preview-deploy story, no `?preview=token`, no "share with a friend" feature. If the author wants to share a WIP, that's Vercel preview deploys or screen shares — different feature, not this one. Naming what's out of scope keeps the feature from drifting.
- And one note on the architect's shape specifically: if the consensus inverts and the panel lands on the flag-on-entry approach instead of the folder approach, I'd want the numbering-drift question called out explicitly in the registry's contract — a comment in `registry.ts` saying "number = chronological order of when the entry was added, not necessarily publish order." That's the kind of thing that has to be written down or the next person (or agent) re-derives the old assumption and gets surprised.

### From whiteboard-skeptic

Good — `registry.findIndex` is exactly the surface I called out in round 1. Now my round-2 section.

---

Three things I want to put on the table, then a synthesis.

**1. The folder-based consensus is mostly real, but it has one buried risk the panel hasn't named yet.** Three of us reached `sketches/_drafts/` from different angles — me on "the registry's invariant should stay sacred," design-systems on "registry membership shouldn't be ambiguous," sketch-ideation on "the portfolio framing depends on the commitment forcing function." Those are three independent paths to the same shape, which is the signature of *genuine* consensus, not the rationalize-the-same-easy-answer kind. So I don't think it's false consensus on the core question.

But the folder shape has its own quiet risk that nobody has surfaced: **a parallel folder system needs its own contract for what lives there, or it becomes the graveyard sketch-ideation already warned about *with infrastructure encouraging it*.** Today the friction of "uncommitted file in `sketches/` with no registry entry" is what keeps drafts from accumulating — the file is visibly in-the-way. A blessed `sketches/_drafts/` folder removes that friction by giving the graveyard a tidy address. If we ship the folder, the contract needs an answer to "what's the lifecycle?" — is `_drafts/` git-tracked or gitignored? If tracked, it's a public graveyard. If ignored, it's just a personal scratch dir, which is fine but means it can't be shared between machines or with collaborators-of-one (the friend the author wants to show a WIP to via PR). Pick one explicitly. My lean: **gitignored**, because the moment `_drafts/` is in git history, "I'll clean it up later" becomes the failure mode and the constraint that protected the portfolio is gone. Gitignored also makes the answer to design-systems' "audience" sub-question honest: drafts aren't shareable artifacts in this system, by design.

**2. The synthesis position the panel hasn't quite written down.** react-architect and performance lean affirmative because they're each solving for a real local concern (the registry-as-runner / registry-as-publisher conflation, the build-graph cleanliness). Their concerns are valid but local — they don't need the *registry* to change to be addressed. The synthesis is:

> Add a dev-only route at `/sketch/_dev/<filename>` that mounts any `.tsx` file in a *gitignored* `sketches/_drafts/` folder using the existing `<Sketch>` wrapper and a stubbed `meta`. No registry changes. No `SketchEntry` changes. No `generateStaticParams` changes. No public-site changes. The production build never sees the folder (gitignored) and never sees the route (dev-only file or env-gated). The dev shell answers react-architect's "registry has two jobs" complaint by separating them at the route layer, not the data layer.

That synthesis gives the affirmative camp the thing they actually want (sketch-page chrome around an iterating file) without paying any of the costs the negative camp is worried about (registry ambiguity, semantic drift on the numbering, prev/next coupling, portfolio framing erosion). It's the smallest possible change that addresses the only real pain point named in round 1 — and crucially, it requires *zero* changes to the four registry consumer sites, including the `app/sketch/[slug]/layout.tsx:14` prev/next coupling I flagged.

**3. Round-1 risk status.** Two of my three round-1 risks dissolve under the synthesis above; one persists and gets sharper:

- *Prev/next coupling* — **dissolved**, because the synthesis touches no registry consumer. The only path back is if someone later proposes registry-level flags, at which point this risk re-arms.
- *Dev/prod asymmetry* — **dissolved**, because the synthesis is unambiguous: drafts only exist on the local filesystem, and the dev route is the only way to reach them. No Vercel preview surprise, no "I bookmarked the dev URL" failure mode.
- *Numbering-semantics drift* — **still load-bearing, but smaller**. Under the synthesis, drafts live in `_drafts/` *without numbers*. The number is assigned at the moment the file moves to `sketches/NN-name.tsx` and gets a registry entry — same as today. The drift risk only re-arms if someone proposes "drafts get their permanent number while in `_drafts/`," which the contract should explicitly forbid. One line in the registry's contract comment: *"Numbers are assigned at publish, not at draft. A file in `_drafts/` has no slug and no number."*

**My round-2 read.** I'm no longer in the "kill it" camp — the synthesis is small enough and well-shaped enough that I'd vote for it. The cleanest version of "don't ship it" was *"don't ship registry-level draft state,"* and the synthesis preserves that. What we'd actually be shipping is a dev-only route and a gitignored folder convention, neither of which touches the part of the system the negative camp was protecting. If the unit contract is written that way — explicitly scoped to the dev route + gitignored folder, with the registry untouched and the numbering contract restated — I think this is a good design.

The one thing I'd want the unit contract to *forbid by name*, so a future round doesn't drift back into the original framing: **no `draft` field on `SketchEntry`. No second array in `registry.ts`. No `process.env.NODE_ENV` branching inside any registry consumer.** If any of those reappear in implementation, the design has drifted from the synthesis and the round-1 risks re-arm.

