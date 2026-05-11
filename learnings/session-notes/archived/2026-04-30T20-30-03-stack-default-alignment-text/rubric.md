# Rubric

_Immutable. Written by griot-rubric-author with fresh context. Any
attempt to modify this file is a hard violation._

- The inner row Stack inside each file listing has an explicit `alignment="start"` prop (or a responsive value beginning with `start`), overriding Stack's default `alignment="center"`
- No Stack in the file listing column or rows is left relying on the default `alignment` (i.e. every relevant Stack either passes `alignment="start"` or otherwise ensures children are not horizontally centered)
- The output does not reintroduce a centering wrapper (e.g. `<Area width={...}>` around the column, `justify-content: center`, `text-align: center`, or `align-items: center`) on the file listing
