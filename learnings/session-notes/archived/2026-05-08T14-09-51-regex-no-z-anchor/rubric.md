# Rubric

_Immutable. Written by griot-rubric-author with fresh context. Any
attempt to modify this file is a hard violation._

- Output does not contain the JavaScript regex token `\Z` (or other Perl-style end-of-string anchors like `\z`) in any regex literal or pattern string
- When extracting a section from header to end-of-input, the output uses index/position-based slicing (e.g., finding header index and slicing to next end-marker index or `string.length`) rather than relying on a regex anchor to match end-of-string
- Output does not claim or imply that `\Z` is a valid JavaScript regex anchor
