# Learning draft

Evaluator agents work better when the packet trusts them with pre-computed verification rather than asking them to re-investigate. The original wording (verbatim contract + raw artifact pointers) implicitly invites tool-heavy investigation; the dense-packet wording explicitly says "trust the pre-computed results and spot-check at most one or two criteria." Same evaluator agent, same maxTurns budget — packet shape is the variable.

_Draft auto-generated from `projects/2026-05-02-agent-guilds/checkins/ev.agent-guilds.phase-1-5-substrate-cleanup-2/06.md` § Notes for the PR. The compaction pipeline (`/griot-compact`) will refine this draft if the judges don't accept it as-is._
