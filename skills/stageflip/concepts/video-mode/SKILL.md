---
title: Video Mode — Multi-Aspect Export + Provenance-Aware Watermark
id: skills/stageflip/concepts/video-mode
tier: concept
status: substantive
last_updated: 2026-05-11
owner_task: T-440
related:
  - skills/stageflip/concepts/display-mode/SKILL.md
  - skills/stageflip/profiles/video/SKILL.md
  - skills/stageflip/modes/stageflip-video/SKILL.md
  - skills/stageflip/concepts/schema/SKILL.md
  - skills/stageflip/concepts/optimistic-placeholders/SKILL.md
---

# Video Mode — Multi-Aspect Export + Provenance-Aware Watermark

The video product targets short-form video (social ads, product
videos, explainer clips). The export pipeline lives in
`@stageflip/export-video` and orchestrates one `VariantRenderer`
invocation per aspect-ratio variant, producing MP4 (typical) or
external-URL outputs.

The orchestrator is renderer-agnostic: concrete renderer backends
(CDP host bundle, bake tier) plug in behind the `VariantRenderer`
contract. T-186 lands the multi-aspect parallel fan-out. T-440 layers
opt-in AI-content disclosure on top.

## AI watermark (T-440)

T-440 extends the orchestrator with provenance-aware AI-content
disclosure: when the tenant **opts in**, the exporter walks the
document's MediaElements, identifies AI-generated content, and
emits two artifacts alongside each rendered variant:

1. An `ai-content.json` sidecar describing every AI element
   (provider, modality, prompt, cacheKey, optional frame range).
2. An `AiWatermarkPlan` — renderer-facing instructions describing
   when (frame ranges) and how (text, position, opacity, color,
   font-size) to composite a watermark onto frames containing
   AI-generated content. The orchestrator does NOT pixel-composite;
   concrete renderers consume the plan and apply it via FFmpeg
   drawtext (bake tier) or canvas / CSS overlay (live preview).

### Opt-in posture (vs T-439's auto-mark)

T-439's IAB display exporter **auto-marks** AI content for FTC + EU
AI Act ad-tech compliance — the badge is on by default because the
regulatory floor for display advertising is strict.

T-440 **inverts** the posture: the watermark is **opt-in** by
default. Video output spans many contexts (artistic content,
internal training material, social media, broadcast) and the FTC's
"clear and conspicuous" prong is less stringent for non-endorsement
content. Forcing a watermark on every AI-influenced video would
over-disclose for legitimate creative uses where AI is one tool
among many.

Tenants targeting regulated distribution (FTC-regulated
endorsement; EU-regulated under Article 50(2); China under the
Generative AI Service Measures) MUST explicitly opt in via
`aiWatermark.enabled = true`.

### Entry point

`exportProvenanceAware(input)` is additive — it composes the
existing `exportMultiAspectInParallel` orchestrator with the
provenance walk + opt-in plan + sidecar emission. Callers that don't
need AI disclosure continue to use `exportMultiAspectInParallel`
directly and see byte-identical behavior.

```ts
interface ProvenanceAwareExportInput {
  readonly document: Document;
  readonly variants: readonly VariantTarget[];
  readonly renderer: VariantRenderer;
  readonly aiElements?: readonly AiVideoElementInputRow[];
  readonly aiWatermark?: Partial<AiWatermarkConfig>;
  readonly concurrency?: number;
  readonly signal?: AbortSignal;
}

interface AiVideoElementInputRow {
  readonly elementId: string;
  readonly provenance?: MediaProvenance;
  readonly frameRange?: { readonly startFrame: number; readonly endFrame: number };
}
```

Hosts populate `aiElements` by walking the document's MediaElements
(audio / image / video / future GLB-bearing wrappers) and emitting
one row per element. Rows whose `provenance` is absent OR whose
`provenance.kind === 'imported'` are filtered out by the walker.

### AI-kind classification

`classifyAiKind(kind)` returns `true` for:

- `'tts'` — text-to-speech
- `'video-gen'` — video generation
- `'music-gen'` — music generation
- `'sfx'` — sound effects
- `'three-d'` — 3D asset generation
- `'image-gen'` — image / infographic generation
- `'asset-gen-pending'` — T-438 non-terminal placeholder kind
  (disclosed conservatively; the renderer filters placeholders
  upstream)

Returns `false` for `'imported'` and unknown / undefined kinds.

### Outputs

When the tenant has opted in AND ≥1 AI element is present, the
orchestrator emits:

