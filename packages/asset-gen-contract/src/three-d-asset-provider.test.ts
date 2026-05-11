// packages/asset-gen-contract/src/three-d-asset-provider.test.ts
// ThreeDAssetProvider tests — round-trip / reject / validator / type.

import { describe, expect, it } from 'vitest';

import type { AdapterDescriptor } from '@stageflip/adapters-core';

import {
  THREE_D_TOPOLOGIES,
  type ThreeDAssetProvider,
  type ThreeDCall,
  type ThreeDCapabilityDescriptor,
  type ThreeDResult,
  threeDCapabilityDescriptorSchema,
  validateThreeDCapability,
} from './three-d-asset-provider.js';

const validCapability: ThreeDCapabilityDescriptor = {
  outputFormats: ['glb'],
  topology: 'quad-clean',
  supportsAutoRigging: true,
  maxVertices: 50_000,
};

describe('threeDCapabilityDescriptorSchema', () => {
  it('parses a valid capability descriptor', () => {
    expect(threeDCapabilityDescriptorSchema.parse(validCapability)).toEqual(validCapability);
  });

  it('round-trips every topology', () => {
    expect(THREE_D_TOPOLOGIES).toHaveLength(3);
    for (const topology of THREE_D_TOPOLOGIES) {
      const cap: ThreeDCapabilityDescriptor = { ...validCapability, topology };
      expect(threeDCapabilityDescriptorSchema.parse(cap).topology).toBe(topology);
    }
  });

  it('rejects an output format other than glb', () => {
    expect(() =>
      threeDCapabilityDescriptorSchema.parse({ ...validCapability, outputFormats: ['fbx'] }),
    ).toThrow();
  });

  it('rejects empty outputFormats tuple', () => {
    expect(() =>
      threeDCapabilityDescriptorSchema.parse({ ...validCapability, outputFormats: [] }),
    ).toThrow();
  });

  it('rejects non-positive maxVertices', () => {
    expect(() =>
      threeDCapabilityDescriptorSchema.parse({ ...validCapability, maxVertices: 0 }),
    ).toThrow();
  });

  it('rejects non-integer maxVertices', () => {
    expect(() =>
      threeDCapabilityDescriptorSchema.parse({ ...validCapability, maxVertices: 1.5 }),
    ).toThrow();
  });

  it('rejects unknown top-level fields', () => {
    expect(() =>
      threeDCapabilityDescriptorSchema.parse({ ...validCapability, extra: 'x' }),
    ).toThrow();
  });

  it('rejects unknown topology literal', () => {
    expect(() =>
      threeDCapabilityDescriptorSchema.parse({ ...validCapability, topology: 'sculpted' }),
    ).toThrow();
  });
});

describe('validateThreeDCapability', () => {
  it('returns ok:true on valid', () => {
    expect(validateThreeDCapability(validCapability).ok).toBe(true);
  });

  it('returns ok:false on invalid', () => {
    expect(validateThreeDCapability(null).ok).toBe(false);
  });
});

describe('ThreeDAssetProvider type', () => {
  it('compiles against AdapterDescriptor', () => {
    const provider: ThreeDAssetProvider = {
      id: 'tripo',
      modality: { kind: 'three-d' },
      capability: validCapability,
      license: { kind: 'proprietary-byo' },
      sandbox: { kind: 'remote-service', baseUrlEnvVar: 'TRIPO_API_URL' },
      async generate(call: ThreeDCall): Promise<ThreeDResult> {
        return {
          cacheKey: 'd'.repeat(64),
          url: `https://cache.local/three-d/${call.prompt}.glb`,
          vertices: 12_000,
          rigged: call.rig === true,
        };
      },
    };
    const asBase = provider as unknown as AdapterDescriptor;
    expect(asBase.modality.kind).toBe('three-d');
  });
});
