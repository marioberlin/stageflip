// packages/import-pptx/src/index.ts
// @stageflip/import-pptx — public surface. T-240 ships the structural
// parser; T-241a folds group transforms into descendants. T-242 (geometries),
// T-243 (assets), T-245 (rasterization) still progressively narrow
// parser-side types into schema types.

export { parsePptx } from './parsePptx.js';
export { emitLossFlag } from './loss-flags.js';
export { accumulateGroupTransforms } from './transforms/accumulate.js';
export { PptxParseError } from './types.js';
export type {
  CanonicalSlideTree,
  LossFlag,
  LossFlagCategory,
  LossFlagCode,
  LossFlagSeverity,
  ParsedAssetRef,
  ParsedElement,
  ParsedGroupElement,
  ParsedImageElement,
  ParsedSlide,
  PptxParseErrorCode,
  UnsupportedShapeElement,
} from './types.js';
export type { EmitLossFlagInput } from './loss-flags.js';
