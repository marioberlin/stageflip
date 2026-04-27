// packages/import-google-slides/src/aiqc/response-validator.ts
// Zod-based validator for Gemini's structured JSON response. Strips common
// markdown fences (```json ... ```), parses the inner JSON, and validates
// shape. Produces a discriminated union { ok: true, value } | { ok: false,
// errorCode } so callers can branch without try/catch.

import { z } from 'zod';
import type { AiQcErrorCode, GeminiResolutionResponse } from './types.js';

export const geminiResolutionSchema = z
  .object({
    confidence: z.number().min(0).max(1),
    resolvedKind: z.enum(['text', 'shape', 'image', 'group', 'table', 'other']),
    text: z.string().nullable(),
    fillColor: z.string().nullable(),
    shapeKind: z.enum(['rect', 'rounded-rect', 'ellipse', 'line', 'polygon', 'star']).nullable(),
    cornerRadiusPx: z.number().nonnegative().optional(),
    reasoning: z.string(),
  })
  .strict();

export type ParseResult =
  | { ok: true; value: GeminiResolutionResponse }
  | { ok: false; errorCode: AiQcErrorCode; reason: string };

const FENCE_RE = /^```(?:[a-zA-Z]+)?\s*\n([\s\S]*?)\n```\s*$/;

/**
 * Strip common markdown code-fence wrappers Gemini sometimes adds around JSON.
 * Returns the inner text trimmed when fences are present, otherwise the
 * trimmed input verbatim.
 */
export function stripMarkdownFences(raw: string): string {
  const trimmed = raw.trim();
  const fenced = FENCE_RE.exec(trimmed);
  if (fenced && fenced[1] !== undefined) return fenced[1].trim();
  return trimmed;
}

/**
 * Parse + validate a model-emitted text block as a `GeminiResolutionResponse`.
 * Failures map onto a typed `errorCode` so the caller's `AiQcResolution.outcome`
 * can be set deterministically.
 */
export function parseGeminiResolution(rawText: string): ParseResult {
  const stripped = stripMarkdownFences(rawText);
  let json: unknown;
  try {
    json = JSON.parse(stripped);
  } catch (err) {
    return {
      ok: false,
      errorCode: 'MALFORMED_RESPONSE',
      reason: `JSON parse failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
  const parsed = geminiResolutionSchema.safeParse(json);
  if (!parsed.success) {
    return {
      ok: false,
      errorCode: 'MALFORMED_RESPONSE',
      reason: parsed.error.message,
    };
  }
  return { ok: true, value: parsed.data };
}
