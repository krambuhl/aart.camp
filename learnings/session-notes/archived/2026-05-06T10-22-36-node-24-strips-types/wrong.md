Initial proposal:

> The proposed convention for all 11 migrations:
>
> - Source: `.claude/scripts/<family>/<verb>.ts` (TypeScript)
> - Tests: `.claude/scripts/<family>/<verb>.test.ts` (sibling, not `__tests__/`)
> - Runner: `node:test` via `tsx`, exposed as `npm run test`
> - Invocation from skills: `Bash(npx tsx .claude/scripts/<family>/<verb>.ts ...)`
> - PLAN.md updated to reflect `.ts`+tsx; permission patterns become
>   `Bash(npx tsx .claude/scripts/<family>/*)`

The reasoning anchored on the existing project pattern (`tsx ./scripts/...`
in `package.json`), assumed `tsx` was the necessary runtime path for
TypeScript scripts, and proposed `npx tsx` as the invocation form to avoid
PATH issues. The downstream effects: a longer command chain, a devDep on
the critical path, and updated permission patterns to allow `npx tsx`.

I asked the user to confirm the `npx tsx` chain and noted it as the
default before checking what Node 24 actually supports.
