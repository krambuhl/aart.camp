# Rubric

_Immutable. Written by griot-rubric-author with fresh context. Any
attempt to modify this file is a hard violation._

- Output recommends porting/converting the substrate tests to vitest (one harness) rather than running node:test and vitest side by side
- Output does not propose a separate `node --test` script (e.g., `test:substrate` invoking `node --test`) as the final state
- Output does not defer harness consolidation to a follow-up PR
