// packages/import-pptx/src/loss-flags.ts
// PPTX-flavored wrapper around the generic `emitLossFlag` from
// `@stageflip/loss-flags`. Holds the per-LossFlagCode default severity +
// category, auto-fills `source: 'pptx'`, and forwards everything else
// verbatim. The wrapper's `EmitLossFlagInput` is *narrower* than the
// generic emitter's input (it omits `source` / `severity` / `category`), so
// IDE auto-imports between this and `@stageflip/loss-flags`'s `emitLossFlag`
// will be caught by the typechecker rather than silently flipping callsites
// onto the generic emitter.

import {
  type LossFlag,
  type LossFlagCategory,
  type LossFlagSeverity,
  emitLossFlag as emitLossFlagGeneric,
} from '@stageflip/loss-flags';
import type { LossFlagCode } from './types.js';

/** Lookup table for the default severity + category bound to each code. */
const CODE_DEFAULTS: Record<
  LossFlagCode,
  { severity: LossFlagSeverity; category: LossFlagCategory }
> = {
  'LF-PPTX-CUSTOM-GEOMETRY': { severity: 'warn', category: 'shape' },
  'LF-PPTX-PRESET-GEOMETRY': { severity: 'info', category: 'shape' },
  'LF-PPTX-PRESET-ADJUSTMENT-IGNORED': { severity: 'info', category: 'shape' },
  'LF-PPTX-UNRESOLVED-ASSET': { severity: 'info', category: 'media' },
  'LF-PPTX-MISSING-ASSET-BYTES': { severity: 'error', category: 'media' },
  'LF-PPTX-UNSUPPORTED-ELEMENT': { severity: 'warn', category: 'other' },
  'LF-PPTX-UNSUPPORTED-FILL': { severity: 'info', category: 'theme' },
  'LF-PPTX-NOTES-DROPPED': { severity: 'info', category: 'other' },
};

/**
 * Inputs accepted by the PPTX `emitLossFlag` wrapper. `source` /
 * `severity` / `category` are filled by the wrapper; PPTX callsites only
 * supply the `code` (which selects the defaults) plus the message and
 * location.
 */
export interface EmitLossFlagInput {
  code: LossFlagCode;
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
 * Build a PPTX `LossFlag` with a deterministic id. Thin wrapper: looks up
 * the per-code default severity + category, then delegates the actual hash
 * + record build to `@stageflip/loss-flags`'s generic `emitLossFlag`. The
 * id formula (sha256-12 of source/code/location/originalSnippet, joined by
 * U+0001) is unchanged from the pre-extraction implementation; the
 * T-247-loss-flags PR pins 8 byte-identical fixtures (one per LossFlagCode)
 * to guarantee no drift.
 */
export function emitLossFlag(input: EmitLossFlagInput): LossFlag {
  const defaults = CODE_DEFAULTS[input.code];
  return emitLossFlagGeneric({
    source: 'pptx',
    code: input.code,
    severity: input.severity ?? defaults.severity,
    category: input.category ?? defaults.category,
    message: input.message,
    location: input.location,
    ...(input.recovery !== undefined ? { recovery: input.recovery } : {}),
    ...(input.originalSnippet !== undefined ? { originalSnippet: input.originalSnippet } : {}),
  });
}
