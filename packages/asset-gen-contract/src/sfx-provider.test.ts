// packages/asset-gen-contract/src/sfx-provider.test.ts
// SFXProvider tests — round-trip / reject / validator / type.

import { describe, expect, it } from 'vitest';

import type { AdapterDescriptor } from '@stageflip/adapters-core';

import {
  type SFXProvider,
  SFX_OUTPUT_FORMATS,
  type SfxCall,
  type SfxCapabilityDescriptor,
  type SfxResult,
  sfxCapabilityDescriptorSchema,
  validateSfxCapability,
} from './sfx-provider.js';

const validCapability: SfxCapabilityDescriptor = {
  outputFormats: ['wav', 'mp3'],
  sampleRates: [44100, 48000],
  maxDurationS: 15,
  supportsLoop: true,
};

describe('sfxCapabilityDescriptorSchema', () => {
  it('parses a valid capability descriptor', () => {
    expect(sfxCapabilityDescriptorSchema.parse(validCapability)).toEqual(validCapability);
  });

  it('round-trips every output format', () => {
    expect(SFX_OUTPUT_FORMATS).toHaveLength(3);
    for (const fmt of SFX_OUTPUT_FORMATS) {
      const cap: SfxCapabilityDescriptor = { ...validCapability, outputFormats: [fmt] };
      expect(sfxCapabilityDescriptorSchema.parse(cap).outputFormats).toEqual([fmt]);
    }
  });

  it('round-trips supportsLoop = false', () => {
    const cap: SfxCapabilityDescriptor = { ...validCapability, supportsLoop: false };
    expect(sfxCapabilityDescriptorSchema.parse(cap).supportsLoop).toBe(false);
  });

  it('rejects empty sampleRates', () => {
    expect(() =>
      sfxCapabilityDescriptorSchema.parse({ ...validCapability, sampleRates: [] }),
    ).toThrow();
  });

  it('rejects unknown top-level fields', () => {
    expect(() => sfxCapabilityDescriptorSchema.parse({ ...validCapability, extra: 'x' })).toThrow();
  });

  it('rejects non-positive maxDurationS', () => {
    expect(() =>
      sfxCapabilityDescriptorSchema.parse({ ...validCapability, maxDurationS: -1 }),
    ).toThrow();
  });
});

describe('validateSfxCapability', () => {
  it('returns ok:true on valid', () => {
    expect(validateSfxCapability(validCapability).ok).toBe(true);
  });

  it('returns ok:false on invalid', () => {
    const result = validateSfxCapability({ outputFormats: ['mp4'] });
    expect(result.ok).toBe(false);
  });
});

describe('SFXProvider type', () => {
  it('compiles against AdapterDescriptor', () => {
    const provider: SFXProvider = {
      id: 'mubert-sfx',
      modality: { kind: 'sfx' },
      capability: validCapability,
      license: { kind: 'proprietary-byo' },
      sandbox: { kind: 'remote-service', baseUrlEnvVar: 'MUBERT_API_URL' },
      async generate(call: SfxCall): Promise<SfxResult> {
        return {
          cacheKey: 'c'.repeat(64),
          url: `https://cache.local/sfx/${call.prompt}`,
          durationS: call.durationS,
          isLoopable: call.loop === true,
        };
      },
    };
    const asBase = provider as unknown as AdapterDescriptor;
    expect(asBase.modality.kind).toBe('sfx');
  });
});
