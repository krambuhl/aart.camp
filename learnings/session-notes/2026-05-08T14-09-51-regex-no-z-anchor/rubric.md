# Rubric

_Immutable. Written by griot-rubric-author with fresh context. Any
attempt to modify this file is a hard violation._

- Output does not contain the regex anchor `\Z` in any pattern or code
- Output extracts sections using index-based slicing (e.g., finding a header position and slicing to the next marker or `string.length`/`.length`) rather than relying on a regex end-of-string anchor
- Output does not introduce other Perl/Python-only regex anchors (such as `\A` or `\z`) as substitutes for end-of-input matching
