---
"@stageflip/import-pptx": minor
---

T-242c batch 1: 9 more presets (arrows + callouts).

Adds path generators for `leftRightArrow`, `upDownArrow`, `bentArrow`,
`curvedRightArrow`, `wedgeRoundRectCallout`, `wedgeEllipseCallout`,
`cloudCallout`, `borderCallout1`, `borderCallout2`. Total preset coverage
now 25 of the 36 custom-path presets the parent T-242 spec commits to;
T-242c batch 2 lands the next 8 (banners + misc), and T-242d closes out
with the 3 arc-bearing presets (`chord`, `pie`, `donut`).

`<a:avLst>` adjustments remain at OOXML defaults for the new generators
(per T-242c spec); fixtures setting unhonored adjustments still emit
`LF-PPTX-PRESET-ADJUSTMENT-IGNORED` (info severity) as before.

`borderCallout1` / `borderCallout2` emit a two-subpath SVG `d` (rectangle
body + leader line) — renderers that fill/stroke as one shape see the
expected behavior; finer-grained leader styling lands once the schema
splits leader-line styling from body styling (out of scope for T-242).

`cloudCallout` reuses the cubic-Bezier lobed body pattern from `cloud`;
both will be re-derived from arcs after T-242d lands `<a:arcTo>` parser
support (handover §4 carry-forward #2).

98/98 tests passing (was 85; +13). Coverage on `geometries/` module:
100% lines.
