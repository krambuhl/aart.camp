# Learning draft

Index-based selection in scripts that pick from a list (e.g. `--correction-index=N`) is fragile when the list can be reordered. Text-based selection with whitespace-tolerant match is the safer default — if the source list changes, the script either still finds the text or fails loudly with the available options. Apply this pattern to similar situations in the substrate (e.g. picking a checkin from a branch).

_Draft auto-generated from `projects/2026-05-02-agent-guilds/checkins/ev.agent-guilds.phase-1-5-substrate-cleanup-2/04.md` § Notes for the PR. The compaction pipeline (`/griot-compact`) will refine this draft if the judges don't accept it as-is._
