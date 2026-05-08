# Learning draft

When a checkin's Notes section uses a non-canonical header form (`## Notes for PR` vs CONVENTIONS.md's `## Notes for the PR`), the parser must accept both rather than failing silently. Self-smoke against the real project caught this — the script was producing a Last checkin block without the Notes line because the regex looked for the canonical form only. Worth knowing for the next migration: don't assume canonical-form headers in fixtures match what's actually on disk.

_Draft auto-generated from `projects/2026-05-02-agent-guilds/checkins/ev.agent-guilds.phase-1-5-substrate-cleanup-2/01.md` § Notes for the PR. The compaction pipeline (`/griot-compact`) will refine this draft if the judges don't accept it as-is._
