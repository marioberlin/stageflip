---
'@stageflip/import-pptx': minor
---

T-242d Sub-PR 2: `<a:custGeom>` walker now translates `<a:arcTo>` to SVG `A`
arc segments (ECMA-376 §20.1.9.3 sign convention: positive `swAng` =
clockwise = SVG `sweep-flag = 1` in y-down coordinates), with pen-position
state advancing through the path. Adds the trailing 3 custom-path presets
(`chord`, `pie`, `donut`) built on real arcs, bringing T-242 coverage to
36/36 custom-path + 14 structural = 50/50 presets. The
`LF-PPTX-CUSTOM-GEOMETRY` and (committed-set) `LF-PPTX-PRESET-GEOMETRY`
loss flags are no longer emitted from the parser.
