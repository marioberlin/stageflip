// packages/asset-gen-contract/src/source-grounded/infographic-generation-provider.test.ts
// InfographicGenerationProvider tests.

import { describe, expect, it } from 'vitest';

import type { AdapterDescriptor } from '@stageflip/adapters-core';

import {
  INFOGRAPHIC_OUTPUT_FORMATS,
  type InfographicCall,
  type InfographicCapabilityDescriptor,
  type InfographicGenerationProvider,
  type InfographicResult,
  infographicCapabilityDescriptorSchema,
  validateInfographicCapability,
} from './infographic-generation-provider.js';

const validCapability: InfographicCapabilityDescriptor = {
  aspectRatios: ['1:1', '16:9', '9:16'],
  outputFormats: ['png', 'svg'],
  maxResolutionPx: 4096,
};

describe('infographicCapabilityDescriptorSchema', () => {
  it('parses a valid capability descriptor', () => {
    expect(infographicCapabilityDescriptorSchema.parse(validCapability)).toEqual(validCapability);
  });

  it('round-trips every output format', () => {
    expect(INFOGRAPHIC_OUTPUT_FORMATS).toHaveLength(2);
    for (const fmt of INFOGRAPHIC_OUTPUT_FORMATS) {
      const cap: InfographicCapabilityDescriptor = { ...validCapability, outputFormats: [fmt] };
      expect(infographicCapabilityDescriptorSchema.parse(cap).outputFormats).toEqual([fmt]);
    }
  });

  it('rejects empty aspectRatios', () => {
    expect(() =>
      infographicCapabilityDescriptorSchema.parse({ ...validCapability, aspectRatios: [] }),
    ).toThrow();
  });

  it('rejects unknown output format', () => {
    expect(() =>
      infographicCapabilityDescriptorSchema.parse({
        ...validCapability,
        outputFormats: ['webp'],
      }),
    ).toThrow();
  });

  it('rejects non-positive maxResolutionPx', () => {
    expect(() =>
      infographicCapabilityDescriptorSchema.parse({ ...validCapability, maxResolutionPx: 0 }),
    ).toThrow();
  });

  it('rejects unknown top-level fields', () => {
    expect(() =>
      infographicCapabilityDescriptorSchema.parse({ ...validCapability, extra: true }),
    ).toThrow();
  });
});

describe('validateInfographicCapability', () => {
  it('returns ok:true on valid', () => {
    expect(validateInfographicCapability(validCapability).ok).toBe(true);
  });

  it('returns ok:false on invalid', () => {
    expect(validateInfographicCapability(undefined).ok).toBe(false);
  });
});

describe('InfographicGenerationProvider type', () => {
  it('compiles against AdapterDescriptor', () => {
    const provider: InfographicGenerationProvider = {
      id: 'infographic-stub',
      modality: { kind: 'infographic-gen' },
      capability: validCapability,
      license: { kind: 'apache-2.0' },
      sandbox: { kind: 'in-process' },
      async generate(_call: InfographicCall): Promise<InfographicResult> {
        return { image: { url: 'data:image/png;base64,' }, provenance: { kind: 'image-gen' } };
      },
    };
    const asBase = provider as unknown as AdapterDescriptor;
    expect(asBase.modality.kind).toBe('infographic-gen');
  });
});
