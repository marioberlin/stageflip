---
'@stageflip/runtimes-audience': minor
'@stageflip/export-pptx': minor
---

T-472 — Static-fallback consolidation. Adds `renderAudienceExportFrame`
dispatcher + eleven per-clip-kind SVG export-frame emitters on
`@stageflip/runtimes-audience` (exposed via a new `/export-frame`
subpath), and wires `@stageflip/export-pptx` to consume them in
`parts/slide.ts` + `parts/template-elements.ts`. The PPTX exporter no
longer raises `LF-PPTX-EXPORT-UNSUPPORTED-ELEMENT` for the eleven
`audience-*` element types; each is replaced with a `<p:sp>` carrying
a CDATA-wrapped SVG payload that approximates the static-fallback
DOM at low fidelity.
