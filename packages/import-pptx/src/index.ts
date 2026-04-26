// packages/import-pptx/src/index.ts
// @stageflip/import-pptx — public surface. T-240 ships the structural
// parser; T-241a folds group transforms into descendants; T-243 resolves
// image asset bytes through an abstract storage interface. T-242
// (geometries) and T-245 (rasterization) still progressively narrow
// parser-side types into schema types.

export { parsePptx } from './parsePptx.js';
export { emitLossFlag } from './loss-flags.js';
export { accumulateGroupTransforms } from './transforms/accumulate.js';
export {
  AssetResolutionError,
  inferContentType,
  resolveAssets,
} from './assets/index.js';
export type {
  AssetResolutionErrorCode,
  AssetStorage,
} from './assets/index.js';
export { unpackPptx } from './zip.js';
export type { ZipEntries } from './zip.js';
export { PptxParseError } from './types.js';
export type {
  CanonicalSlideTree,
  LossFlag,
  LossFlagCategory,
  LossFlagCode,
  LossFlagSeverity,
  LossFlagSource,
  ParsedAssetRef,
  ParsedElement,
  ParsedGroupElement,
  ParsedImageElement,
  ParsedSlide,
  ParsedVideoElement,
  PptxParseErrorCode,
  UnsupportedShapeElement,
} from './types.js';
export type { EmitLossFlagInput } from './loss-flags.js';
