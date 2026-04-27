// packages/import-google-slides/src/aiqc/types.ts
// Public types for the AI-QC convergence pass (T-246). Each pending residual
// from T-244's deterministic match becomes one Gemini multimodal call; the
// resolved values are written back into the canonical tree.

import type { LLMProvider } from '@stageflip/llm-abstraction';
import type { CanonicalSlideTree, LossFlag } from '../types.js';

export interface RunAiQcConvergenceOptions {
  /** LLM provider configured for Gemini. Required. */
  llm: LLMProvider;
  /** Gemini model id. Default: 'gemini-2.0-flash' (cost-efficient multimodal). */
  model?: string;
  /**
   * Confidence threshold for accepting a Gemini-resolved value. Default 0.85
   * (higher than T-244's 0.78 deterministic threshold — Gemini needs to be
   * MORE confident than the deterministic matcher was, since this is the
   * fallback).
   */
  acceptThreshold?: number;
  /** Max tokens per Gemini call. Default 1024. */
  maxTokens?: number;
  /** Per-call timeout in ms. Default 30000. */
  timeoutMs?: number;
  /**
   * Cost cap: max Gemini calls across the whole deck. Excess residuals get
   * `LF-GSLIDES-LOW-MATCH-CONFIDENCE` without being attempted. Default 100.
   */
  maxCallsPerDeck?: number;
}

export type AiQcOutcome =
  | 'resolved'
  | 'rejected-low-confidence'
  | 'rejected-llm-error'
  | 'skipped-cap';

export type AiQcErrorCode = 'API_ERROR' | 'MALFORMED_RESPONSE' | 'TIMEOUT';

export interface AiQcResolution {
  slideId: string;
  elementId: string;
  outcome: AiQcOutcome;
  /** Gemini's reported confidence. Undefined when outcome is 'skipped-cap' or 'rejected-llm-error'. */
  geminiConfidence?: number;
  /** Underlying error code when outcome is 'rejected-llm-error'. */
  errorCode?: AiQcErrorCode;
}

export interface RunAiQcConvergenceResult {
  /**
   * Tree with resolved values written back into elements. `pendingResolution`
   * is updated to drop entries that resolved cleanly. The input tree is NOT
   * mutated; this is a fresh value (deep-cloned where needed).
   */
  tree: CanonicalSlideTree;
  /** Loss flags emitted during the convergence pass. */
  lossFlags: LossFlag[];
  /** Number of Gemini calls actually made (may be < #residuals if cap hit). */
  callsMade: number;
  /** Per-element resolution result for auditing / metrics. */
  resolutions: AiQcResolution[];
}

/**
 * Schema-aligned Gemini response shape T-246's prompt asks for. The validator
 * (`response-validator.ts`) parses untrusted model output into this shape.
 */
export interface GeminiResolutionResponse {
  confidence: number;
  resolvedKind: 'text' | 'shape' | 'image' | 'group' | 'table' | 'other';
  text: string | null;
  fillColor: string | null;
  /**
   * Gemini-reported shape kind. Includes `'rounded-rect'` which the writeback
   * layer maps to `{ shape: 'rect', cornerRadius }` per the schema.
   */
  shapeKind: 'rect' | 'rounded-rect' | 'ellipse' | 'line' | 'polygon' | 'star' | null;
  cornerRadiusPx?: number | undefined;
  reasoning: string;
}
