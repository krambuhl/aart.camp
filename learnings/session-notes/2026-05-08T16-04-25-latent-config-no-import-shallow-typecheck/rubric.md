# Rubric

_Immutable. Written by griot-rubric-author with fresh context. Any
attempt to modify this file is a hard violation._

- Output explicitly notes that a config or harness file with no inbound imports receives only shallow type-checking (or equivalent: that a passing `npm run build` does not prove the file is deep-checked until something imports it)
- Output prescribes adding an inbound import to the harness file early — e.g., a smoke import, smoke story, smoke test, or other consumer — as the mechanism to surface latent type errors
- Output does not claim that a green `npm run build` alone is sufficient evidence that a newly added unimported config file is correctly typed
