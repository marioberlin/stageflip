// packages/asset-gen-contract/src/music-generation-provider.test.ts
// MusicGenerationProvider tests — round-trip / reject / validator / type.

import { describe, expect, it } from 'vitest';

import type { AdapterDescriptor } from '@stageflip/adapters-core';

import {
  MUSIC_GEN_OUTPUT_FORMATS,
  MUSIC_GEN_OUTPUT_LICENSES,
  type MusicGenCall,
  type MusicGenCapabilityDescriptor,
  type MusicGenResult,
  type MusicGenerationProvider,
  musicGenCapabilityDescriptorSchema,
  validateMusicGenCapability,
} from './music-generation-provider.js';

const validCapability: MusicGenCapabilityDescriptor = {
  genres: ['electronic', 'ambient', 'jazz'],
  maxDurationS: 120,
  outputFormats: ['wav', 'mp3'],
  outputLicense: 'permissive',
};

describe('musicGenCapabilityDescriptorSchema', () => {
  it('parses a valid capability descriptor', () => {
    expect(musicGenCapabilityDescriptorSchema.parse(validCapability)).toEqual(validCapability);
  });

  it('round-trips every output license', () => {
    expect(MUSIC_GEN_OUTPUT_LICENSES).toHaveLength(3);
    for (const license of MUSIC_GEN_OUTPUT_LICENSES) {
      const cap: MusicGenCapabilityDescriptor = { ...validCapability, outputLicense: license };
      expect(musicGenCapabilityDescriptorSchema.parse(cap).outputLicense).toBe(license);
    }
  });

  it('round-trips every output format', () => {
    expect(MUSIC_GEN_OUTPUT_FORMATS).toHaveLength(3);
    for (const fmt of MUSIC_GEN_OUTPUT_FORMATS) {
      const cap: MusicGenCapabilityDescriptor = { ...validCapability, outputFormats: [fmt] };
      expect(musicGenCapabilityDescriptorSchema.parse(cap).outputFormats).toEqual([fmt]);
    }
  });

  it('rejects empty genres', () => {
    expect(() =>
      musicGenCapabilityDescriptorSchema.parse({ ...validCapability, genres: [] }),
    ).toThrow();
  });

  it('rejects unknown output license', () => {
    expect(() =>
      musicGenCapabilityDescriptorSchema.parse({
        ...validCapability,
        outputLicense: 'royalty-free',
      }),
    ).toThrow();
  });

  it('rejects unknown top-level fields (strict)', () => {
    expect(() =>
      musicGenCapabilityDescriptorSchema.parse({ ...validCapability, extra: 1 }),
    ).toThrow();
  });

  it('rejects non-positive duration', () => {
    expect(() =>
      musicGenCapabilityDescriptorSchema.parse({ ...validCapability, maxDurationS: 0 }),
    ).toThrow();
  });
});

describe('validateMusicGenCapability', () => {
  it('returns ok:true on valid', () => {
    expect(validateMusicGenCapability(validCapability).ok).toBe(true);
  });

  it('returns ok:false on invalid', () => {
    const result = validateMusicGenCapability('not-an-object');
    expect(result.ok).toBe(false);
  });
});

describe('MusicGenerationProvider type', () => {
  it('compiles against AdapterDescriptor', () => {
    const provider: MusicGenerationProvider = {
      id: 'ace-step',
      modality: { kind: 'music-gen' },
      capability: validCapability,
      license: { kind: 'mit' },
      sandbox: { kind: 'sidecar', runtime: 'python' },
      async generate(call: MusicGenCall): Promise<MusicGenResult> {
        return {
          cacheKey: 'b'.repeat(64),
          url: `https://cache.local/music/${call.prompt}`,
          durationS: call.durationS,
        };
      },
    };
    const asBase = provider as unknown as AdapterDescriptor;
    expect(asBase.modality.kind).toBe('music-gen');
  });
});
