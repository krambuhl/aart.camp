# Learning draft

Don't lose user-facing workflows when a migration target is "delete the skill" — the in-conversation `/griot-capture` for craft work was a real workflow that PLAN's deliverable wording missed. Restoring it as a thin interactive-only skill (with from-checkin moved to the script) is the cleaner shape than the original both-modes-in-one-skill design. Lesson for future migrations: when a skill has a craft-work mode AND a programmatic mode, split them by primitive (skill vs script) rather than collapsing both into one.

_Draft auto-generated from `projects/2026-05-02-agent-guilds/checkins/ev.agent-guilds.phase-1-5-substrate-cleanup-2/04.md` § Notes for the PR. The compaction pipeline (`/griot-compact`) will refine this draft if the judges don't accept it as-is._
