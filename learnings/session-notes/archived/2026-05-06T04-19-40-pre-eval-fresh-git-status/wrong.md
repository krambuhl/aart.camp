In the checkin's Step 4 — Verification block, the agent recorded:

> `git status` shows: `M projects/CONVENTIONS.md`, `A projects/2026-05-02-agent-guilds/checkins/ev.agent-guilds.replan-phase-1-5/01.md`. (Plus the unstaged `.claude/settings.local.json` drift carried from before — harness-managed local config, not part of this unit.)

This claim was based on a recalled state from earlier in the session, not a freshly-run `git status`. The actual working tree at evaluator-invocation time also contained `M next-env.d.ts` — an auto-generated Next.js file whose `import` path had silently shifted from `./.next/dev/types/routes.d.ts` to `./.next/types/routes.d.ts`, carried over from a sibling-branch dev/build run. The unit was sent to the evaluator with that discrepancy unaddressed.

The evaluator (evaluator-contract-fit) correctly flagged `criterion-unmet` on the git-status criterion: the binary "shows only X and Y" framing was not met. The evaluator's exact reasoning surfaced both the missed file (`next-env.d.ts`) and the broader observation that "the artifact's self-reported scope and the actual working tree disagree" — calling out that the verification step's claim and reality had drifted.

Root cause: the agent treated "the tree was X earlier and I haven't intentionally changed it" as evidence for a binary state criterion. Framework auto-generation (Next.js writing to `next-env.d.ts`) violated that assumption silently.
