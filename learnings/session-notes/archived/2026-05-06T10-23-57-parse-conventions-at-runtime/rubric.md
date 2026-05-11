# Rubric

_Immutable. Written by griot-rubric-author with fresh context. Any
attempt to modify this file is a hard violation._

- Output recommends parsing `projects/CONVENTIONS.md` at runtime as the source of vocabulary, rather than maintaining a TypeScript constant that duplicates the vocabulary
- Output does not propose a drift test, sync test, or set-equality assertion between a TS constant and CONVENTIONS.md
- Output treats CONVENTIONS.md as the single source of truth for the shared vocabulary (no parallel TS const definition of the same vocabulary values)
