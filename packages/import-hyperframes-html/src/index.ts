// packages/import-hyperframes-html/src/index.ts
// @stageflip/import-hyperframes-html — public surface. T-247 ships the
// bidirectional importer/exporter for the Hyperframes producer-side HTML
// format. Output of `parseHyperframes` is a canonical Document with
// `content.mode === 'video'`; `exportHyperframes` walks the inverse path.

export { parseHyperframes } from './parseHyperframes.js';
export { exportHyperframes } from './exportHyperframes.js';
export { emitLossFlag, CODE_DEFAULTS } from './loss-flags.js';
export type { EmitLossFlagInput } from './loss-flags.js';
export { extractTranscript } from './captions/extract.js';
export type { TranscriptExtraction } from './captions/extract.js';
export { emitTranscriptScript } from './captions/emit.js';
export { classifyTrackKind } from './tracks/classify.js';
export type { ClassifyInput } from './tracks/classify.js';
export {
  parseInlineStyle,
  serializeInlineStyle,
  parsePxLength,
  parseTransform,
} from './dom/inline-style.js';
export type { ParsedTransform } from './dom/inline-style.js';
export type {
  AssetReader,
  ExportHyperframesOptions,
  ExportHyperframesResult,
  ExportOutputMode,
  HfhtmlLossFlagCode,
  ParseHyperframesOptions,
  ParseHyperframesResult,
  ParsedAssetRef,
  ParsedAudioElement,
  ParsedImageElement,
  ParsedVideoElement,
} from './types.js';
export type { LossFlag } from '@stageflip/loss-flags';
