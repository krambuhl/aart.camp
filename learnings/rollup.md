## L-001: Node 24 strips TS — use `node` directly

Promoted: 2026-05-11
Origin: 2026-05-06T10-22-36-node-24-strips-types

### Learning

When authoring a TypeScript script for direct invocation under Node 24+,
use `node script.ts` directly — Node 24 strips type annotations natively
(the flag was experimental in 22.6, default-on in 23, fully default in
24). Do not propose `tsx`, `npx tsx`, or any other transformer chain for
this case. The substrate runs faster, has one fewer devDep on the
critical path, and the invocation form is shorter (`Bash(node ...)` vs
`Bash(npx tsx ...)`).

Caveat: the source must use only "erasable" TypeScript — no enums, no
`namespace`, no parameter properties, no `const enum`. Stick to type
annotations on values, interfaces, type aliases, and `as const`. If
broader TS features are required, then tsx becomes necessary again, but
that's the unusual case for substrate plumbing.

### Rubric

- Output invokes TypeScript scripts using `node` directly (e.g., `node script.ts`) rather than via `tsx` or `npx tsx`
- Output does not contain `npx tsx` or `tsx` as a runtime wrapper for executing `.ts` substrate scripts
- Output does not propose adding `tsx` as a dependency, permission pattern, or invocation convention for running `.ts` scripts

## L-002: Halt-and-fork on mid-flight scope expansion

Promoted: 2026-05-11
Origin: 2026-05-08T14-29-27-mid-flight-scope-fork-pattern

### Learning

When you honor a contract's literal "no X changes" disqualifier but
discover during validation that adjacent work (test files, harness
config, dependency-graph-adjacent edits) was implicitly excluded by the
framing, halt and raise it as a fork to the user before proceeding.
Don't silently expand scope, and don't make a single recommendation —
present multiple named options (typically a defer / do-here / new-checkin
or precursor-commit shape) so the user can pick the path that matches
their priorities. The boundary-expansion conversation belongs in the
session log, not in the diff.

### Rubric

- Output halts and waits for user input rather than proceeding to make the out-of-scope changes (e.g. porting the test files) in the same checkin
- Output explicitly names that the discovered work falls outside the original contract's scope or boundary
- Output presents the user with a fork of at least two named options (e.g. defer / do here / new checkin) for how to handle the scope expansion
