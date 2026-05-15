# D3 design-phase results — drafts on aart.camp

**Date**: 2026-05-15
**Branch**: `ev.agent-guilds.whiteboard-3`
**Checkin**: `checkins/ev.agent-guilds.whiteboard-3/01.md`
**Whiteboard artifact**:
[3-draft-published-sketches.md](3-draft-published-sketches.md)

First end-to-end exercise of the full whiteboard pipeline
(`/guild-whiteboard` → `/guild-spawn` → six engineers → attributed
sections → multi-round prior-state context). Parallels Phase 2's
panel-8 D8 multi-evaluator smoke test for the antagonist-panel
side of the substrate. Closes Phase 3.

## Design topic

*"Should aart.camp adopt a draft/published distinction for
sketches?"* — chosen because (a) it engages multiple engineers'
genuine perspectives with natural variance, (b) it has real design
tension that produces contradictions worth resolving in round 2,
(c) it's a real question the site might face, not a contrived
exercise.

## Round 1 invocation

Skill: `/guild-whiteboard`, composing `/guild-spawn`.

- `engineers`:
  `whiteboard-react-architect,whiteboard-design-systems,whiteboard-performance,whiteboard-a11y,whiteboard-sketch-ideation,whiteboard-skeptic`
- `brief`: the design question + portfolio-framing context from
  CLAUDE.md.
- `whiteboard`:
  `projects/2026-05-02-agent-guilds/whiteboards/3-draft-published-sketches.md`.

### Round 1 per-engineer positions (verbatim verdicts)

| Engineer | Position | Key argument |
|----------|----------|--------------|
| `whiteboard-react-architect` | **Affirmative** — flag with derived views | "Registry has two jobs (publish AND dev-runnable); a draft flag surfaces that conflation"; proposed `draft?: boolean` + `publishedSketches` derived array |
| `whiteboard-design-systems` | **Pushback on naming + on shape** | "Draft/published is CMS-vocabulary; three needs hide under 'draft' (visibility / commitment / audience); folder-based `sketches-wip/` keeps the registry contract honest" |
| `whiteboard-performance` | **Affirmative — Shape B (split-array)** | Build-cost receipt: per-draft chunk is rounding error; split-array makes "what's public" structurally enforced rather than policy-enforced |
| `whiteboard-a11y` | **Out of lane, pin two questions** | Carve-out per body; flagged "does draft slug exist as URL?" and "does prev/next nav skip drafts?" as contract questions worth pinning |
| `whiteboard-sketch-ideation` | **Pushback — don't ship; portfolio framing is the feature** | "Constraint is the feature"; four underlying urges, none best served by a registry flag; if must ship, folder-based |
| `whiteboard-skeptic` | **Pressure-test — surfaced three concrete risks** | (1) prev/next coupling at `layout.tsx:14-22`; (2) dev/prod asymmetry; (3) numbering-semantics drift |

### Round 1 aggregator output

Round 1 produced **real disagreement** across the panel —
three engineers affirmative on the registry-flag shape, three
pushing back (different flavors: naming, "don't ship," shape).
The skeptic landed the specific load-bearing observation
(`app/sketch/[slug]/layout.tsx:14-22` uses `registry.findIndex`
followed by index-walk) that pressure-tests the affirmative
shape.

Structured Result from `whiteboard.ts append`:

```json
{
  "whiteboard_path": "projects/2026-05-02-agent-guilds/whiteboards/3-draft-published-sketches.md",
  "round": 1,
  "sections": [<six attributed sections>],
  "contradictions": []
}
```

(Full sections live verbatim in `3-draft-published-sketches.md`
under `## Round 1`.)

## Round 2 invocation

Same engineer list, same whiteboard path. The skill auto-
detected round 2 from the existing `## Round 1` header and the
prior state was inlined in each engineer's brief.

**Substrate finding surfaced during round 2 setup**: the SKILL
body prescribes constructing `per_agent_context` as a JSON
object keyed by engineer name, with each value being the
prior-state preamble string. But in v1 the preamble is
identical for every engineer (the SKILL acknowledges this). For
a 35KB preamble × 6 engineers = ~210KB of redundant content in
`per_agent_context`. Pragmatic deviation: I inlined the prior
state in the shared `brief` instead (37KB once vs 210KB ×6),
since every engineer sees the same prior state in v1. Same
semantic outcome, ~6× cheaper on prompt budget. See § Substrate
findings.

