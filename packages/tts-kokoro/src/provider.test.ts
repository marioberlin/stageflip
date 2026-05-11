// packages/tts-kokoro/src/provider.test.ts
// Coverage for `KokoroTtsProvider` — stub-mode happy path, validation
// errors, production-mode NotYetImplementedError, determinism. Per
// docs/tasks/T-426.md AC #7.

import { describe, expect, it } from 'vitest';

import type { TtsCall } from '@stageflip/asset-gen-contract';

import { kokoroDescriptor } from './descriptor.js';
import { KokoroTtsProvider, NotYetImplementedError } from './provider.js';

const baseCall: TtsCall = {
  tenantId: 'tenant-1',
  voiceId: 'af_bella',
  text: 'Hello world from the Kokoro stub adapter.',
  outputFormat: 'wav',
  sampleRate: 24000,
};

describe('KokoroTtsProvider — construction', () => {
  it('defaults to stub mode', () => {
    const p = new KokoroTtsProvider();
    expect(p.mode).toBe('stub');
  });

  it('passes through descriptor fields (id / modality / license / sandbox / cost / latency)', () => {
    const p = new KokoroTtsProvider();
    expect(p.id).toBe(kokoroDescriptor.id);
    expect(p.modality.kind).toBe('tts');
    expect(p.license).toEqual(kokoroDescriptor.license);
    expect(p.sandbox).toEqual(kokoroDescriptor.sandbox);
    expect(p.costPerCall).toEqual(kokoroDescriptor.costPerCall);
    expect(p.latencyMs).toEqual(kokoroDescriptor.latencyMs);
  });

  it('exposes a strict TtsCapabilityDescriptor (no catalog-summary leakage)', () => {
    const p = new KokoroTtsProvider();
    expect(p.capability.voices).toHaveLength(10);
    expect(p.capability.outputFormats).toEqual(['wav']);
    expect(p.capability.sampleRates).toEqual([24000]);
    expect(p.capability.supportsVoiceClone).toBe(false);
    expect(p.capability.emitsWordTimestamps).toBe(false);
    // Catalog-summary fields are NOT on the strict capability surface
    // — they live on the raw `kokoroDescriptor.capability` envelope.
    expect((p.capability as Record<string, unknown>).voiceCount).toBeUndefined();
  });
});

describe('KokoroTtsProvider.synthesize — stub mode', () => {
  it('returns a TtsResult with a data:audio/wav;base64 url', async () => {
    const p = new KokoroTtsProvider({ mode: 'stub' });
    const result = await p.synthesize(baseCall);
    expect(result.url.startsWith('data:audio/wav;base64,')).toBe(true);
  });

  it('returns a cacheKey shaped <modality>/<64-hex>', async () => {
    const p = new KokoroTtsProvider({ mode: 'stub' });
    const result = await p.synthesize(baseCall);
    expect(result.cacheKey).toMatch(/^tts\/[0-9a-f]{64}$/);
  });

  it('returns durationS in [0.5, 60]', async () => {
    const p = new KokoroTtsProvider({ mode: 'stub' });
    const result = await p.synthesize(baseCall);
    expect(result.durationS).toBeGreaterThanOrEqual(0.5);
    expect(result.durationS).toBeLessThanOrEqual(60);
  });

  it('clamps a very-short prompt to MIN_DURATION_S = 0.5', async () => {
    const p = new KokoroTtsProvider({ mode: 'stub' });
    const result = await p.synthesize({ ...baseCall, text: 'Hi' });
    expect(result.durationS).toBe(0.5);
  });

  it('clamps an oversized prompt to MAX_DURATION_S = 60', async () => {
    const p = new KokoroTtsProvider({ mode: 'stub' });
    // 60 seconds at 15 chars/s = 900 chars; use 2000 to overflow.
    const result = await p.synthesize({ ...baseCall, text: 'x'.repeat(2000) });
    expect(result.durationS).toBe(60);
  });

  it('is deterministic — identical input → identical cacheKey + url', async () => {
    const p = new KokoroTtsProvider({ mode: 'stub' });
    const a = await p.synthesize(baseCall);
    const b = await p.synthesize(baseCall);
    expect(a.cacheKey).toBe(b.cacheKey);
    expect(a.url).toBe(b.url);
    expect(a.durationS).toBe(b.durationS);
  });

  it('produces different cacheKeys for different prompts', async () => {
    const p = new KokoroTtsProvider({ mode: 'stub' });
    const a = await p.synthesize(baseCall);
    const b = await p.synthesize({ ...baseCall, text: 'A different prompt entirely.' });
    expect(a.cacheKey).not.toBe(b.cacheKey);
  });

  it('produces different cacheKeys for different voiceIds', async () => {
    const p = new KokoroTtsProvider({ mode: 'stub' });
    const a = await p.synthesize(baseCall);
    const b = await p.synthesize({ ...baseCall, voiceId: 'am_adam' });
    expect(a.cacheKey).not.toBe(b.cacheKey);
  });

  it('produces different cacheKeys for different seeds', async () => {
    const p = new KokoroTtsProvider({ mode: 'stub' });
    const a = await p.synthesize({ ...baseCall, seed: 1 });
    const b = await p.synthesize({ ...baseCall, seed: 2 });
    expect(a.cacheKey).not.toBe(b.cacheKey);
  });

  it('seed-undefined ≠ seed-0 (the canonical formula renders absent seed as "none")', async () => {
    const p = new KokoroTtsProvider({ mode: 'stub' });
    const a = await p.synthesize(baseCall); // no seed
    const b = await p.synthesize({ ...baseCall, seed: 0 });
    expect(a.cacheKey).not.toBe(b.cacheKey);
  });
});

describe('KokoroTtsProvider.synthesize — input validation', () => {
  it('throws on unknown voiceId', async () => {
    const p = new KokoroTtsProvider({ mode: 'stub' });
    await expect(p.synthesize({ ...baseCall, voiceId: 'no_such_voice' })).rejects.toThrow(
      /unknown voiceId "no_such_voice"/,
    );
  });

  it('throws on non-wav outputFormat', async () => {
    const p = new KokoroTtsProvider({ mode: 'stub' });
    await expect(p.synthesize({ ...baseCall, outputFormat: 'mp3' })).rejects.toThrow(
      /unsupported outputFormat "mp3"/,
    );
  });

  it('throws on non-24000 sampleRate', async () => {
    const p = new KokoroTtsProvider({ mode: 'stub' });
    await expect(p.synthesize({ ...baseCall, sampleRate: 44100 })).rejects.toThrow(
      /unsupported sampleRate 44100/,
    );
  });

  it('validation errors fire BEFORE production-mode NotYetImplementedError (defensive ordering)', async () => {
    const p = new KokoroTtsProvider({ mode: 'production' });
    await expect(p.synthesize({ ...baseCall, voiceId: 'no_such_voice' })).rejects.toThrow(
      /unknown voiceId/,
    );
  });
});

describe('KokoroTtsProvider.synthesize — production mode', () => {
  it('throws NotYetImplementedError with the deferral note', async () => {
    const p = new KokoroTtsProvider({ mode: 'production' });
    await expect(p.synthesize(baseCall)).rejects.toBeInstanceOf(NotYetImplementedError);
    await expect(p.synthesize(baseCall)).rejects.toThrow(/T-426a/);
  });
});

describe('NotYetImplementedError', () => {
  it('extends Error and has name = "NotYetImplementedError"', () => {
    const err = new NotYetImplementedError('foo');
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('NotYetImplementedError');
    expect(err.message).toBe('foo');
  });
});
