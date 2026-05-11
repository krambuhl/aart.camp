# Rubric

_Immutable. Written by griot-rubric-author with fresh context. Any
attempt to modify this file is a hard violation._

- The skill body's Inputs section documents `per_agent_context` as one of the skill's inputs (alongside `agents` and `brief`)
- The output does NOT include `per_agent_context` in a 'What this skill does NOT do' / deferred / out-of-scope section, and does NOT instruct callers to compose per-agent variation into the brief instead
- The `argument-hint` frontmatter (or equivalent invocation-shape line) includes `per_agent_context` as a parameter
