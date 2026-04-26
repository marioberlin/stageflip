---
"@stageflip/import-pptx": minor
---

T-242c batch 2: 8 more presets (banners + misc).

Adds path generators for `ribbon2`, `verticalScroll`, `horizontalScroll`,
`star10`, `star12`, `moon`, `lightningBolt`, `noSmoking`. Total preset
coverage now 33 of the 36 custom-path presets the parent T-242 spec commits
to; T-242d closes out with the 3 arc-bearing presets (`chord`, `pie`,
`donut`) once `<a:arcTo>` parser support lands.

`<a:avLst>` adjustments remain at OOXML defaults for the new generators
(per T-242c spec); fixtures setting unhonored adjustments still emit
`LF-PPTX-PRESET-ADJUSTMENT-IGNORED` (info severity) as before.

`noSmoking` ships as a 3-subpath SVG `d` (outer ring + inner cutout +
diagonal bar) under the SVG even-odd fill convention; the two circles use
the standard 4-cubic-Bézier ellipse approximation. T-242d may re-derive
with real arcs alongside `cloud` / `cloudCallout` once `<a:arcTo>` lands.

The smoke test for `LF-PPTX-PRESET-GEOMETRY` in `parsePptx.test.ts` now
pins `chord` (deferred to T-242d) instead of `lightningBolt` (now covered).

106/106 tests passing (was 98; +8). Coverage on `geometries/` module: 100%
lines.
