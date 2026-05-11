---
'@stageflip/export-router': minor
---

T-408 — Export matrix routing layer (`packages/export-router`).

Pure-function dispatcher that consumes the `EXPORT_MATRIX` constant from
`@stageflip/schema` (per ADR-003 §D3) and produces a typed `RoutingDecision`
naming the per-target exporter package and render mode (`'live'` vs
`'static'`):

- MP4 / image-sequence / pptx-flat / display-pre-rendered → static render
  path. When the document contains live (`interactive-clip`) elements, the
  decision is `kind: 'fallback'` with a `liveClipsOmitted` array enumerating
  every dropped clip's `id` + `family` so the caller can surface a
  pre-export warning.
- HTML-slides / live-presentation / display-interactive / on-device-player →
  live render path regardless of document contents.

Browser-safe; no I/O. The router only names the exporter package as a string
— the caller dispatches. No existing exporter package is modified.
