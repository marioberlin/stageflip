// packages/export-pptx/src/loss-flags.ts
// Export-pptx-flavored wrapper around the generic `emitLossFlag` from
// `@stageflip/loss-flags`. Holds the per-code default severity + category,
// auto-fills `source: 'pptx-export'`, and forwards everything else verbatim.
// Mirrors the importer-side wrapper in `@stageflip/import-pptx/src/loss-flags.ts`.

import {
  type LossFlag,
  type LossFlagCategory,
  type LossFlagSeverity,
  emitLossFlag as emitLossFlagGeneric,
} from '@stageflip/loss-flags';
import type { ExportPptxLossFlagCode } from './types.js';

/** Lookup table for the default severity + category bound to each code. */
export const CODE_DEFAULTS: Record<
  ExportPptxLossFlagCode,
  { severity: LossFlagSeverity; category: LossFlagCategory }
> = {
  'LF-PPTX-EXPORT-UNSUPPORTED-ELEMENT': { severity: 'warn', category: 'other' },
  'LF-PPTX-EXPORT-ASSET-MISSING': { severity: 'error', category: 'media' },
  'LF-PPTX-EXPORT-CUSTOM-GEOMETRY-DEGRADED': { severity: 'warn', category: 'shape' },
  'LF-PPTX-EXPORT-ANIMATIONS-DROPPED': { severity: 'info', category: 'animation' },
  'LF-PPTX-EXPORT-NOTES-DROPPED': { severity: 'info', category: 'other' },
  'LF-PPTX-EXPORT-THEME-FLATTENED': { severity: 'info', category: 'theme' },
};

/**
 * Inputs accepted by the export-pptx `emitLossFlag` wrapper. `source` /
 * `severity` / `category` are filled by the wrapper; export callsites only
 * supply the `code` (which selects defaults), the message, and the location.
 */
export interface EmitLossFlagInput {
  code: ExportPptxLossFlagCode;
  message: string;
  location: {
    slideId?: string;
    elementId?: string;
    oocxmlPath?: string;
  };
  severity?: LossFlagSeverity;
  category?: LossFlagCategory;
  recovery?: string;
  originalSnippet?: string;
}

/**
 * Build a PPTX-export `LossFlag` with a deterministic id. Looks up the per-code
 * default severity + category, then delegates to `@stageflip/loss-flags`'s
 * generic `emitLossFlag`. Source is always `'pptx-export'`.
 */
export function emitLossFlag(input: EmitLossFlagInput): LossFlag {
  const defaults = CODE_DEFAULTS[input.code];
  return emitLossFlagGeneric({
    source: 'pptx-export',
    code: input.code,
    severity: input.severity ?? defaults.severity,
    category: input.category ?? defaults.category,
    message: input.message,
    location: input.location,
    ...(input.recovery !== undefined ? { recovery: input.recovery } : {}),
    ...(input.originalSnippet !== undefined ? { originalSnippet: input.originalSnippet } : {}),
  });
}
