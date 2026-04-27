// packages/import-hyperframes-html/src/loss-flags.ts
// Hyperframes-HTML-flavored wrapper around the generic `emitLossFlag` from
// `@stageflip/loss-flags`. Mirrors the wrapper shape in
// `@stageflip/import-pptx/src/loss-flags.ts`: holds the per-LossFlagCode
// default severity + category, auto-fills `source: 'hyperframes-html'`, and
// forwards everything else verbatim. The narrowed `EmitLossFlagInput` keeps
// callsites typed: `source` / `severity` / `category` are filled by the
// wrapper so accidental imports of the generic emitter (e.g. via IDE
// auto-import) surface as type errors rather than silent override. Per T-247
// AC #26 / #27 the source is the long-form `'hyperframes-html'`, matching
// PPTX/GSLIDES precedent.

import {
  type LossFlag,
  type LossFlagCategory,
  type LossFlagSeverity,
  emitLossFlag as emitLossFlagGeneric,
} from '@stageflip/loss-flags';
import type { HfhtmlLossFlagCode } from './types.js';

/**
 * Lookup table for the default severity + category bound to each code. The
 * AC #27 enumeration test pins the closed shape — every union variant maps.
 */
export const CODE_DEFAULTS: Record<
  HfhtmlLossFlagCode,
  { severity: LossFlagSeverity; category: LossFlagCategory }
> = {
  'LF-HYPERFRAMES-HTML-CLASS-STYLE-LOST': { severity: 'warn', category: 'theme' },
  'LF-HYPERFRAMES-HTML-ANIMATIONS-DROPPED': { severity: 'info', category: 'animation' },
  'LF-HYPERFRAMES-HTML-CAPTIONS-UNRECOGNIZED': { severity: 'warn', category: 'other' },
  'LF-HYPERFRAMES-HTML-UNSUPPORTED-ELEMENT': { severity: 'warn', category: 'other' },
  'LF-HYPERFRAMES-HTML-DIMENSION-INFERRED': { severity: 'info', category: 'shape' },
  'LF-HYPERFRAMES-HTML-ASSET-MISSING': { severity: 'error', category: 'media' },
};

/**
 * Inputs accepted by the Hyperframes-HTML wrapper. `source` is auto-filled to
 * `'hyperframes-html'`; `severity` and `category` are looked up from
 * CODE_DEFAULTS unless overridden.
 */
export interface EmitLossFlagInput {
  code: HfhtmlLossFlagCode;
  message: string;
  location: {
    /** Track id when the loss is per-track. */
    slideId?: string;
    /** Element id when the loss is per-element. */
    elementId?: string;
    /** Source-document path (e.g. composition-src URL). */
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
 * Build a Hyperframes-HTML `LossFlag` with a deterministic id. Thin wrapper:
 * looks up the per-code default severity + category, then delegates to the
 * generic `emitLossFlag` from `@stageflip/loss-flags`. Identical formula to
 * the PPTX wrapper — the resulting `id` partitions cleanly across importers
 * because `source` is one of the hash inputs.
 */
export function emitLossFlag(input: EmitLossFlagInput): LossFlag {
  const defaults = CODE_DEFAULTS[input.code];
  return emitLossFlagGeneric({
    source: 'hyperframes-html',
    code: input.code,
    severity: input.severity ?? defaults.severity,
    category: input.category ?? defaults.category,
    message: input.message,
    location: input.location,
    ...(input.recovery !== undefined ? { recovery: input.recovery } : {}),
    ...(input.originalSnippet !== undefined ? { originalSnippet: input.originalSnippet } : {}),
  });
}
