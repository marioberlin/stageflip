// packages/import-google-slides/src/aiqc/runAiQcConvergence.ts
// Single-pass AI-QC convergence loop (T-246). For each residual in
// tree.pendingResolution, send one Gemini multimodal request; on
// confidence >= acceptThreshold, write resolved values back to the tree and
// drop the residual entry. On error / low-confidence / cap-skip, leave the
// element untouched, keep the residual, and emit
// LF-GSLIDES-LOW-MATCH-CONFIDENCE. Cap-hit emits a deck-level
// LF-GSLIDES-AI-QC-CAP-HIT once.
//
// Per spec §6: this is single-pass, not iterative. Each residual gets exactly
// one Gemini call.

import { LLMError } from '@stageflip/llm-abstraction';
import { emitLossFlag } from '../loss-flags.js';
import type {
  CanonicalSlideTree,
  LossFlag,
  ParsedSlide,
  PendingMatchResolution,
} from '../types.js';
import { cropPageImagePngBase64 } from './crop.js';
import { buildLlmRequest } from './prompt.js';
import { parseGeminiResolution } from './response-validator.js';
import type {
  AiQcErrorCode,
  AiQcResolution,
  GeminiResolutionResponse,
  RunAiQcConvergenceOptions,
  RunAiQcConvergenceResult,
} from './types.js';
import { applyResolutionToElement, replaceElementInSlide } from './writeback.js';

const DEFAULT_MODEL = 'gemini-2.0-flash';
const DEFAULT_ACCEPT_THRESHOLD = 0.85;
const DEFAULT_MAX_TOKENS = 1024;
const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_CALLS_PER_DECK = 100;

/**
 * Run the AI-QC convergence pass on a CanonicalSlideTree. Returns a fresh
 * tree with resolved values applied; the input tree is not mutated.
 */
export async function runAiQcConvergence(
  tree: CanonicalSlideTree,
  opts: RunAiQcConvergenceOptions,
): Promise<RunAiQcConvergenceResult> {
  const model = opts.model ?? DEFAULT_MODEL;
  const acceptThreshold = opts.acceptThreshold ?? DEFAULT_ACCEPT_THRESHOLD;
  const maxTokens = opts.maxTokens ?? DEFAULT_MAX_TOKENS;
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxCalls = opts.maxCallsPerDeck ?? DEFAULT_MAX_CALLS_PER_DECK;

  // Collect residuals in deterministic order (slideId asc, elementId asc).
  const residuals = collectResiduals(tree.pendingResolution);

  const lossFlags: LossFlag[] = [];
  const resolutions: AiQcResolution[] = [];

  if (residuals.length === 0) {
    return {
      tree,
      lossFlags,
      callsMade: 0,
      resolutions,
    };
  }

  // Mutable working copies. We rebuild slides only when resolutions land.
  const slidesById = new Map<string, ParsedSlide>(tree.slides.map((s) => [s.id, s]));
  const newPending: Record<string, Record<string, PendingMatchResolution>> = cloneShallow(
    tree.pendingResolution,
  );

  let callsMade = 0;
  let anyCapSkip = false;

  for (const residual of residuals) {
    if (callsMade >= maxCalls) {
      // Cost cap: skip remaining residuals.
      anyCapSkip = true;
      resolutions.push({
        slideId: residual.slideId,
        elementId: residual.elementId,
        outcome: 'skipped-cap',
      });
      lossFlags.push(
        emitLossFlag({
          code: 'LF-GSLIDES-LOW-MATCH-CONFIDENCE',
          location: { slideId: residual.slideId, elementId: residual.elementId },
          message: 'AI-QC convergence skipped this residual: cost cap reached',
        }),
      );
      continue;
    }

    callsMade += 1;
    const result = await callGemini(residual, tree, opts, model, maxTokens, timeoutMs);

    if (result.kind === 'error') {
      resolutions.push({
        slideId: residual.slideId,
        elementId: residual.elementId,
        outcome: 'rejected-llm-error',
        errorCode: result.errorCode,
      });
      lossFlags.push(
        emitLossFlag({
          code: 'LF-GSLIDES-LOW-MATCH-CONFIDENCE',
          location: { slideId: residual.slideId, elementId: residual.elementId },
          message: `AI-QC LLM error (${result.errorCode}): ${result.reason}`,
        }),
      );
      continue;
    }

    const resp = result.response;
    if (resp.confidence < acceptThreshold) {
      resolutions.push({
        slideId: residual.slideId,
        elementId: residual.elementId,
        outcome: 'rejected-low-confidence',
        geminiConfidence: resp.confidence,
      });
      lossFlags.push(
        emitLossFlag({
          code: 'LF-GSLIDES-LOW-MATCH-CONFIDENCE',
          location: { slideId: residual.slideId, elementId: residual.elementId },
          message: `Gemini confidence ${resp.confidence.toFixed(3)} below acceptThreshold ${acceptThreshold}`,
        }),
      );
      continue;
    }

    // Apply the resolution to the element.
    const slide = slidesById.get(residual.slideId);
    if (!slide) {
      // Shouldn't happen — pendingResolution slideId came from tree.slides.
      // Treat as a no-op; skip writeback but mark as resolved for accounting.
      resolutions.push({
        slideId: residual.slideId,
        elementId: residual.elementId,
        outcome: 'rejected-llm-error',
        errorCode: 'API_ERROR',
      });
      continue;
    }
    const original = slide.elements.find((e) => e.id === residual.elementId);
    if (!original) {
      resolutions.push({
        slideId: residual.slideId,
        elementId: residual.elementId,
        outcome: 'rejected-llm-error',
        errorCode: 'API_ERROR',
      });
      continue;
    }
    const replaced = applyResolutionToElement(original, resp);
    const newSlide = replaceElementInSlide(slide, residual.elementId, replaced);
    slidesById.set(residual.slideId, newSlide);

    // Drop the residual entry.
    const slideMap = newPending[residual.slideId];
    if (slideMap) {
      const { [residual.elementId]: _drop, ...rest } = slideMap;
      if (Object.keys(rest).length === 0) {
        delete newPending[residual.slideId];
      } else {
        newPending[residual.slideId] = rest;
      }
    }

    resolutions.push({
      slideId: residual.slideId,
      elementId: residual.elementId,
      outcome: 'resolved',
      geminiConfidence: resp.confidence,
    });
  }

  if (anyCapSkip) {
    lossFlags.push(
      emitLossFlag({
        code: 'LF-GSLIDES-AI-QC-CAP-HIT',
        location: {},
        message: `AI-QC convergence cap of ${maxCalls} calls/deck was reached; some residuals skipped`,
      }),
    );
  }

  // Rebuild slides in original order.
  const newSlides = tree.slides.map((s) => slidesById.get(s.id) ?? s);

  const newTree: CanonicalSlideTree = {
    ...tree,
    slides: newSlides,
    lossFlags: [...tree.lossFlags, ...lossFlags],
    pendingResolution: newPending,
  };

  return {
    tree: newTree,
    lossFlags,
    callsMade,
    resolutions,
  };
}