### Round 2 per-engineer position shifts

| Engineer | Round 1 → Round 2 shift | Drove the shift |
|----------|------------------------|-----------------|
| `whiteboard-react-architect` | **Major shift**: walked back from flag-shape to folder-based | Skeptic's prev/next coupling at `layout.tsx:14-22` — "Every consumer of the registry now has to answer 'which view am I supposed to read?'" |
| `whiteboard-design-systems` | **Hardened on folder**; **withdrew** naming alternatives | The folder shape makes the field disappear entirely — "I was naming a field that shouldn't exist" |
| `whiteboard-performance` | **Shifted from Shape B → Shape D (folder-based)** | Added the cost lens to the folder shape: Shape D is structurally equivalent to Shape C (zero production cost) without C's readability tax. Build graph is genuinely cleaner. |
| `whiteboard-a11y` | **Refined**; clarified the two round-1 contract questions | The skeptic's prev/next surface concretely landed; refined position to "either shape works for a11y but folder is structurally correct; flag-with-views requires remembering a third call site" |
| `whiteboard-sketch-ideation` | **Nuanced shift**: smell is real-but-smaller; folder is right shape IF building, but still vote "don't ship" | Conceded the architect's smell observation has merit as a workflow papercut; maintained "constraint is the feature" + "no concrete WIP has been named" |
| `whiteboard-skeptic` | **Biggest shift**: synthesized a position the panel hadn't written down — moved from "kill it" to "vote for the synthesis" | The folder-based consensus had a buried risk (graveyard accumulation under a tidy address) that resolved with *gitignored* + *dev-only route* + zero registry changes |

### Round 2 aggregator output

```json
{
  "whiteboard_path": "projects/2026-05-02-agent-guilds/whiteboards/3-draft-published-sketches.md",
  "round": 2,
  "sections": [<six attributed sections>],
  "contradictions": []
}
```

## Synthesis emerging from round 2

By round 2, the panel had converged on a concrete shape the
skeptic explicitly named as **the synthesis**:

> **Add a dev-only route at `/sketch/_dev/<filename>` that
> mounts any `.tsx` file in a *gitignored* `sketches/_drafts/`
> (or `sketches/_wip/`) folder using the existing `<Sketch>`
> wrapper and a stubbed `meta`. No registry changes. No
> `SketchEntry` changes. No `generateStaticParams` changes. No
> public-site changes. The production build never sees the
> folder (gitignored) and never sees the route (dev-only file
> or env-gated).**

