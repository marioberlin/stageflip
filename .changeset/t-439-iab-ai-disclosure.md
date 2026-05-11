---
'@stageflip/export-html5-zip': patch
---

T-439 — provenance-aware display IAB exporter: auto-marks
AI-generated content per FTC + EU AI Act disclosure requirements
(Phase 14 γ fourth cross-cutting integration; NOT a §13 structural
extension — pure addition).

- `BannerExportInput.aiElements?: ReadonlyArray<AiElementInputRow>`
  — opt-in list of `{ elementId, provenance? }` rows the orchestrator
  walks at export time. When absent or empty, the export path is
  byte-identical to non-AI banners (all 21 existing orchestrator
  tests pass unchanged).
- For each element whose `provenance.kind` indicates AI-generated
  content (one of `tts` / `video-gen` / `music-gen` / `sfx` /
  `three-d` / `image-gen` / T-438's non-terminal
  `'asset-gen-pending'`), the orchestrator:
  1. Injects a visible semi-transparent `<aside data-ai-disclosure>`
     badge into the banner's `<body>` (configurable per-tenant via
     `ExportOrchestratorOptions.aiBadge`: text / position / color /
     fontSize; default `'AI'` top-right).
  2. Rewrites the element's mount node (when the bundler emits a
     `data-element-id` selector) to also carry
     `data-ai-generated="true"`.
  3. Surfaces `BannerExportResult.aiContent: AiContentDisclosure` with
     per-element rows `{ elementId, provider, modality, cacheKey?,
     prompt? }` and a coarse `disclosure: { ftc, euAiAct }` compliance
     summary (`'compliant'` requires badge enabled + ≥1 row with
     provider [FTC] / provider+model [EU AI Act]).
- Imported (`kind: 'imported'`) and no-provenance elements are
  filtered out by the walker — disclosure is per-element, not global.
- `aiBadge.text = ''` suppresses the visible badge but the manifest
  `aiContent` field still surfaces AI elements (with
  `disclosure.{ftc,euAiAct} = 'requires-tenant-config'`).

Determinism preserved (badge gen is pure; idempotent injection is
marker-bracketed). No schema changes, no new RIRElement, no new
ClipKindBinding field, no compositing changes, no runtime kind. The
render pipeline is unchanged for non-AI elements and unchanged for
AI elements (provenance is read post-render during the export walk).
Render verification N/A — IAB display export produces HTML, not pixel
goldens; coverage is unit (provenance-walk + ai-badge) plus
orchestrator-level integration (decode ZIP, verify badge marker and
manifest field).

Regulatory references: FTC Endorsement Guides (16 CFR Part 255),
EU AI Act Article 50(2), China Generative AI Service Measures
(2023-08-15).
