// packages/export-video/src/index.ts
// @stageflip/export-video — video export entry points.
// T-186: multi-aspect parallel export orchestrator. Real renderer
// bindings (CDP host bundle, bake tier) plug in behind
// `VariantRenderer`; this package owns the orchestration only.
// T-440: provenance-aware export — opt-in AI watermark plan +
// `ai-content.json` sidecar layered on top of the multi-aspect
// orchestrator.

export type {
  AiContentManifest,
  AiContentManifestElement,
  AiVideoElementInputRow,
  AiWatermarkConfig,
  AiWatermarkPlan,
  FrameRange,
  MultiAspectExportOptions,
  MultiAspectExportResult,
  ProvenanceAwareExportInput,
  ProvenanceAwareExportResult,
  VariantOutcome,
  VariantRenderOutput,
  VariantRenderRequest,
  VariantRenderer,
  VariantTarget,
} from './types.js';

export { mapWithConcurrency } from './concurrency.js';
export { exportMultiAspectInParallel } from './multi-aspect.js';
export { exportProvenanceAware } from './provenance-aware.js';
export {
  DEFAULT_AI_WATERMARK,
  buildWatermarkPlan,
  mergeFrameRanges,
  serializeAiContentSidecar,
} from './ai-watermark.js';
export { classifyAiKind, extractAiContentManifest } from './provenance-walk.js';
