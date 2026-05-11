# Rubric

_Immutable. Written by griot-rubric-author with fresh context. Any
attempt to modify this file is a hard violation._

- Output does not claim that the script resolves or substitutes `<N>` from the gh response before invoking autosave
- Output describes the actual two-step pattern: invoking `submit` without `--phase-update`, parsing the PR number from `submit`'s terminal-state output, then running a follow-up `autosave --phase-update` to set the row's PR field
- Output explicitly grounds its description of the script's runtime behavior in dogfood/execution evidence rather than inference from surrounding code or contract structure
