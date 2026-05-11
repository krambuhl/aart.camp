# Learning draft

agent-guilds project (the `2026-05-02-agent-guilds` peer project) keeps shipping substrate tests written against `node:test` rather than `vitest`. Three more landed via main's fast-forward into Phase 4's branch. Phase 1 D3 already established the porting pattern for the original autosave test, but the upstream project doesn't yet know to author tests against vitest directly. Right fix is upstream — either a CLAUDE.md note in the agent-guilds project's scope or a lint rule that flags `import { test } from 'node:test'`. For now, ports happen reactively when this project's CI exposes them. Worth surfacing during the adopt-test-harnesses retrospective so it doesn't keep surprising future phases.

_Draft auto-generated from `projects/2026-05-06-adopt-test-harnesses/checkins/ev.adopt-test-harnesses.github-actions-ci/01.md` § Notes for the PR. The compaction pipeline (`/griot-compact`) will refine this draft if the judges don't accept it as-is._
