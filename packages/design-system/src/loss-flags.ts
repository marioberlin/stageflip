// packages/design-system/src/loss-flags.ts
// Design-system-flavored wrapper around the generic `emitLossFlag` from
// `@stageflip/loss-flags`. Mirrors `@stageflip/import-pptx/src/loss-flags.ts`
// — auto-fills `source: 'design-system'`, looks up per-code default
// severity + category. Three codes per T-249 §"Loss flags taxonomy".

import {
  type LossFlag,
  type LossFlagCategory,
  type LossFlagSeverity,
  emitLossFlag as emitLossFlagGeneric,
} from '@stageflip/loss-flags';
import type { DesignSystemLossFlagCode } from './types.js';

/** Default severity + category per code. */
export const CODE_DEFAULTS: Record<
  DesignSystemLossFlagCode,
  { severity: LossFlagSeverity; category: LossFlagCategory }
> = {
  'LF-DESIGN-SYSTEM-FONT-FETCH-FAILED': { severity: 'error', category: 'font' },
  'LF-DESIGN-SYSTEM-AMBIGUOUS-CLUSTER': { severity: 'warn', category: 'theme' },
  'LF-DESIGN-SYSTEM-COMPONENT-MERGE-FAILED': { severity: 'info', category: 'shape' },
};

/** Inputs for the design-system wrapper. */
export interface EmitLossFlagInput {
  code: DesignSystemLossFlagCode;
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
 * Build a design-system `LossFlag` with a deterministic id. Thin wrapper:
 * looks up the per-code default severity + category, then delegates to the
 * generic emitter. `source` is hard-coded to `'design-system'`.
 */
export function emitLossFlag(input: EmitLossFlagInput): LossFlag {
  const defaults = CODE_DEFAULTS[input.code];
  return emitLossFlagGeneric({
    source: 'design-system',
    code: input.code,
    severity: input.severity ?? defaults.severity,
    category: input.category ?? defaults.category,
    message: input.message,
    location: input.location,
    ...(input.recovery !== undefined ? { recovery: input.recovery } : {}),
    ...(input.originalSnippet !== undefined ? { originalSnippet: input.originalSnippet } : {}),
  });
}
