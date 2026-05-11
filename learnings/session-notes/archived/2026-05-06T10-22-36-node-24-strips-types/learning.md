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
