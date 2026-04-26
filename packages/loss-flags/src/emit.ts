// packages/loss-flags/src/emit.ts
// Generic deterministic LossFlag emitter. Pure: no Date, no random, no I/O.
// Hash uses node's built-in `node:crypto` createHash (deterministic). Per
// `skills/stageflip/concepts/loss-flags/SKILL.md`, ids are content-derived so
// re-importing the same source produces the same flag set.
//
// Importers wrap this with their own per-source defaults (severity / category
// per code). See `@stageflip/import-pptx`'s `emitLossFlag` for the pattern.

import { createHash } from 'node:crypto';
import type { LossFlag, LossFlagCategory, LossFlagSeverity, LossFlagSource } from './types.js';

/**
 * Inputs accepted by the generic `emitLossFlag`. Importers pass `source`,
 * `severity`, and `category` explicitly; PPTX-style wrappers default these
 * from a per-code lookup before delegating here.
 */
export interface EmitLossFlagInput {
  source: LossFlagSource;
  code: string;
  severity: LossFlagSeverity;
  category: LossFlagCategory;
  message: string;
  location: LossFlag['location'];
  recovery?: string;
  originalSnippet?: string;
}

/**
 * Build a `LossFlag` with a deterministic id. Formula:
 *
 *   sha256(source + code + slideId + elementId + oocxmlPath + originalSnippet).slice(0, 12)
 *
 * Fields are joined by `\u0001` (U+0001 START OF HEADING) so distinct field
 * partitions can never collide on string boundaries. The id stays stable
 * across re-imports of the same source, which the concept skill calls out as
 * a non-negotiable.
 */
export function emitLossFlag(input: EmitLossFlagInput): LossFlag {
  const idMaterial = [
    input.source,
    input.code,
    input.location.slideId ?? '',
    input.location.elementId ?? '',
    input.location.oocxmlPath ?? '',
    input.originalSnippet ?? '',
  ].join('\u0001');
  const id = createHash('sha256').update(idMaterial).digest('hex').slice(0, 12);

  const flag: LossFlag = {
    id,
    source: input.source,
    code: input.code,
    severity: input.severity,
    category: input.category,
    location: input.location,
    message: input.message,
  };
  if (input.recovery !== undefined) flag.recovery = input.recovery;
  if (input.originalSnippet !== undefined) flag.originalSnippet = input.originalSnippet;
  return flag;
}
