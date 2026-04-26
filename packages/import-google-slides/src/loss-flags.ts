// packages/import-google-slides/src/loss-flags.ts
// Google-Slides-flavored wrapper around the generic `emitLossFlag` from
// `@stageflip/loss-flags`. Mirrors the import-pptx wrapper pattern (T-247-loss-flags):
// holds the per-code default severity + category, auto-fills `source: 'gslides'`,
// and forwards everything else verbatim. The wrapper's `EmitLossFlagInput` is
// narrower than the generic emitter's input (omits `source`) so IDE auto-imports
// will be caught by the typechecker rather than silently flipping callsites onto
// the generic emitter.

import {
  type LossFlag,
  type LossFlagCategory,
  type LossFlagSeverity,
  emitLossFlag as emitLossFlagGeneric,
} from '@stageflip/loss-flags';
import type { GSlidesLossFlagCode } from './types.js';

/** Default severity + category bound to each code. T-244 spec §8 table. */
export const CODE_DEFAULTS: Record<
  GSlidesLossFlagCode,
  { severity: LossFlagSeverity; category: LossFlagCategory }
> = {
  'LF-GSLIDES-PADDING-INFERRED': { severity: 'info', category: 'shape' },
  'LF-GSLIDES-FONT-SUBSTITUTED': { severity: 'warn', category: 'font' },
  'LF-GSLIDES-IMAGE-FALLBACK': { severity: 'warn', category: 'media' },
  'LF-GSLIDES-LOW-MATCH-CONFIDENCE': { severity: 'warn', category: 'other' },
  'LF-GSLIDES-PLACEHOLDER-INLINED': { severity: 'warn', category: 'shape' },
  'LF-GSLIDES-TABLE-MERGE-LOST': { severity: 'error', category: 'shape' },
};

/** Inputs accepted by the gslides `emitLossFlag` wrapper. `source` is filled. */
export interface EmitLossFlagInput {
  code: GSlidesLossFlagCode;
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
 * Build a Google-Slides `LossFlag` with a deterministic id. Looks up the
 * per-code default severity + category, then delegates the actual hash +
 * record build to `@stageflip/loss-flags`'s generic `emitLossFlag`.
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
