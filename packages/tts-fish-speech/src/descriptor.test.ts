// packages/tts-fish-speech/src/descriptor.test.ts
// Coverage for `fishSpeechDescriptor` — schema round-trip via T-418's
// `parseAdapterDescriptor`, capability validator round-trip via T-419's
// `validateTtsCapability`, and the per-AC field invariants from
// docs/tasks/T-427.md AC #3 + #8.

import { describe, expect, it } from 'vitest';

import { parseAdapterDescriptor } from '@stageflip/adapters-core';
import { type TtsCapabilityDescriptor, validateTtsCapability } from '@stageflip/asset-gen-contract';

import {
  FISH_SPEECH_LIBRARY_VOICES,
  FISH_SPEECH_MAX_DURATION_S,
  FISH_SPEECH_SAMPLE_RATE_HZ,
  FISH_SPEECH_SUPPORTED_LANGUAGES,
  fishSpeechDescriptor,
  fishSpeechTtsCapability,
} from './descriptor.js';

describe('fishSpeechDescriptor — adapter descriptor envelope', () => {
  it('passes parseAdapterDescriptor (T-418 schema)', () => {
    const parsed = parseAdapterDescriptor(fishSpeechDescriptor);
    expect(parsed.id).toBe('fish-speech');
    expect(parsed.modality.kind).toBe('tts');
    expect(parsed.license.kind).toBe('apache-2.0');
    expect(parsed.sandbox.kind).toBe('sidecar');
  });

  it('declares sandbox.runtime = python (sidecar deployment)', () => {
    expect(fishSpeechDescriptor.sandbox.kind).toBe('sidecar');
    if (fishSpeechDescriptor.sandbox.kind === 'sidecar') {
      expect(fishSpeechDescriptor.sandbox.runtime).toBe('python');
    }
  });

  it('uses kebab-case id', () => {
    expect(fishSpeechDescriptor.id).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
  });

  it('declares costPerCall.usd === 0 (Apache 2.0 model — deployment cost is the tenant\'s)', () => {
    expect(fishSpeechDescriptor.costPerCall?.usd).toBe(0);
  });

  it('declares latencyMs.{p50,p95} consistent with the fast tier (>= 1s)', () => {
    expect(fishSpeechDescriptor.latencyMs?.p50).toBe(1200);
    expect(fishSpeechDescriptor.latencyMs?.p95).toBe(3000);
    // Stays under 10s — fast tier per the asset-providers-gen
    // latencyTier bucketing (interactive < 1s, fast < 10s).
    expect(fishSpeechDescriptor.latencyMs?.p95).toBeLessThan(10_000);
  });

  it('does NOT set sourceGrounded or requiresResearchProvider', () => {
    expect(fishSpeechDescriptor.sourceGrounded).toBeUndefined();
    expect(fishSpeechDescriptor.requiresResearchProvider).toBeUndefined();
  });

  it('carries catalog-summary fields voiceCount + sampleRateHz (read by T-424 generator)', () => {
    const cap = fishSpeechDescriptor.capability as Record<string, unknown>;
    expect(cap.voiceCount).toBe(FISH_SPEECH_LIBRARY_VOICES.length);
    expect(cap.sampleRateHz).toBe(FISH_SPEECH_SAMPLE_RATE_HZ);
  });
});

describe('fishSpeechTtsCapability — strict TtsCapabilityDescriptor subset', () => {
  it('passes validateTtsCapability (T-419 schema)', () => {
    const result = validateTtsCapability(fishSpeechTtsCapability as Record<string, unknown>);
    expect(result.ok).toBe(true);
  });

  it('declares 8 library voices (one per supported language)', () => {
    expect(fishSpeechTtsCapability.voices).toHaveLength(8);
    expect(FISH_SPEECH_LIBRARY_VOICES).toHaveLength(8);
  });

  it('every library voice has origin === "library"', () => {
    for (const voice of fishSpeechTtsCapability.voices) {
      expect(voice.origin).toBe('library');
    }
  });

  it('every voice declares exactly one ISO-639-1 language', () => {
    for (const voice of fishSpeechTtsCapability.voices) {
      expect(voice.languages.length).toBe(1);
    }
  });

  it('every voice has a unique id', () => {
    const ids = fishSpeechTtsCapability.voices.map((v) => v.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('declared languages cover the documented 8 codes', () => {
    const declared = new Set(fishSpeechTtsCapability.voices.flatMap((v) => v.languages));
    for (const code of FISH_SPEECH_SUPPORTED_LANGUAGES) {
      expect(declared.has(code)).toBe(true);
    }
    expect(declared.size).toBe(FISH_SPEECH_SUPPORTED_LANGUAGES.length);
  });

  it('declares wav as the only output format', () => {
    expect(fishSpeechTtsCapability.outputFormats).toEqual(['wav']);
  });

  it('declares 22050Hz as the only sample rate', () => {
    expect(fishSpeechTtsCapability.sampleRates).toEqual([FISH_SPEECH_SAMPLE_RATE_HZ]);
  });

  it('declares maxDurationS = 60', () => {
    expect(fishSpeechTtsCapability.maxDurationS).toBe(FISH_SPEECH_MAX_DURATION_S);
  });

  it('does NOT emit word timestamps in v1', () => {
    expect(fishSpeechTtsCapability.emitsWordTimestamps).toBe(false);
  });

  it('SUPPORTS voice cloning (the §D4 obligation activates here)', () => {
    expect(fishSpeechTtsCapability.supportsVoiceClone).toBe(true);
  });

  it('rejects an arbitrary mutation that would fail validateTtsCapability', () => {
    const bogus: TtsCapabilityDescriptor = {
      ...fishSpeechTtsCapability,
      voices: [],
    };
    const result = validateTtsCapability(bogus as Record<string, unknown>);
    expect(result.ok).toBe(false);
  });
});

describe('fishSpeechDescriptor — passes T-422 license whitelist (apache-2.0 ∈ tts whitelist)', () => {
  it('declares license.kind = apache-2.0', () => {
    expect(fishSpeechDescriptor.license.kind).toBe('apache-2.0');
  });
});

describe('FISH_SPEECH_SUPPORTED_LANGUAGES — the 8-language set', () => {
  it('lists exactly the 8 documented ISO-639-1 codes', () => {
    expect(FISH_SPEECH_SUPPORTED_LANGUAGES).toEqual([
      'en',
      'zh',
      'ja',
      'ko',
      'fr',
      'de',
      'es',
      'ru',
    ]);
  });
});
