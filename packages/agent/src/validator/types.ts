// packages/agent/src/validator/types.ts
// Validator contracts per skills/stageflip/concepts/agent-validator.
// Two independent check streams — programmatic (deterministic, drives
// tier) and qualitative (LLM, informational) — feed a single
// ValidationResult.

import type { Document } from '@stageflip/schema';
import { z } from 'zod';

export type ValidationTier = 'pass' | 'pass-with-notes' | 'fail';

export const programmaticCheckResultSchema = z.object({
  name: z.string(),
  status: z.enum(['pass', 'fail']),
  detail: z.string().optional(),
});
export type ProgrammaticCheckResult = z.infer<typeof programmaticCheckResultSchema>;

export const qualitativeCheckResultSchema = z.object({
  name: z.string(),
  verdict: z.string(),
  evidence: z.string(),
  suggestedFix: z.string().optional(),
});
export type QualitativeCheckResult = z.infer<typeof qualitativeCheckResultSchema>;

export const validationResultSchema = z.object({
  tier: z.enum(['pass', 'pass-with-notes', 'fail']),
  programmatic: z.array(programmaticCheckResultSchema),
  qualitative: z.array(qualitativeCheckResultSchema),
  required_fixes: z.array(z.string()).optional(),
});
export type ValidationResult = z.infer<typeof validationResultSchema>;

/**
 * A programmatic check is a pure function over the final document. Returns
 * `fail` to drop the tier; `required_fixes` are accumulated separately by
 * the qualitative layer.
 */
export interface ProgrammaticCheck {
  readonly name: string;
  run(document: Document): ProgrammaticCheckResult | Promise<ProgrammaticCheckResult>;
}

/**
 * Canonical qualitative check catalog. Each entry produces one LLM call
 * yielding a single QualitativeCheckResult. Callers opt in by name;
 * `qualitativeChecks: []` (or omission) disables all of them.
 */
export type QualitativeCheckName = 'brand_voice' | 'claim_plausibility' | 'reading_level';

export interface ValidatorRequest {
  document: Document;
  /** Provider-specific model id. Required only when qualitative checks run. */
  model: string;
  /** Names of qualitative checks to run. Empty / omitted = programmatic only. */
  qualitativeChecks?: readonly QualitativeCheckName[];
  /** Per-check max tokens. Defaults to 1024. */
  maxTokens?: number;
  /** Defaults to 0 — deterministic qualitative verdicts are the goal. */
  temperature?: number;
}

export interface ValidatorCallOptions {
  signal?: AbortSignal;
}

export interface Validator {
  validate(request: ValidatorRequest, options?: ValidatorCallOptions): Promise<ValidationResult>;
}
