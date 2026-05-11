# Rubric

_Immutable. Written by griot-rubric-author with fresh context. Any
attempt to modify this file is a hard violation._

- Output's staging logic permits untracked files outside the `projects/` directory (does not reject them solely for being outside `projects/`)
- Output filters stageable paths using a hard exclude list rather than restricting non-`projects/` files to a checkin-prefix or `NN.md` pattern allowlist
- Output does not require untracked files outside `projects/` to match the checkin prefix (e.g., `NN.md`) in order to be staged
