---
"@stageflip/import-pptx": minor
---

T-242b first-wave: 10 more presets + `roundRect.adj1` honored as `cornerRadius`.

Adds path generators for `leftArrow`, `upArrow`, `downArrow`, `trapezoid`,
`chevron`, `rightBracket`, `leftBrace`, `rightBrace`, `sun`, `heart`. Total
preset coverage now 16 of the spec's 50-preset commitment; T-242c lands the
remaining 20.

`roundRect` parsed shapes now honor the OOXML `adj1` adjustment (stored as
a 100000ths integer per ECMA-376) and emit a structural-rect `ShapeElement`
with the schema's existing `cornerRadius` field populated:
`cornerRadius = (adj × min(w, h)) / 200000`.

`<a:avLst>` adjustments that the geometry library doesn't read still produce
the shape (using OOXML defaults) and emit one `LF-PPTX-PRESET-ADJUSTMENT-IGNORED`
flag (info severity) per ignored adjustment. `HONORED_ADJUSTMENTS` registry
in the geometry module tracks which adj names each preset actually consumes;
T-242c will populate it as more adjustments land.

New `adjusted` programmatic fixture exercises both code paths (honored
roundRect.adj + ignored callout adjs); 84/84 tests passing (was 69; +15).
