// packages/export-pptx/src/types.ts
// Public types for the PPTX writer. The `ExportPptxLossFlagCode` union is the
// closed enum of codes the exporter raises; the canonical `LossFlag` shape's
// `code` field is `string` (open) so this stays a writer-local enum.

import type { LossFlag } from '@stageflip/loss-flags';
import type { AssetReader } from './assets/types.js';

/**
 * Stable machine-readable identifiers for every PPTX-export-specific lossy
 * situation. Mirrors the importer's `LossFlagCode` pattern in
 * `@stageflip/import-pptx/src/types.ts`.
 */
export type ExportPptxLossFlagCode =
  | 'LF-PPTX-EXPORT-UNSUPPORTED-ELEMENT'
  | 'LF-PPTX-EXPORT-ASSET-MISSING'
  | 'LF-PPTX-EXPORT-CUSTOM-GEOMETRY-DEGRADED'
  | 'LF-PPTX-EXPORT-ANIMATIONS-DROPPED'
  | 'LF-PPTX-EXPORT-NOTES-DROPPED'
  | 'LF-PPTX-EXPORT-THEME-FLATTENED'
  | 'LF-PPTX-EXPORT-IMAGE-BACKGROUND-FALLBACK'
  | 'LF-PPTX-EXPORT-LAYOUT-NOT-FOUND'
  | 'LF-PPTX-EXPORT-PLACEHOLDER-NOT-FOUND'
  | 'LF-PPTX-EXPORT-PLACEHOLDER-MISMATCH';

/** Result of a successful `exportPptx` invocation. */
export interface ExportPptxResult {
  /** ZIP bytes of the PPTX file. */
  bytes: Uint8Array;
  /** Loss flags emitted during export. Empty on a perfect round-trip. */
  lossFlags: LossFlag[];
}

/** Options for `exportPptx`. */
export interface ExportPptxOptions {
  /** Provides bytes for AssetRef inputs. Required when the document has any image element. */
  assets?: AssetReader;
  /** Override the embedded creator string. Default: 'StageFlip'. */
  creator?: string;
  /**
   * Stable timestamp for ZIP entries (overrides `new Date()` inside the writer).
   * When omitted the writer uses a frozen Unix epoch
   * (`new Date('2024-01-01T00:00:00Z')`) so two consecutive exports with no
   * `modifiedAt` are byte-identical.
   */
  modifiedAt?: Date;
}

/** The frozen-epoch fallback when `opts.modifiedAt` is omitted. */
export const FROZEN_EPOCH = new Date('2024-01-01T00:00:00Z');
