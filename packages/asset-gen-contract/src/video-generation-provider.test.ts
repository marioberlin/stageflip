// packages/asset-gen-contract/src/video-generation-provider.test.ts
// VideoGenerationProvider tests — schema round-trip / reject malformed /
// validator dispatch / interface compiles against AdapterDescriptor.

import { describe, expect, it } from 'vitest';

import type { AdapterDescriptor } from '@stageflip/adapters-core';

import {
  VIDEO_GEN_OUTPUT_FORMATS,
  type VideoGenCall,
  type VideoGenCapabilityDescriptor,
  type VideoGenResult,
  type VideoGenerationProvider,
  validateVideoGenCapability,
  videoGenCapabilityDescriptorSchema,
} from './video-generation-provider.js';

const validCapability: VideoGenCapabilityDescriptor = {
  aspectRatios: ['16:9', '9:16', '1:1'],
  frameRates: [24, 30],
  maxDurationS: 15,
  outputFormats: ['mp4'],
  emitsAudio: true,
  safetyFilters: ['no-faces', 'no-text'],
};

describe('videoGenCapabilityDescriptorSchema', () => {
  it('parses a valid capability descriptor', () => {
    expect(videoGenCapabilityDescriptorSchema.parse(validCapability)).toEqual(validCapability);
  });

  it('round-trips every output format', () => {
    expect(VIDEO_GEN_OUTPUT_FORMATS).toHaveLength(2);
    for (const fmt of VIDEO_GEN_OUTPUT_FORMATS) {
      const cap: VideoGenCapabilityDescriptor = { ...validCapability, outputFormats: [fmt] };
      expect(videoGenCapabilityDescriptorSchema.parse(cap).outputFormats).toEqual([fmt]);
    }
  });

  it('allows empty safetyFilters', () => {
    const cap: VideoGenCapabilityDescriptor = { ...validCapability, safetyFilters: [] };
    expect(videoGenCapabilityDescriptorSchema.parse(cap).safetyFilters).toEqual([]);
  });

  it('rejects empty aspectRatios', () => {
    expect(() =>
      videoGenCapabilityDescriptorSchema.parse({ ...validCapability, aspectRatios: [] }),
    ).toThrow();
  });

  it('rejects empty frameRates', () => {
    expect(() =>
      videoGenCapabilityDescriptorSchema.parse({ ...validCapability, frameRates: [] }),
    ).toThrow();
  });

  it('rejects non-positive maxDurationS', () => {
    expect(() =>
      videoGenCapabilityDescriptorSchema.parse({ ...validCapability, maxDurationS: -1 }),
    ).toThrow();
  });

  it('rejects unknown top-level fields (strict)', () => {
    expect(() =>
      videoGenCapabilityDescriptorSchema.parse({ ...validCapability, extra: true }),
    ).toThrow();
  });

  it('rejects unknown output format', () => {
    expect(() =>
      videoGenCapabilityDescriptorSchema.parse({ ...validCapability, outputFormats: ['avi'] }),
    ).toThrow();
  });
});

describe('validateVideoGenCapability', () => {
  it('returns ok:true on valid input', () => {
    expect(validateVideoGenCapability(validCapability).ok).toBe(true);
  });

  it('returns ok:false on invalid input', () => {
    const result = validateVideoGenCapability({});
    expect(result.ok).toBe(false);
    if (result.ok === false) expect(result.error).toBeTruthy();
  });
});

describe('VideoGenerationProvider type', () => {
  it('compiles against AdapterDescriptor', () => {
    const provider: VideoGenerationProvider = {
      id: 'seedance',
      modality: { kind: 'video-gen' },
      capability: validCapability,
      license: { kind: 'proprietary-byo' },
      sandbox: { kind: 'remote-service', baseUrlEnvVar: 'SEEDANCE_API_URL' },
      async generate(call: VideoGenCall): Promise<VideoGenResult> {
        return {
          cacheKey: 'a'.repeat(64),
          url: `https://cache.local/video/${call.prompt}`,
          durationS: call.durationS,
          aspectRatio: call.aspectRatio,
          frameRate: call.frameRate,
        };
      },
    };
    const asBase = provider as unknown as AdapterDescriptor;
    expect(asBase.modality.kind).toBe('video-gen');
  });
});
