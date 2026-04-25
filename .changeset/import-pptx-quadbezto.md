---
"@stageflip/import-pptx": patch
---

`<a:custGeom>` parser now translates `<a:quadBezTo>` (quadratic Béziers) into
SVG `Q` commands. `<a:custGeom>` payloads using only the supported subset
(`<a:moveTo>`, `<a:lnTo>`, `<a:cubicBezTo>`, `<a:quadBezTo>`, `<a:close>`,
multi-`<a:path>`) round-trip without emitting `LF-PPTX-CUSTOM-GEOMETRY`.

`<a:arcTo>` remains the only unsupported command. Its SVG translation needs
the current pen position from the previous command, which the walk-by-kind
traversal can't reliably provide; lifting that needs a workspace-wide
`preserveOrder: true` switch in the shared XML parser. Tracked as a future
follow-up.
