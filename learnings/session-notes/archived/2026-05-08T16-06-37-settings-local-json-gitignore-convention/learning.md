# Learning draft

`.claude/settings.local.json` was tracked in git but churning constantly across branches (testing artifacts + machine-specific permission allowlists with foreign paths like `/Users/ekrambuhl/...`). User correctly identified it should be gitignored — that's Claude Code convention for `*.local.json` files. Folded into D2 because the evaluator race condition (file dirties during checks, gets flagged) was blocking the gate. `.gitignore` extended; `git rm --cached` untracked the existing file. Local file preserved on disk.

_Draft auto-generated from `projects/2026-05-06-adopt-test-harnesses/checkins/ev.adopt-test-harnesses.playwright-harness/02.md` § Notes for the PR. The compaction pipeline (`/griot-compact`) will refine this draft if the judges don't accept it as-is._
