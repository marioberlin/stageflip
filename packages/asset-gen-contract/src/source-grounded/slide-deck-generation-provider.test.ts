// packages/asset-gen-contract/src/source-grounded/slide-deck-generation-provider.test.ts
// SlideDeckGenerationProvider tests.

import { describe, expect, it } from 'vitest';

import type { AdapterDescriptor } from '@stageflip/adapters-core';

import {
  type SlideDeckCall,
  type SlideDeckCapabilityDescriptor,
  type SlideDeckGenerationProvider,
  type SlideDeckResult,
  slideDeckCapabilityDescriptorSchema,
  validateSlideDeckCapability,
} from './slide-deck-generation-provider.js';

const validCapability: SlideDeckCapabilityDescriptor = {
  maxSlides: 50,
  templates: ['minimal', 'corporate', 'academic'],
};

describe('slideDeckCapabilityDescriptorSchema', () => {
  it('parses a valid capability descriptor', () => {
    expect(slideDeckCapabilityDescriptorSchema.parse(validCapability)).toEqual(validCapability);
  });

  it('allows empty templates', () => {
    const cap: SlideDeckCapabilityDescriptor = { ...validCapability, templates: [] };
    expect(slideDeckCapabilityDescriptorSchema.parse(cap).templates).toEqual([]);
  });

  it('rejects non-positive maxSlides', () => {
    expect(() =>
      slideDeckCapabilityDescriptorSchema.parse({ ...validCapability, maxSlides: 0 }),
    ).toThrow();
  });

  it('rejects unknown top-level fields', () => {
    expect(() =>
      slideDeckCapabilityDescriptorSchema.parse({ ...validCapability, extra: 1 }),
    ).toThrow();
  });
});

describe('validateSlideDeckCapability', () => {
  it('returns ok:true on valid', () => {
    expect(validateSlideDeckCapability(validCapability).ok).toBe(true);
  });

  it('returns ok:false on invalid', () => {
    expect(validateSlideDeckCapability({ maxSlides: -1, templates: [] }).ok).toBe(false);
  });
});

describe('SlideDeckGenerationProvider type', () => {
  it('compiles against AdapterDescriptor', () => {
    const provider: SlideDeckGenerationProvider = {
      id: 'notebooklm-deck',
      modality: { kind: 'slide-deck-gen' },
      capability: validCapability,
      license: { kind: 'proprietary-byo' },
      sandbox: { kind: 'remote-service', baseUrlEnvVar: 'NOTEBOOKLM_BASE_URL' },
      sourceGrounded: true,
      requiresResearchProvider: 'notebooklm',
      async generate(_call: SlideDeckCall): Promise<SlideDeckResult> {
        return {
          document: { kind: 'document', slides: [] },
          provenance: { kind: 'imported' },
        };
      },
    };
    const asBase = provider as unknown as AdapterDescriptor;
    expect(asBase.modality.kind).toBe('slide-deck-gen');
    expect(asBase.sourceGrounded).toBe(true);
  });
});
