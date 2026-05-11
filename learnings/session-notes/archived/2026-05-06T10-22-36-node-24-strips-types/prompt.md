A repo is migrating its substrate skill `/trout-autosave` from a markdown
skill to a Node-runnable script. The script is pure CRUD (resolve project
slug → suffix-match against a `projects/` directory; read MANIFEST.md;
parse args; edit a markdown event table; write back). Same arg surface
as the old skill (`<slug> --init --event=<n> --detail=<t> --current-state=<t>
--phase-update=<n>:<status>:<k=v>:<k=v>`).

The user wants:
- TypeScript source, not JavaScript.
- Sibling test files as `<verb>.test.ts` (no `__tests__/` folders).
- Every script in `.claude/scripts/` to ship with tests.

The project's `tsx` is in devDependencies (`"tsx": "^4.19.2"`); existing
scripts run via `tsx ./scripts/foo.ts` from npm scripts. The host is
running Node v24.15.0.

Question: what's the cleanest way to run these `.ts` substrate scripts —
via `npx tsx <file>`, via `tsx <file>` directly, or some other approach?
And what's the convention for the test runner?

Recommend a convention that 11 future migrations will follow.
