# Rubric

_Immutable. Written by griot-rubric-author with fresh context. Any
attempt to modify this file is a hard violation._

- Output adds `.claude/settings.local.json` (or a matching pattern like `*.local.json` or `.claude/*.local.json`) to `.gitignore`
- Output uses `git rm --cached` (not plain `git rm` or `rm`) to untrack the file while preserving the local copy on disk
- Output does not propose committing, reverting, or otherwise managing the diffs in `.claude/settings.local.json` as legitimate tracked state
