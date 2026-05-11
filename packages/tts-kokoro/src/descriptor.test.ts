// packages/tts-kokoro/src/descriptor.test.ts
// Coverage for `kokoroDescriptor` — schema round-trip via T-418's
// `parseAdapterDescriptor`, capability validator round-trip via T-419's
// `validateTtsCapability`, and the per-AC field invariants from
// docs/tasks/T-426.md AC #3.

import { describe, expect, it } from 'vitest';

import { parseAdapterDescriptor } from '@stageflip/adapters-core';
import { type TtsCapabilityDescriptor, validateTtsCapability } from '@stageflip/asset-gen-contract';

import {
  KOKORO_MAX_DURATION_S,
  KOKORO_SAMPLE_RATE_HZ,
  KOKORO_VOICES,
  kokoroDescriptor,
  kokoroTtsCapability,
} from './descriptor.js';

describe('kokoroDescriptor — adapter descriptor envelope', () => {
  it('passes parseAdapterDescriptor (T-418 schema)', () => {
    const parsed = parseAdapterDescriptor(kokoroDescriptor);
    expect(parsed.id).toBe('kokoro');
    expect(parsed.modality.kind).toBe('tts');
    expect(parsed.license.kind).toBe('apache-2.0');
    expect(parsed.sandbox.kind).toBe('in-process');
  });

  it('uses kebab-case id', () => {
    expect(kokoroDescriptor.id).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
  });

  it('declares costPerCall.usd === 0 (free at the model level)', () => {
    expect(kokoroDescriptor.costPerCall?.usd).toBe(0);
  });

  it('declares latencyMs.{p50,p95} ≤ 300ms (sub-0.3s claim)', () => {
    expect(kokoroDescriptor.latencyMs?.p50).toBeLessThanOrEqual(300);
    expect(kokoroDescriptor.latencyMs?.p95).toBeLessThanOrEqual(300);
  });

  it('does NOT set sourceGrounded or requiresResearchProvider', () => {
    expect(kokoroDescriptor.sourceGrounded).toBeUndefined();
    expect(kokoroDescriptor.requiresResearchProvider).toBeUndefined();
  });

  it('carries catalog-summary fields voiceCount + sampleRateHz (read by T-424 generator)', () => {
    const cap = kokoroDescriptor.capability as Record<string, unknown>;
    expect(cap.voiceCount).toBe(KOKORO_VOICES.length);
    expect(cap.sampleRateHz).toBe(KOKORO_SAMPLE_RATE_HZ);
  });
});

describe('kokoroTtsCapability — strict TtsCapabilityDescriptor subset', () => {
  it('passes validateTtsCapability (T-419 schema)', () => {
    const result = validateTtsCapability(kokoroTtsCapability as Record<string, unknown>);
    expect(result.ok).toBe(true);
  });

  it('declares 10 voices', () => {
    expect(kokoroTtsCapability.voices).toHaveLength(10);
    expect(KOKORO_VOICES).toHaveLength(10);
  });

  it('every voice is a library voice (no clones in v1)', () => {
    for (const voice of kokoroTtsCapability.voices) {
      expect(voice.origin).toBe('library');
    }
  });

  it('every voice declares at least one ISO-639-1 language', () => {
    for (const voice of kokoroTtsCapability.voices) {
      expect(voice.languages.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('every voice has a unique id', () => {
    const ids = kokoroTtsCapability.voices.map((v) => v.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('declares wav as the only output format', () => {
    expect(kokoroTtsCapability.outputFormats).toEqual(['wav']);
  });

  it('declares 24000Hz as the only sample rate', () => {
    expect(kokoroTtsCapability.sampleRates).toEqual([KOKORO_SAMPLE_RATE_HZ]);
  });

  it('declares maxDurationS = 60', () => {
    expect(kokoroTtsCapability.maxDurationS).toBe(KOKORO_MAX_DURATION_S);
  });

  it('does NOT emit word timestamps in v1', () => {
    expect(kokoroTtsCapability.emitsWordTimestamps).toBe(false);
  });

  it('does NOT support voice cloning (no §D4 consent obligation)', () => {
    expect(kokoroTtsCapability.supportsVoiceClone).toBe(false);
  });

  it('rejects an arbitrary mutation that would fail validateTtsCapability', () => {
    const bogus: TtsCapabilityDescriptor = {
      ...kokoroTtsCapability,
      voices: [],
    };
    const result = validateTtsCapability(bogus as Record<string, unknown>);
    expect(result.ok).toBe(false);
  });
});

describe('kokoroDescriptor — passes T-422 license whitelist (apache-2.0 ∈ tts whitelist)', () => {
  it('declares license.kind = apache-2.0', () => {
    expect(kokoroDescriptor.license.kind).toBe('apache-2.0');
  });
});
