# Rubric

_Immutable. Written by griot-rubric-author with fresh context. Any
attempt to modify this file is a hard violation._

- Output does not use an integer-index argument (e.g. `--correction-index=<N>` or equivalent positional integer) to select which correction to operate on
- Output selects the correction by matching against the correction's text content (e.g. a `--correction-text=` / `--match=` style argument or equivalent string-based lookup)
- When the text-based selection finds no match, the script fails loudly and surfaces the available correction options rather than silently proceeding or defaulting
