// packages/import-google-slides/src/aiqc/prompt.ts
// Per-residual Gemini multimodal prompt builder. One image block + one text
// block; system prompt is a constant string. The text block embeds the API
// metadata and the top deterministic candidate as JSON.

import type { LLMContentBlock, LLMMessage, LLMRequest } from '@stageflip/llm-abstraction';
import type { PendingMatchResolution } from '../types.js';

export const AIQC_SYSTEM_PROMPT =
  'You are a slide-deck import assistant. You receive a cropped image of one element from a Google Slides page, plus the API metadata for that element. Your job is to identify what the element represents (text content, shape kind, fill color, etc.) and return a structured JSON response matching the provided schema. Be conservative: if you are not sure, return confidence < 0.85 and explain why.';

export const AIQC_RESPONSE_SCHEMA_DESCRIPTION = `Question: provide a JSON response with the resolved element values.
Schema:
{
  confidence: number 0..1,
  resolvedKind: 'text' | 'shape' | 'image' | 'group' | 'table' | 'other',
  text: string | null,
  fillColor: string | null,
  shapeKind: 'rect' | 'rounded-rect' | 'ellipse' | 'line' | 'polygon' | 'star' | null,
  cornerRadiusPx: number (optional, when shapeKind is 'rounded-rect'),
  reasoning: string
}
Return ONLY the JSON object, no surrounding markdown.`;

export interface BuildPromptInput {
  residual: PendingMatchResolution;
  /** Base64-encoded PNG bytes of the per-element crop (already produced upstream). */
  imageBase64: string;
}

/**
 * Build the user-message text block content. Includes the API metadata as JSON
 * and (when available) the deterministic matcher's top candidate. Also embeds
 * the per-element crop bbox so Gemini knows which region of the supplied
 * page image the question is about.
 */
export function buildUserText(residual: PendingMatchResolution): string {
  const top = residual.rankedCandidates[0];
  const topBlock =
    top !== undefined
      ? `\n\nThe deterministic matcher's top candidate was:\n${JSON.stringify(top, null, 2)}`
      : '\n\nThe deterministic matcher had no candidates.';
  const bboxBlock = `\n\nElement bbox in the supplied page image (px):\n${JSON.stringify(residual.pageImageCropPx, null, 2)}`;
  return `API metadata for this element:\n${JSON.stringify(residual.apiElement, null, 2)}${bboxBlock}${topBlock}\n\n${AIQC_RESPONSE_SCHEMA_DESCRIPTION}`;
}

/**
 * Build the per-residual user message: exactly one image block followed by
 * exactly one text block.
 */
export function buildUserMessage(input: BuildPromptInput): LLMMessage {
  const blocks: LLMContentBlock[] = [
    { type: 'image', mediaType: 'image/png', data: input.imageBase64 },
    { type: 'text', text: buildUserText(input.residual) },
  ];
  return { role: 'user', content: blocks };
}

/**
 * Build the full LLMRequest for one residual. Caller picks the model; this
 * helper sets max_tokens, the system prompt, and the user message.
 */
export function buildLlmRequest(args: {
  residual: PendingMatchResolution;
  imageBase64: string;
  model: string;
  maxTokens: number;
}): LLMRequest {
  return {
    model: args.model,
    max_tokens: args.maxTokens,
    system: AIQC_SYSTEM_PROMPT,
    messages: [buildUserMessage({ residual: args.residual, imageBase64: args.imageBase64 })],
  };
}
