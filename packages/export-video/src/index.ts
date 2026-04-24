// packages/export-video/src/index.ts
// @stageflip/export-video — video export entry points.
// T-186: multi-aspect parallel export orchestrator. Real renderer
// bindings (CDP host bundle, bake tier) plug in behind
// `VariantRenderer`; this package owns the orchestration only.

export type {
  MultiAspectExportOptions,
  MultiAspectExportResult,
  VariantOutcome,
  VariantRenderOutput,
  VariantRenderRequest,
  VariantRenderer,
  VariantTarget,
} from './types.js';

export { mapWithConcurrency } from './concurrency.js';
export { exportMultiAspectInParallel } from './multi-aspect.js';
