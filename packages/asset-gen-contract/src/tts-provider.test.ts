// packages/asset-gen-contract/src/tts-provider.test.ts
// TTSProvider tests — schema round-trip / reject malformed / validator
// dispatch / interface compiles against AdapterDescriptor.

import { describe, expect, it } from 'vitest';

import type { AdapterDescriptor } from '@stageflip/adapters-core';

import {
  type TTSProvider,
  TTS_OUTPUT_FORMATS,
  TTS_VOICE_ORIGINS,
  type TtsCall,
  type TtsCapabilityDescriptor,
  type TtsResult,
  ttsCapabilityDescriptorSchema,
  validateTtsCapability,
} from './tts-provider.js';

const validCapability: TtsCapabilityDescriptor = {
  voices: [
    { id: 'voice-1', label: 'Voice One', origin: 'library', languages: ['en'] },
    { id: 'voice-2', label: 'Voice Two', origin: 'cloned-per-tenant', languages: ['en', 'es'] },
  ],
  outputFormats: ['wav', 'mp3'],
  sampleRates: [16000, 24000, 44100],
  maxDurationS: 60,
  emitsWordTimestamps: true,
  supportsVoiceClone: true,
};

describe('ttsCapabilityDescriptorSchema', () => {
  it('parses a valid capability descriptor', () => {
    const parsed = ttsCapabilityDescriptorSchema.parse(validCapability);
    expect(parsed).toEqual(validCapability);
  });

  it('round-trips every voice origin', () => {
    expect(TTS_VOICE_ORIGINS).toHaveLength(2);
    for (const origin of TTS_VOICE_ORIGINS) {
      const cap: TtsCapabilityDescriptor = {
        ...validCapability,
        voices: [{ id: 'v', label: 'V', origin, languages: ['en'] }],
      };
      const parsed = ttsCapabilityDescriptorSchema.parse(cap);
      expect(parsed.voices[0]?.origin).toBe(origin);
    }
  });

  it('round-trips every output format', () => {
    expect(TTS_OUTPUT_FORMATS).toHaveLength(4);
    for (const fmt of TTS_OUTPUT_FORMATS) {
      const cap: TtsCapabilityDescriptor = { ...validCapability, outputFormats: [fmt] };
      const parsed = ttsCapabilityDescriptorSchema.parse(cap);
      expect(parsed.outputFormats).toEqual([fmt]);
    }
  });

  it('rejects an empty voices array', () => {
    expect(() => ttsCapabilityDescriptorSchema.parse({ ...validCapability, voices: [] })).toThrow();
  });

  it('rejects an empty outputFormats array', () => {
    expect(() =>
      ttsCapabilityDescriptorSchema.parse({ ...validCapability, outputFormats: [] }),
    ).toThrow();
  });

  it('rejects a non-positive maxDurationS', () => {
    expect(() =>
      ttsCapabilityDescriptorSchema.parse({ ...validCapability, maxDurationS: 0 }),
    ).toThrow();
  });

  it('rejects an unknown voice origin', () => {
    expect(() =>
      ttsCapabilityDescriptorSchema.parse({
        ...validCapability,
        voices: [{ id: 'v', label: 'V', origin: 'community-pool', languages: ['en'] }],
      }),
    ).toThrow();
  });

  it('rejects unknown top-level fields (strict)', () => {
    expect(() =>
      ttsCapabilityDescriptorSchema.parse({ ...validCapability, extra: 'nope' }),
    ).toThrow();
  });

  it('rejects a non-integer sample rate', () => {
    expect(() =>
      ttsCapabilityDescriptorSchema.parse({ ...validCapability, sampleRates: [44100.5] }),
    ).toThrow();
  });
});

describe('validateTtsCapability', () => {
  it('returns ok:true on valid capability', () => {
    const result = validateTtsCapability(validCapability);
    expect(result.ok).toBe(true);
    if (result.ok === true) {
      expect(result.capability).toMatchObject({ maxDurationS: 60 });
    }
  });

  it('returns ok:false on invalid capability', () => {
    const result = validateTtsCapability({ voices: [], outputFormats: ['wav'] });
    expect(result.ok).toBe(false);
    if (result.ok === false) {
      expect(result.error).toBeTruthy();
    }
  });

  it('rejects a non-object input', () => {
    const result = validateTtsCapability(42);
    expect(result.ok).toBe(false);
  });
});

describe('TTSProvider type', () => {
  it('compiles against AdapterDescriptor', () => {
    // Type-level check via assignment: a TTSProvider value must satisfy the
    // AdapterDescriptor base interface.
    const provider: TTSProvider = {
      id: 'kokoro-tts',
      modality: { kind: 'tts' },
      capability: validCapability,
      license: { kind: 'apache-2.0' },
      sandbox: { kind: 'in-process' },
      async synthesize(call: TtsCall): Promise<TtsResult> {
        return {
          cacheKey: 'a'.repeat(64),
          url: `https://cache.local/tts/${call.voiceId}`,
          durationS: 3.2,
        };
      },
    };
    const asBase = provider as unknown as AdapterDescriptor;
    expect(asBase.id).toBe('kokoro-tts');
    expect(provider.modality.kind).toBe('tts');
  });
});
