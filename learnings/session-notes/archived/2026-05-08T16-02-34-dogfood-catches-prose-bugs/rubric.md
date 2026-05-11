# Rubric

_Immutable. Written by griot-rubric-author with fresh context. Any
attempt to modify this file is a hard violation._

- Output does not claim (as fact) that the script resolves or substitutes `<N>` (from a gh response or otherwise) before invoking autosave
- Output describes a two-step pattern: invoking `submit` without `--phase-update` first, then parsing the PR number from `submit`'s output and running a follow-up `autosave --phase-update` with that number
- Output's description of script behavior is framed as observed/dogfooded runtime behavior rather than inferred from reading the script's source