1. **`AiContentManifest`** (returned as `result.aiContent`; hosts
   write to `ai-content.json` alongside each MP4):

   ```ts
   interface AiContentManifest {
     readonly elements: readonly AiContentManifestElement[];
     readonly watermark: {
       readonly enabled: boolean;
       readonly text: string;
       readonly position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
       readonly opacity: number;
     };
   }

   interface AiContentManifestElement {
     readonly elementId: string;
     readonly provider: string;       // 'tts-kokoro' / etc.; 'unknown' when absent
     readonly modality: MediaProvenanceKind;
     readonly cacheKey?: string;
     readonly prompt?: string;
     readonly frameRange?: { startFrame: number; endFrame: number };
   }
   ```

2. **`AiWatermarkPlan`** (returned as `result.watermarkPlan`;
   consumed by the `VariantRenderer`):

   ```ts
   interface AiWatermarkPlan {
     readonly config: AiWatermarkConfig;
     readonly frameRanges: readonly { startFrame: number; endFrame: number }[];
   }
   ```

   `frameRanges` is sorted ascending and non-overlapping (merged via
   `mergeFrameRanges`). Touching ranges
   (`endFrame_a === startFrame_b`) join. Rows whose `frameRange` is
   absent collapse to `[{0..MAX_SAFE_INTEGER}]` (always-on for the
   entire timeline).

When the tenant opted out (default) OR no AI elements survive the
filter, both fields are `undefined` and the result collapses to
`{ multiAspect }` — byte-identical to `exportMultiAspectInParallel`.

### Sidecar serialization

`serializeAiContentSidecar(manifest)` returns deterministic UTF-8
JSON bytes:

- Canonical key ordering (host writes don't depend on
  manifest-construction order).
- Two-space indent.
- Trailing newline.
- No `Date.now()` / `Math.random()` (deterministic — two runs of the
  same input produce byte-identical sidecar bytes).

### Tenant configuration

```ts
interface AiWatermarkConfig {
  enabled: boolean;            // master switch; default false (opt-in)
  text: string;                // default 'Made with AI'
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';  // default 'bottom-right'
  opacity: number;             // 0..1; default 0.10
  color: string;               // CSS color; default '#fff'
  fontSize: number;            // px; default 12
}
```

`ProvenanceAwareExportInput.aiWatermark?: Partial<AiWatermarkConfig>`
flows in from the host; the orchestrator merges with
`DEFAULT_AI_WATERMARK`. Setting `enabled: false` (or omitting the
field entirely) suppresses both `aiContent` and `watermarkPlan`.

### Shared types between T-439 and T-440

T-439's `AiContentDisclosure` and T-440's `AiContentManifest` share
~80% of their shape. T-440 deliberately duplicates the per-element
row type (with `frameRange?` added) instead of extracting a shared
package, because:

1. The disclosure summary differs: T-439's
   `disclosure: { ftc, euAiAct }` is ad-tech compliance signaling;
   T-440's `watermark: { enabled, text, position, opacity }` is
   renderer-facing data.
2. Extracting a shared `@stageflip/ai-disclosure-shared` package now
   would block T-440 on a separate refactor PR and increase blast
   radius across two exporters.
3. T-441 (slide exporter) will produce a third near-identical
   surface; at that point a single refactor PR can extract all
   three to a shared package with full test coverage.

The duplication is ~25 LOC of type definitions and the trade-off
favors shipping T-440 cleanly now.

### Back-compat

When `aiWatermark.enabled === false` (default) OR
`aiElements` is absent / empty / contains no AI-kind elements, the
export path is byte-identical to non-AI exports. All 14 existing
`multi-aspect.test.ts` + `concurrency.test.ts` assertions pass
unchanged. The new `aiContent` / `watermarkPlan` fields are
`undefined` in that case.

### §13 statement

T-440 is NOT a structural extension: no schema changes, no new
RIRElement, no new ClipKindBinding field, no compositing changes in
any runtime, no new runtime kind. The render pipeline is unchanged
for non-AI elements and unchanged for AI elements when the tenant
opts out. Render verification N/A — the watermark composition is a
renderer-side concern (the CDP host bundle and bake-tier renderers
consume the plan; T-440 ships only the plan + sidecar + walk).

## Related

- `concepts/display-mode/SKILL.md` — T-439 IAB display
  auto-disclosure (the auto-mark counterpart)
- `profiles/video/SKILL.md` — the StageFlip.Video profile
- `modes/stageflip-video/SKILL.md` — the StageFlip.Video editor
- `concepts/schema/SKILL.md` — `MediaProvenance` definition (T-421 + T-438)
- `concepts/optimistic-placeholders/SKILL.md` — T-438's
  `'asset-gen-pending'` kind
- Regulatory references (tenants opting in for compliance):
  - FTC Endorsement Guides — 16 CFR Part 255
  - EU AI Act Article 50(2) — AI-generated content disclosure
  - China Generative AI Service Measures (2023-08-15)
