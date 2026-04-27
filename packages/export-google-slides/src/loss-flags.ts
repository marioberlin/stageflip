// packages/export-google-slides/src/loss-flags.ts
// Google-Slides-export-flavored wrapper around `@stageflip/loss-flags`. Holds
// the per-code default severity + category, auto-fills `source: 'gslides'`
// (spec §8 reuses T-244's source value), and forwards everything else
// verbatim. Mirrors the import-google-slides + export-pptx wrappers.

import {
  type LossFlag,
  type LossFlagCategory,
  type LossFlagSeverity,
  emitLossFlag as emitLossFlagGeneric,
} from '@stageflip/loss-flags';
import type { GSlidesExportLossFlagCode } from './types.js';

/** Default severity + category bound to each code. T-252 spec §8 table. */
export const CODE_DEFAULTS: Record<
  GSlidesExportLossFlagCode,
  { severity: LossFlagSeverity; category: LossFlagCategory }
> = {
  'LF-GSLIDES-EXPORT-FALLBACK': { severity: 'warn', category: 'media' },
  'LF-GSLIDES-EXPORT-API-ERROR': { severity: 'error', category: 'other' },
  'LF-GSLIDES-EXPORT-CONVERGENCE-STALLED': { severity: 'warn', category: 'other' },
  'LF-GSLIDES-EXPORT-ANIMATIONS-DROPPED': { severity: 'info', category: 'animation' },
  'LF-GSLIDES-EXPORT-NOTES-DROPPED': { severity: 'info', category: 'other' },
  'LF-GSLIDES-EXPORT-FONT-SUBSTITUTED': { severity: 'warn', category: 'font' },
  'LF-GSLIDES-EXPORT-TABLE-ROTATION-LOST': { severity: 'warn', category: 'shape' },
  'LF-GSLIDES-EXPORT-CUSTOM-GEOMETRY-DEGRADED': { severity: 'warn', category: 'shape' },
};

/** Inputs accepted by the gslides-export `emitLossFlag` wrapper. */
export interface EmitLossFlagInput {
  code: GSlidesExportLossFlagCode;
  message: string;
  location: {
    slideId?: string;
    elementId?: string;
    oocxmlPath?: string;
  };
  /** Override the default severity bound to `code`. Rare. */
  severity?: LossFlagSeverity;
  /** Override the default category bound to `code`. Rare. */
  category?: LossFlagCategory;
  recovery?: string;
  originalSnippet?: string;
}

/**
 * Build a Google-Slides-export `LossFlag` with a deterministic id. Looks up
 * the per-code defaults, then delegates the hash + record build to the
 * generic `emitLossFlag`. Source is always `'gslides'` per spec §8.
 */
export function emitLossFlag(input: EmitLossFlagInput): LossFlag {
  const defaults = CODE_DEFAULTS[input.code];
  return emitLossFlagGeneric({
    source: 'gslides',
    code: input.code,
    severity: input.severity ?? defaults.severity,
    category: input.category ?? defaults.category,
    message: input.message,
    location: input.location,
    ...(input.recovery !== undefined ? { recovery: input.recovery } : {}),
    ...(input.originalSnippet !== undefined ? { originalSnippet: input.originalSnippet } : {}),
  });
}
