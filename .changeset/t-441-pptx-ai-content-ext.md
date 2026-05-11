---
'@stageflip/export-pptx': patch
---

T-441 — provenance-aware slide exporter: PPTX `<a:extLst>`
AI-content extension (Phase 14 γ sixth cross-cutting integration;
NOT a §13 structural extension — pure addition).

- New `ExportPptxOptions.aiElements?: ReadonlyArray<AiPptxElementInput>`
  — opt-in list of `{ elementId, slideId?, provenance? }` rows
  the exporter walks at export time. Absent / empty / no AI
  rows match → `ppt/presentation.xml` byte-identical to
  pre-T-441 (back-compat).
- For each row whose `provenance.kind` classifies as AI-generated
  (one of `tts` / `video-gen` / `music-gen` / `sfx` / `three-d` /
  `image-gen` / T-438's non-terminal `'asset-gen-pending'`), the
  writer splices a `<p:extLst>` block after `<p:notesSz>` and
  before `</p:presentation>`:

```xml
<p:extLst>
  <p:ext uri="https://stageflip.dev/extensions/ai-content/v1">
    <sf:aiContent xmlns:sf="https://stageflip.dev/extensions/ai-content/v1">
      <sf:element id="el-1" provider="tts-kokoro" modality="tts"
                  slideId="s1" cacheKey="sha256-abc" prompt="hello"/>
    </sf:aiContent>
  </p:ext>
</p:extLst>
```

- Imported / no-provenance rows filter out. Pending placeholders
  (T-438 `'asset-gen-pending'`) disclose conservatively (treated
  as AI).
- New public surface re-exported from
  `@stageflip/export-pptx`: `AI_CONTENT_EXT_URI`,
  `classifyAiKind`, `extractAiPptxManifest`,
  `emitAiContentExtension`, plus types
  `AiPptxElementInput`, `AiPptxManifest`, `AiPptxManifestElement`.

Posture (vs T-439 / T-440):

T-439's IAB display exporter auto-marks AI content with a visible
badge (FTC + EU AI Act ad-tech regulatory floor). T-440's video
exporter inverts the posture: opt-in watermark + sidecar. T-441's
PPTX exporter takes a third path: always-emit data on `<p:extLst>`
with **no badge or watermark** — PPTX consumers (PowerPoint,
Keynote, LibreOffice Impress) own the AI-disclosure UI. The
extension URI is forward-compatible per ISO/IEC 29500-1 §15.1.1
(unknown URIs preserved on round-trip, ignored on render).

§13 statement: NOT a structural extension. No schema changes; no
new RIRElement; no new ClipKindBinding field; no compositing /
blending / stacking changes; no new runtime kind. Existing
`exportPptx` callers see byte-identical behavior. Render
verification N/A — the extension carries data, not pixels;
consumers render exactly as before.

Predecessor evidence: T-415..T-440 merged on main HEAD
`01815547`. T-435 adapter regression CI gate stays green.
