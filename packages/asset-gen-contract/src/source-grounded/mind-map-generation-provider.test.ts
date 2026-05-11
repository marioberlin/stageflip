// packages/asset-gen-contract/src/source-grounded/mind-map-generation-provider.test.ts
// MindMapGenerationProvider tests.

import { describe, expect, it } from 'vitest';

import type { AdapterDescriptor } from '@stageflip/adapters-core';

import {
  type MindMapCall,
  type MindMapCapabilityDescriptor,
  type MindMapGenerationProvider,
  type MindMapResult,
  mindMapCapabilityDescriptorSchema,
  validateMindMapCapability,
} from './mind-map-generation-provider.js';

const validCapability: MindMapCapabilityDescriptor = {
  maxDepth: 5,
  maxNodes: 100,
};

describe('mindMapCapabilityDescriptorSchema', () => {
  it('parses a valid capability descriptor', () => {
    expect(mindMapCapabilityDescriptorSchema.parse(validCapability)).toEqual(validCapability);
  });

  it('rejects non-positive maxDepth', () => {
    expect(() =>
      mindMapCapabilityDescriptorSchema.parse({ ...validCapability, maxDepth: 0 }),
    ).toThrow();
  });

  it('rejects non-integer maxNodes', () => {
    expect(() =>
      mindMapCapabilityDescriptorSchema.parse({ ...validCapability, maxNodes: 1.5 }),
    ).toThrow();
  });

  it('rejects unknown top-level fields', () => {
    expect(() =>
      mindMapCapabilityDescriptorSchema.parse({ ...validCapability, extra: true }),
    ).toThrow();
  });
});

describe('validateMindMapCapability', () => {
  it('returns ok:true on valid', () => {
    expect(validateMindMapCapability(validCapability).ok).toBe(true);
  });

  it('returns ok:false on invalid', () => {
    expect(validateMindMapCapability({}).ok).toBe(false);
  });
});

describe('MindMapGenerationProvider type', () => {
  it('compiles against AdapterDescriptor', () => {
    const provider: MindMapGenerationProvider = {
      id: 'mind-map-stub',
      modality: { kind: 'mind-map-gen' },
      capability: validCapability,
      license: { kind: 'apache-2.0' },
      sandbox: { kind: 'in-process' },
      async generate(_call: MindMapCall): Promise<MindMapResult> {
        return {
          mindMap: { root: 'topic' },
          provenance: { kind: 'imported' },
        };
      },
    };
    const asBase = provider as unknown as AdapterDescriptor;
    expect(asBase.modality.kind).toBe('mind-map-gen');
  });
});