The synthesis is unanimously the **right shape** if shipping;
the open question (sketch-ideation's "wait until concrete
pain") is the **whether-to-ship** question, which is the
human's call rather than the panel's.

### Forbidden by name in the synthesis (per skeptic)

To prevent drift back to the round-1 framing if this ever ships:

- **No `draft` field on `SketchEntry`.**
- **No second array in `registry.ts`.**
- **No `process.env.NODE_ENV` branching inside any registry consumer.**

If any of those reappear in implementation, the design has
drifted and the round-1 risks (prev/next coupling, numbering-
semantics drift) re-arm.

### Contract pins from the panel

If this ships:

- **Drafts are un-numbered**: `sketches/_drafts/name.tsx`, no
  number prefix. Numbers get assigned at publish-time when the
  file moves to `sketches/NN-name.tsx` and gets a registry
  entry. Keeps `NN-name.tsx` meaning "chronological order of
  publication" — preserves the registry-as-generative-artifact
  property sketch-ideation called out.
- **Drafts are dev-only, full stop**: no preview-deploy story,
  no `?preview=token`, no "share with a friend." Different
  feature; out of scope.
- **`_drafts/` is gitignored** (skeptic's pick): drafts aren't
  shareable artifacts in this system, by design. Removes the
  "blessed-graveyard" risk the skeptic surfaced in round 2.
- **Folder name**: `_drafts/` is on the table; `_wip/` or
  `_experiments/` reads more honestly per design-systems.
  Underscore prefix to signal "infrastructure, not content."

## Phase 3 verification

| PLAN.md sub-clause | Status | Evidence |
|---|---|---|
| "engineers append attributed sections without overwriting each other" | **satisfied** | Whiteboard file has exactly 12 `### From` headers (6 round 1 + 6 round 2) under exactly 2 `## Round N` headers. Every engineer's section is present verbatim, attributed by name. No overwrites observed. The parallel-spawn → sequential-write architecture from D1 holds in practice. |
| "round-2 whiteboard handles contradictions correctly" | **satisfied** | Round 1 produced clear contradictions (flag-vs-folder, naming, ship-or-not). Round 2 engineers each saw the full prior round (via brief-inlined prior state per the substrate-finding deviation below) and explicitly engaged with prior positions: react-architect walked back, design-systems withdrew alternatives, performance updated to Shape D, skeptic synthesized a position that dissolved 2/3 of its round-1 risks. Real contradiction-resolution behavior, not parallel monologues. |

Both PLAN.md Phase 3 verification sub-clauses **satisfied**.
The whiteboard pipeline works end-to-end. Phase 3 closes with
this unit's merge.

## Substrate findings (surfaced by the D3 exercise)

### 1. v1 `per_agent_context` is wasteful when engineers see identical prior state

The `/guild-whiteboard` SKILL prescribes constructing
`per_agent_context` for round 2+ as a JSON object keyed by
engineer name, with each value being the prior-state preamble
string. The SKILL explicitly acknowledges "the body is identical
for every engineer in v1." For a 35KB preamble × 6 engineers,
that's 210KB of redundant content in `per_agent_context`.

**Pragmatic deviation in D3**: I inlined the prior state in the
shared `brief` instead (37KB once vs 210KB × 6). Same semantic
outcome — every engineer sees the same prior state — at ~6×
cheaper prompt budget. The SKILL's `per_agent_context` mechanism
is designed for round-2+ with DIFFERENT-per-engineer context,
which v1 doesn't use.

**Disposition**: substrate observation for a future refactor.
Either (a) the SKILL acknowledges that in v1, brief-inlining is
the cheap path and per_agent_context is forward-compat for
heterogeneous round-N+ context, or (b) the SKILL adds a
`shared_round_context` field that lives once instead of N times.
Out of D3 scope (which is "exercise the pipeline," not "refactor
it").

### 2. The dev-only route convention from the synthesis isn't documented in CLAUDE.md

The panel's synthesis includes a new convention — "dev-only
routes under `sketches/_dev/...`, files in `sketches/_drafts/`
(gitignored)" — that doesn't exist in the codebase yet. The
ACT of designing it via this whiteboard is the unit's value.
Documenting it in CLAUDE.md, if it ever ships, is the
follow-up unit. The whiteboard's job was to surface the
shape; the contract for the implementation unit would carry
the spec.

## What we learned (process observations)

- **Round 2 earned its keep.** The skeptic's `whiteboard-base.md`
  multi-round dynamic section explicitly says "round 2 is where
  the skeptic earns the most keep." That held: the skeptic
  synthesized the dev-only-route + gitignored-`_drafts/` shape
  that nobody had quite written down in round 1, and dissolved
  2 of its own round-1 risks in the process.

- **Cross-engineer courtesy held.** Every engineer explicitly
  named what was IN their lane and DEFERRED to siblings on
  out-of-lane points. The `whiteboard-base.md` cross-perspective
  courtesy rules produced the observed behavior — no piling-on,
  no five-engineers-saying-the-same-thing-from-five-angles.

- **Sketch-ideation's carve-out fired correctly.** The topic was
  sketch-portfolio territory, so this engineer engaged
  substantively rather than carving out. Its "When you carve
  yourself OUT" section is for substrate / shared-infrastructure
  / token / non-sketch-route work; here, sketches/registry.ts
  IS the territory.

- **Position-shifting is observable across rounds.** Three
  engineers explicitly named "I've shifted." That's a positive
  signal that the prior-state mechanism produced real round-2
  engagement, not restated round-1 monologues.

- **One substrate inefficiency surfaced.** The
  per_agent_context redundancy in v1. Captured for follow-up.

## Net Phase 3 close

PLAN.md Phase 3 verification sub-clauses both satisfied. The
whiteboard pipeline produced a useful design output (a real
synthesis on a real question), exercised the substrate
end-to-end (file creation, parallel spawn, attributed
section-writing, multi-round prior-state, append correctness),
and surfaced one substrate finding worth elevating. Phase 3
closes.
