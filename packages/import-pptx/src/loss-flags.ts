// packages/import-pptx/src/loss-flags.ts
// Emits LossFlag records keyed by deterministic content-hash ids per the
// concept skill. Pure: no Date, no random, no I/O. Hash uses node's
// `node:crypto` createHash, which is deterministic.

import { createHash } from 'node:crypto';
import type { LossFlag, LossFlagCategory, LossFlagCode, LossFlagSeverity } from './types.js';

/** Lookup table for the default severity + category bound to each code. */
const CODE_DEFAULTS: Record<
  LossFlagCode,
  { severity: LossFlagSeverity; category: LossFlagCategory }
> = {
  'LF-PPTX-CUSTOM-GEOMETRY': { severity: 'warn', category: 'shape' },
  'LF-PPTX-PRESET-GEOMETRY': { severity: 'info', category: 'shape' },
  'LF-PPTX-UNRESOLVED-ASSET': { severity: 'info', category: 'media' },
  'LF-PPTX-UNSUPPORTED-ELEMENT': { severity: 'warn', category: 'other' },
  'LF-PPTX-UNSUPPORTED-FILL': { severity: 'info', category: 'theme' },
  'LF-PPTX-NOTES-DROPPED': { severity: 'info', category: 'other' },
};

/** Inputs accepted by `emitLossFlag`. Required fields stay tight. */
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
 * Build a `LossFlag` with a deterministic id. Formula:
 *
 *   sha256("pptx" + code + slideId + elementId + oocxmlPath + originalSnippet).slice(0, 12)
 *
 * The id stays stable across re-imports of the same PPTX, which the concept
 * skill calls out as a non-negotiable.
 */
export function emitLossFlag(input: EmitLossFlagInput): LossFlag {
  const defaults = CODE_DEFAULTS[input.code];
  const severity: LossFlagSeverity = input.severity ?? defaults.severity;
  const category: LossFlagCategory = input.category ?? defaults.category;

  const idMaterial = [
    'pptx',
    input.code,
    input.location.slideId ?? '',
    input.location.elementId ?? '',
    input.location.oocxmlPath ?? '',
    input.originalSnippet ?? '',
  ].join('\u0001');
  const id = createHash('sha256').update(idMaterial).digest('hex').slice(0, 12);

  const flag: LossFlag = {
    id,
    source: 'pptx',
    code: input.code,
    severity,
    category,
    location: input.location,
    message: input.message,
  };
  if (input.recovery !== undefined) flag.recovery = input.recovery;
  if (input.originalSnippet !== undefined) flag.originalSnippet = input.originalSnippet;
  return flag;
}
