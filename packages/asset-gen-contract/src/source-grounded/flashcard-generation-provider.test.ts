// packages/asset-gen-contract/src/source-grounded/flashcard-generation-provider.test.ts
// FlashcardGenerationProvider tests.

import { describe, expect, it } from 'vitest';

import type { AdapterDescriptor } from '@stageflip/adapters-core';

import {
  type FlashcardCall,
  type FlashcardCapabilityDescriptor,
  type FlashcardGenerationProvider,
  type FlashcardResult,
  flashcardCapabilityDescriptorSchema,
  validateFlashcardCapability,
} from './flashcard-generation-provider.js';

const validCapability: FlashcardCapabilityDescriptor = {
  maxCards: 50,
  supportsImages: true,
};

describe('flashcardCapabilityDescriptorSchema', () => {
  it('parses a valid capability descriptor', () => {
    expect(flashcardCapabilityDescriptorSchema.parse(validCapability)).toEqual(validCapability);
  });

  it('round-trips supportsImages = false', () => {
    const cap: FlashcardCapabilityDescriptor = { ...validCapability, supportsImages: false };
    expect(flashcardCapabilityDescriptorSchema.parse(cap).supportsImages).toBe(false);
  });

  it('rejects non-positive maxCards', () => {
    expect(() =>
      flashcardCapabilityDescriptorSchema.parse({ ...validCapability, maxCards: 0 }),
    ).toThrow();
  });

  it('rejects unknown top-level fields', () => {
    expect(() =>
      flashcardCapabilityDescriptorSchema.parse({ ...validCapability, extra: 1 }),
    ).toThrow();
  });
});

describe('validateFlashcardCapability', () => {
  it('returns ok:true on valid', () => {
    expect(validateFlashcardCapability(validCapability).ok).toBe(true);
  });

  it('returns ok:false on invalid', () => {
    expect(validateFlashcardCapability({}).ok).toBe(false);
  });
});

describe('FlashcardGenerationProvider type', () => {
  it('compiles against AdapterDescriptor', () => {
    const provider: FlashcardGenerationProvider = {
      id: 'flashcard-stub',
      modality: { kind: 'flashcard-gen' },
      capability: validCapability,
      license: { kind: 'apache-2.0' },
      sandbox: { kind: 'in-process' },
      async generate(_call: FlashcardCall): Promise<FlashcardResult> {
        return { flashcards: { cards: [] }, provenance: { kind: 'imported' } };
      },
    };
    const asBase = provider as unknown as AdapterDescriptor;
    expect(asBase.modality.kind).toBe('flashcard-gen');
  });
});
