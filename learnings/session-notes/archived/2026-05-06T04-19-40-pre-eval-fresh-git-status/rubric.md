# Rubric

_Immutable. Written by griot-rubric-author with fresh context. Any
attempt to modify this file is a hard violation._

- The output shows evidence that `git status` was run fresh as part of the verification step that records the working-tree state (e.g., a tool invocation, command transcript, or explicit statement of a just-run check), rather than citing a recalled or earlier-in-session state
- The enumerated files in the recorded `git status` claim include every path that a fresh `git status` would surface at that moment (no silent omissions of auto-generated or framework-managed files like `next-env.d.ts`)
- The output does not assert a working-tree state criterion (`git status shows only X and Y`) on the basis of an earlier-session summary or an unverified assumption that nothing has changed since
