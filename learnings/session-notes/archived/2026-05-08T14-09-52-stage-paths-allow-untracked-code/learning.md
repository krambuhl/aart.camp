# Learning draft

the staging logic for new code files outside `projects/` was initially too restrictive (only stageable if matching the checkin prefix), which would have rejected new substrate files like `.claude/scripts/trout/pr-plumbing.ts` itself. Updated `selectStagePaths` to permit untracked files outside `projects/` (filtered by the hard exclude list) — modeled on the recent commit history showing new substrate files getting committed alongside checkins.

_Draft auto-generated from `projects/2026-05-02-agent-guilds/checkins/ev.agent-guilds.phase-1-5-substrate-cleanup-2/07.md` § Notes for the PR. The compaction pipeline (`/griot-compact`) will refine this draft if the judges don't accept it as-is._
