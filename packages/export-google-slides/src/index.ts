// packages/export-google-slides/src/index.ts
// @stageflip/export-google-slides — public surface. T-252 ships:
//   - `exportGoogleSlides(doc, opts) => Promise<ExportGoogleSlidesResult>`
//   - `ExportTier` / `ExportGoogleSlidesOptions` / `ExportGoogleSlidesResult`
//   - `RendererCdpProvider` interface + `createStubRenderer` for tests
//   - `GSlidesExportLossFlagCode` union + emitLossFlag wrapper
//   - `SlidesMutationClient` interface + `createDefaultMutationClient`

export { exportGoogleSlides } from './exportGoogleSlides.js';

export type {
  ConvergenceTolerances,
  ExportGoogleSlidesOptions,
  ExportGoogleSlidesResult,
  ExportTier,
  GSlidesExportLossFlagCode,
  RendererCdpProvider,
  SlideExportOutcome,
} from './types.js';
export { DEFAULT_MAX_ITERATIONS, DEFAULT_TIER, DEFAULT_TOLERANCES } from './types.js';

export { CODE_DEFAULTS, emitLossFlag } from './loss-flags.js';
export type { EmitLossFlagInput } from './loss-flags.js';

export { createStubRenderer } from './renderer/stub.js';
export type { StubRendererOptions } from './renderer/stub.js';

export { createDefaultMutationClient } from './api/client.js';
export type { SlidesMutationClient, DefaultMutationClientOptions } from './api/client.js';

export type {
  BatchUpdateRequest,
  BatchUpdateResponse,
  CreatePresentationResponse,
  DriveFileCreateResponse,
  CreateShapeRequest,
  CreateImageRequest,
  CreateTableRequest,
  InsertTextRequest,
  UpdateShapePropertiesRequest,
  UpdateTextStyleRequest,
  DuplicateObjectRequest,
  DeleteObjectRequest,
  GroupObjectsRequest,
  MergeTableCellsRequest,
  UpdatePageElementTransformRequest,
} from './api/types.js';

export { buildPlan } from './plan/build-plan.js';
export type { PlannedRequest, PlannedSlide, EmissionStrategy } from './plan/build-plan.js';

export { findSimilarObject, similarity } from './plan/preference.js';

export { computeDiff } from './convergence/diff.js';
export type { ElementDiff, SlideDiff, ObservedBbox } from './convergence/diff.js';

export { planAdjustments } from './convergence/adjust.js';

export { runConvergenceLoop } from './convergence/run-loop.js';
export type { RunLoopInput, RunLoopResult } from './convergence/run-loop.js';

export { imageFallbackForResidual } from './fallback/image-fallback.js';
export type { ImageFallbackInput, ImageFallbackResult } from './fallback/image-fallback.js';
