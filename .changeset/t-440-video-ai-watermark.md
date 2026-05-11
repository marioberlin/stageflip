---
'@stageflip/export-video': patch
---

T-440 — provenance-aware video exporter: opt-in AI watermark
plan + `ai-content.json` sidecar (Phase 14 γ fifth cross-cutting
integration; NOT a §13 structural extension — pure addition).

- New `exportProvenanceAware(input)` entry point composes the
  existing `exportMultiAspectInParallel` orchestrator with a
  provenance walk + opt-in watermark plan + sidecar manifest. The
  existing entry point is unchanged; callers that don't need AI
  disclosure see byte-identical behavior.
- `ProvenanceAwareExportInput.aiElements?: ReadonlyArray<AiVideoElementInputRow>`
  — opt-in list of `{ elementId, provenance?, frameRange? }` rows
  the orchestrator walks at export time.
- `ProvenanceAwareExportInput.aiWatermark?: Partial<AiWatermarkConfig>`
  — partial watermark config; merged with `DEFAULT_AI_WATERMARK`
  (`enabled=false`, `text='Made with AI'`, `position='bottom-right'`,
  `opacity=0.10`, `color='#fff'`, `fontSize=12`).
- For each element whose `provenance.kind` indicates AI-generated
  content (one of `tts` / `video-gen` / `music-gen` / `sfx` /
  `three-d` / `image-gen` / T-438's non-terminal
  `'asset-gen-pending'`), the orchestrator (when opted in):
  1. Emits an `AiContentManifest` via `result.aiContent` (the
     `ai-content.json` sidecar payload — hosts write it alongside
     the exported MP4).
  2. Emits an `AiWatermarkPlan` via `result.watermarkPlan` —
     renderer-facing instructions: the merged frame ranges + the
     resolved watermark config. Concrete `VariantRenderer`
     implementations consume the plan and composite the watermark
     via FFmpeg drawtext (bake tier) or canvas / CSS overlay
     (live preview). The orchestrator does NOT pixel-composite.

Opt-in posture (vs T-439's auto-mark):

T-439's IAB display exporter auto-marks AI content for FTC + EU AI
Act ad-tech compliance. T-440 inverts the posture: video output
spans many contexts (artistic, internal, broadcast) and FTC "clear
and conspicuous" is less stringent for non-endorsement content.
Forcing a watermark over-discloses for legitimate creative uses
where AI is one tool among many. Tenants targeting regulated
distribution (FTC-regulated endorsement; EU-regulated under
Article 50(2); China under the Generative AI Service Measures)
MUST explicitly opt in via `aiWatermark.enabled = true`.

§13 statement: NOT a structural extension. No schema changes; no
new RIRElement; no new ClipKindBinding field; no compositing
changes in any runtime; no new runtime kind. Existing
`exportMultiAspectInParallel` callers see byte-identical behavior.
Render verification N/A — the watermark composition is a
renderer-side concern; T-440 ships only the plan + sidecar + walk.

Predecessor evidence: T-415..T-439 merged on main HEAD `a5343c26`.
T-435 adapter regression CI gate stays green in this PR.
