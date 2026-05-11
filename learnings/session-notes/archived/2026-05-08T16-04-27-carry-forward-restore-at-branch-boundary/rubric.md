# Rubric

_Immutable. Written by griot-rubric-author with fresh context. Any
attempt to modify this file is a hard violation._

- Output explicitly discards, restores, or resets `next-env.d.ts` and `.claude/settings.local.json` (e.g., via `git restore`, `git checkout --`, or equivalent) at the branch boundary rather than carrying their modifications forward
- Output does not treat modifications to `next-env.d.ts` or `.claude/settings.local.json` as legitimate working-tree state to preserve, stage, or commit
- Output identifies `next-env.d.ts` and/or `.claude/settings.local.json` as auto-regenerated or testing/local artifacts (not real changes)
