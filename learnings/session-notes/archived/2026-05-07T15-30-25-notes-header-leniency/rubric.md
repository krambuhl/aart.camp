# Rubric

_Immutable. Written by griot-rubric-author with fresh context. Any
attempt to modify this file is a hard violation._

- Output's parser regex for the Notes header matches both `## Notes for PR` and `## Notes for the PR` (e.g., uses an optional 'the ' group such as `(?:the )?`)
- Output includes or adds a test case that exercises the non-canonical `## Notes for PR` (without 'the') header form against the parser
- Output does not restrict the Notes header match to only the canonical `## Notes for the PR` form
