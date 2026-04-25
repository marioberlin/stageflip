---
"@stageflip/import-pptx": minor
---

T-242a: preset geometries — infra + first wave.

Implements the geometry library spec'd in `docs/tasks/T-242.md`. Six
representative presets across all six families (rightArrow, wedgeRectCallout,
ribbon, parallelogram, leftBracket, cloud) plus the `<a:custGeom>` →
SVG-path translator now produce schema-typed `'shape'` elements with
`shape: 'custom-path'` instead of T-240's `unsupported-shape` placeholder.

Public surface adds:
- `geometryFor(prst, box, adjustments?)` — preset registry entry point.
- `custGeomToSvgPath(custGeom, box?)` — OOXML path-language translator.
- `COVERED_PRESETS` / `PRESET_GENERATORS` — introspection / coverage pin.
- Types: `GeometryBox`, `AdjustmentMap`, `PathGenerator`.

`LossFlagCode` adds `LF-PPTX-PRESET-ADJUSTMENT-IGNORED` (info severity)
for the case where a preset has an `<a:avLst>` adjustment we don't honor;
T-242a uses defaults throughout.

Coverage of the spec's 50-preset commitment: 6 in this PR. T-242b will
add the remaining 30 (rest of arrows, callouts, banners, basics, brackets,
misc) plus honor `roundRect.adj1`.

Custom-geometry parser supports `<a:moveTo>`, `<a:lnTo>`, `<a:cubicBezTo>`,
`<a:close>`, and multi-`<a:path>` `<a:pathLst>`. `<a:arcTo>` /
`<a:quadBezTo>` are deferred — payloads using them fall back to
`unsupported-shape` and surface `LF-PPTX-CUSTOM-GEOMETRY`.