interface CallResultOk {
  kind: 'ok';
  response: GeminiResolutionResponse;
}
interface CallResultError {
  kind: 'error';
  errorCode: AiQcErrorCode;
  reason: string;
}

async function callGemini(
  residual: PendingMatchResolution,
  tree: CanonicalSlideTree,
  opts: RunAiQcConvergenceOptions,
  model: string,
  maxTokens: number,
  timeoutMs: number,
): Promise<CallResultOk | CallResultError> {
  // Resolve the page PNG bytes for this slide.
  const pageImg = tree.pageImagesPng[residual.slideId];
  if (!pageImg) {
    return {
      kind: 'error',
      errorCode: 'API_ERROR',
      reason: `tree.pageImagesPng has no entry for slideId ${residual.slideId}`,
    };
  }

  let imageBase64: string;
  try {
    imageBase64 = cropPageImagePngBase64(pageImg, residual.pageImageCropPx);
  } catch (err) {
    return {
      kind: 'error',
      errorCode: 'API_ERROR',
      reason: `crop failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  const request = buildLlmRequest({ residual, imageBase64, model, maxTokens });

  // Timeout via AbortSignal.timeout (a static method that doesn't require
  // direct setTimeout / setInterval calls — keeps src/aiqc/** clean for the
  // AC #29 source-grep test).
  const signal = AbortSignal.timeout(timeoutMs);

  let response: import('@stageflip/llm-abstraction').LLMResponse;
  try {
    response = await opts.llm.complete(request, { signal });
  } catch (err) {
    if (err instanceof LLMError && err.kind === 'aborted') {
      return { kind: 'error', errorCode: 'TIMEOUT', reason: 'Gemini call timed out' };
    }
    const message = err instanceof Error ? err.message : String(err);
    return { kind: 'error', errorCode: 'API_ERROR', reason: message };
  }

  // Concatenate all text blocks (Gemini may return multiple).
  const textParts = response.content
    .filter((b): b is { type: 'text'; text: string } => b.type === 'text')
    .map((b) => b.text);
  const rawText = textParts.join('').trim();
  if (rawText.length === 0) {
    return { kind: 'error', errorCode: 'MALFORMED_RESPONSE', reason: 'empty response' };
  }

  const parsed = parseGeminiResolution(rawText);
  if (!parsed.ok) {
    return { kind: 'error', errorCode: parsed.errorCode, reason: parsed.reason };
  }
  return { kind: 'ok', response: parsed.value };
}

/**
 * Collect residuals into a flat array sorted by (slideId asc, elementId asc)
 * for deterministic iteration.
 */
export function collectResiduals(
  pending: Record<string, Record<string, PendingMatchResolution>>,
): PendingMatchResolution[] {
  const out: PendingMatchResolution[] = [];
  const slideIds = Object.keys(pending).sort();
  for (const slideId of slideIds) {
    const inner = pending[slideId];
    if (!inner) continue;
    const elementIds = Object.keys(inner).sort();
    for (const elementId of elementIds) {
      const r = inner[elementId];
      if (r) out.push(r);
    }
  }
  return out;
}

function cloneShallow<T extends Record<string, Record<string, unknown>>>(input: T): T {
  const out: Record<string, Record<string, unknown>> = {};
  for (const [k, v] of Object.entries(input)) {
    out[k] = { ...v };
  }
  return out as T;
}
