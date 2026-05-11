# Learning draft

JavaScript regex does not support `\Z` (end-of-string anchor) — same gotcha as the autoload line-wrap bug in checkin 01. The pattern that works is index-based slicing (find header position, slice to next end-marker or `string.length`). Avoid Perl-style anchors in any future substrate parsers; always use position-based slicing instead.

_Draft auto-generated from `projects/2026-05-02-agent-guilds/checkins/ev.agent-guilds.phase-1-5-substrate-cleanup-2/05.md` § Notes for the PR. The compaction pipeline (`/griot-compact`) will refine this draft if the judges don't accept it as-is._
