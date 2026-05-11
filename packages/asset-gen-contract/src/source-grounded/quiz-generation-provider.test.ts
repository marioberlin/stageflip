// packages/asset-gen-contract/src/source-grounded/quiz-generation-provider.test.ts
// QuizGenerationProvider tests.

import { describe, expect, it } from 'vitest';

import type { AdapterDescriptor } from '@stageflip/adapters-core';

import {
  QUIZ_QUESTION_TYPES,
  type QuizCall,
  type QuizCapabilityDescriptor,
  type QuizGenerationProvider,
  type QuizResult,
  quizCapabilityDescriptorSchema,
  validateQuizCapability,
} from './quiz-generation-provider.js';

const validCapability: QuizCapabilityDescriptor = {
  maxQuestions: 20,
  questionTypes: ['multiple-choice', 'true-false'],
};

describe('quizCapabilityDescriptorSchema', () => {
  it('parses a valid capability descriptor', () => {
    expect(quizCapabilityDescriptorSchema.parse(validCapability)).toEqual(validCapability);
  });

  it('round-trips every question type', () => {
    expect(QUIZ_QUESTION_TYPES).toHaveLength(3);
    for (const qt of QUIZ_QUESTION_TYPES) {
      const cap: QuizCapabilityDescriptor = { ...validCapability, questionTypes: [qt] };
      expect(quizCapabilityDescriptorSchema.parse(cap).questionTypes).toEqual([qt]);
    }
  });

  it('rejects empty questionTypes', () => {
    expect(() =>
      quizCapabilityDescriptorSchema.parse({ ...validCapability, questionTypes: [] }),
    ).toThrow();
  });

  it('rejects unknown question type', () => {
    expect(() =>
      quizCapabilityDescriptorSchema.parse({ ...validCapability, questionTypes: ['essay'] }),
    ).toThrow();
  });

  it('rejects unknown top-level fields', () => {
    expect(() =>
      quizCapabilityDescriptorSchema.parse({ ...validCapability, extra: true }),
    ).toThrow();
  });
});

describe('validateQuizCapability', () => {
  it('returns ok:true on valid', () => {
    expect(validateQuizCapability(validCapability).ok).toBe(true);
  });

  it('returns ok:false on invalid', () => {
    expect(validateQuizCapability(null).ok).toBe(false);
  });
});

describe('QuizGenerationProvider type', () => {
  it('compiles against AdapterDescriptor', () => {
    const provider: QuizGenerationProvider = {
      id: 'quiz-stub',
      modality: { kind: 'quiz-gen' },
      capability: validCapability,
      license: { kind: 'apache-2.0' },
      sandbox: { kind: 'in-process' },
      async generate(_call: QuizCall): Promise<QuizResult> {
        return { quiz: { questions: [] }, provenance: { kind: 'imported' } };
      },
    };
    const asBase = provider as unknown as AdapterDescriptor;
    expect(asBase.modality.kind).toBe('quiz-gen');
  });
});
