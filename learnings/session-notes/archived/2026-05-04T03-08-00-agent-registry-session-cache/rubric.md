# Rubric

_Immutable. Written by griot-rubric-author with fresh context. Any
attempt to modify this file is a hard violation._

- Output separates the authoring of new agent files from any step that invokes those agents at runtime, placing the invocation step in a distinct follow-up unit rather than the same unit as the file creation
- Output explicitly notes that the follow-up unit invoking the new agent must run in a fresh/new session (referencing session boundaries or registry reload at session start)
- Output does not propose working around the registry constraint by faking verification in prose or by skipping/deleting the existing fallback before the new agent is runtime-verified
