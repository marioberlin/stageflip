// packages/asset-gen-contract/src/source-grounded/quiz-generation-provider.ts
// `QuizGenerationProvider` — source-grounded provider class per ADR-008
// §D9. Output is the static (frozen) variant of a LiveQuiz clip per
// ADR-005 §D2 / Phase 15 staticFallback contract.

import type { AdapterDescriptor } from '@stageflip/adapters-core';
import type { CapabilityValidator } from '@stageflip/adapters-core';
import { z } from 'zod';

import type { MediaProvenance } from '../provenance-placeholder.js';

/**
 * Opaque forward-declaration of `QuizClipProps`. The QuizClip family
 * ships the concrete shape (Phase 15).
 */
export type QuizClipProps = Readonly<Record<string, unknown>>;

// ----------------------------------------------------------------------------
// Enums + capability descriptor (ADR-008 §D9)
// ----------------------------------------------------------------------------

export const QUIZ_QUESTION_TYPES = ['multiple-choice', 'true-false', 'short-answer'] as const;
export type QuizQuestionType = (typeof QUIZ_QUESTION_TYPES)[number];

export interface QuizCapabilityDescriptor {
  readonly maxQuestions: number;
  readonly questionTypes: readonly QuizQuestionType[];
}

export const quizCapabilityDescriptorSchema = z
  .object({
    maxQuestions: z.number().int().positive(),
    questionTypes: z.array(z.enum(QUIZ_QUESTION_TYPES)).min(1).readonly(),
  })
  .strict();

export const validateQuizCapability: CapabilityValidator = (capability) => {
  const result = quizCapabilityDescriptorSchema.safeParse(capability);
  if (result.success) {
    return { ok: true, capability: result.data as Record<string, unknown> };
  }
  return { ok: false, error: result.error.message };
};

// ----------------------------------------------------------------------------
// Per-call shapes
// ----------------------------------------------------------------------------

export interface QuizCall {
  readonly prompt: string;
  readonly questionTypes?: readonly QuizQuestionType[];
  readonly researchSessionId?: string;
  readonly seed?: number;
}

export interface QuizResult {
  readonly quiz: QuizClipProps;
  readonly provenance: MediaProvenance;
}

// ----------------------------------------------------------------------------
// Provider interface (ADR-008 §D9)
// ----------------------------------------------------------------------------

/** `QuizGenerationProvider` per ADR-008 §D9. */
export interface QuizGenerationProvider extends Omit<AdapterDescriptor, 'modality' | 'capability'> {
  readonly modality: { readonly kind: 'quiz-gen' };
  readonly capability: QuizCapabilityDescriptor;
  generate(call: QuizCall): Promise<QuizResult>;
}
