// packages/sfx-stable-audio/src/provider.test.ts
// Coverage for `StableAudioSfxProvider` — stub-mode happy path,
// validation errors, production-mode NotYetImplementedError,
// determinism, isLoopable propagation. Per docs/tasks/T-434.md AC #7.

import { describe, expect, it } from 'vitest';

import type { SfxCall } from '@stageflip/asset-gen-contract';

import { stableAudioDescriptor } from './descriptor.js';
import { NotYetImplementedError, StableAudioSfxProvider } from './provider.js';

const baseCall: SfxCall = {
  prompt: 'A short metallic clang followed by reverb',
  durationS: 3,
  outputFormat: 'wav',
  sampleRate: 44100,
};

describe('StableAudioSfxProvider — construction', () => {
  it('defaults to stub mode', () => {
    const p = new StableAudioSfxProvider();
    expect(p.mode).toBe('stub');
  });

  it('passes through descriptor fields (id / modality / license / sandbox / cost / latency)', () => {
    const p = new StableAudioSfxProvider();
    expect(p.id).toBe(stableAudioDescriptor.id);
    expect(p.modality.kind).toBe('sfx');
    expect(p.license).toEqual(stableAudioDescriptor.license);
    expect(p.sandbox).toEqual(stableAudioDescriptor.sandbox);
    expect(p.costPerCall).toEqual(stableAudioDescriptor.costPerCall);
    expect(p.latencyMs).toEqual(stableAudioDescriptor.latencyMs);
  });

  it('exposes a strict SfxCapabilityDescriptor (no catalog-summary leakage)', () => {
    const p = new StableAudioSfxProvider();
    expect(p.capability.outputFormats).toEqual(['wav', 'mp3']);
    expect(p.capability.sampleRates).toEqual([44100]);
    expect(p.capability.maxDurationS).toBe(30);
    expect(p.capability.supportsLoop).toBe(true);
    // Catalog-summary fields are NOT on the strict capability surface
    // — they live on the raw `stableAudioDescriptor.capability` envelope.
    expect((p.capability as Record<string, unknown>).maxDurationSec).toBeUndefined();
    expect((p.capability as Record<string, unknown>).sampleRateHz).toBeUndefined();
  });
});

describe('StableAudioSfxProvider.generate — stub mode', () => {
  it('returns an SfxResult with a data:audio/wav;base64 url', async () => {
    const p = new StableAudioSfxProvider({ mode: 'stub' });
    const result = await p.generate(baseCall);
    expect(result.url.startsWith('data:audio/wav;base64,')).toBe(true);
  });

  it('returns a cacheKey shaped sfx/<64-hex>', async () => {
    const p = new StableAudioSfxProvider({ mode: 'stub' });
    const result = await p.generate(baseCall);
    expect(result.cacheKey).toMatch(/^sfx\/[0-9a-f]{64}$/);
  });

  it('returns durationS equal to the input', async () => {
    const p = new StableAudioSfxProvider({ mode: 'stub' });
    const result = await p.generate(baseCall);
    expect(result.durationS).toBe(3);
  });

  it('returns isLoopable = false when call.loop is undefined', async () => {
    const p = new StableAudioSfxProvider({ mode: 'stub' });
    const result = await p.generate(baseCall);
    expect(result.isLoopable).toBe(false);
  });

  it('returns isLoopable = true when call.loop = true (one-shot vs loop split)', async () => {
    const p = new StableAudioSfxProvider({ mode: 'stub' });
    const result = await p.generate({ ...baseCall, loop: true });
    expect(result.isLoopable).toBe(true);
  });

  it('returns isLoopable = false when call.loop = false (explicit one-shot)', async () => {
    const p = new StableAudioSfxProvider({ mode: 'stub' });
    const result = await p.generate({ ...baseCall, loop: false });
    expect(result.isLoopable).toBe(false);
  });

  it('is deterministic — identical input → identical cacheKey + url', async () => {
    const p = new StableAudioSfxProvider({ mode: 'stub' });
    const a = await p.generate(baseCall);
    const b = await p.generate(baseCall);
    expect(a.cacheKey).toBe(b.cacheKey);
    expect(a.url).toBe(b.url);
    expect(a.durationS).toBe(b.durationS);
  });

  it('produces different cacheKeys for different prompts', async () => {
    const p = new StableAudioSfxProvider({ mode: 'stub' });
    const a = await p.generate(baseCall);
    const b = await p.generate({ ...baseCall, prompt: 'A soft ambient drone' });
    expect(a.cacheKey).not.toBe(b.cacheKey);
  });

  it('produces different cacheKeys for different durations', async () => {
    const p = new StableAudioSfxProvider({ mode: 'stub' });
    const a = await p.generate({ ...baseCall, durationS: 5 });
    const b = await p.generate({ ...baseCall, durationS: 10 });
    expect(a.cacheKey).not.toBe(b.cacheKey);
  });

  it('produces different cacheKeys for different loop flags', async () => {
    const p = new StableAudioSfxProvider({ mode: 'stub' });
    const a = await p.generate({ ...baseCall, loop: true });
    const b = await p.generate({ ...baseCall, loop: false });
    expect(a.cacheKey).not.toBe(b.cacheKey);
  });

  it('produces different cacheKeys for different seeds', async () => {
    const p = new StableAudioSfxProvider({ mode: 'stub' });
    const a = await p.generate({ ...baseCall, seed: 1 });
    const b = await p.generate({ ...baseCall, seed: 2 });
    expect(a.cacheKey).not.toBe(b.cacheKey);
  });

  it('emits a 44100Hz mono PCM WAV (matches declared sampleRateHz)', async () => {
    const p = new StableAudioSfxProvider({ mode: 'stub' });
    const result = await p.generate(baseCall);
    const prefix = 'data:audio/wav;base64,';
    const bytes = new Uint8Array(Buffer.from(result.url.slice(prefix.length), 'base64'));
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    expect(view.getUint32(24, true)).toBe(44100); // sample rate
    expect(view.getUint16(22, true)).toBe(1); // num channels (mono)
    expect(view.getUint16(34, true)).toBe(16); // bits per sample
  });
});

describe('StableAudioSfxProvider.generate — input validation', () => {
  it('throws on empty prompt', async () => {
    const p = new StableAudioSfxProvider({ mode: 'stub' });
    await expect(p.generate({ ...baseCall, prompt: '' })).rejects.toThrow(
      /prompt must be non-empty/,
    );
  });

  it('throws on whitespace-only prompt', async () => {
    const p = new StableAudioSfxProvider({ mode: 'stub' });
    await expect(p.generate({ ...baseCall, prompt: '   ' })).rejects.toThrow(
      /prompt must be non-empty/,
    );
  });

  it('throws on non-wav outputFormat (mp3 declared but stub body emits wav only)', async () => {
    const p = new StableAudioSfxProvider({ mode: 'stub' });
    await expect(p.generate({ ...baseCall, outputFormat: 'mp3' })).rejects.toThrow(
      /unsupported outputFormat "mp3"/,
    );
  });

  it('throws on durationS > 30 (short-form SFX cap)', async () => {
    const p = new StableAudioSfxProvider({ mode: 'stub' });
    await expect(p.generate({ ...baseCall, durationS: 31 })).rejects.toThrow(
      /durationS .* out of range/,
    );
  });

  it('throws on durationS <= 0', async () => {
    const p = new StableAudioSfxProvider({ mode: 'stub' });
    await expect(p.generate({ ...baseCall, durationS: 0 })).rejects.toThrow(
      /durationS .* out of range/,
    );
    await expect(p.generate({ ...baseCall, durationS: -1 })).rejects.toThrow(
      /durationS .* out of range/,
    );
  });

  it('throws on unknown sampleRate', async () => {
    const p = new StableAudioSfxProvider({ mode: 'stub' });
    await expect(p.generate({ ...baseCall, sampleRate: 48000 })).rejects.toThrow(
      /unsupported sampleRate 48000/,
    );
  });

  it('validation errors fire BEFORE production-mode NotYetImplementedError (defensive ordering)', async () => {
    const p = new StableAudioSfxProvider({ mode: 'production' });
    await expect(p.generate({ ...baseCall, prompt: '' })).rejects.toThrow(
      /prompt must be non-empty/,
    );
  });
});

describe('StableAudioSfxProvider.generate — production mode', () => {
  it('throws NotYetImplementedError with the deferral note', async () => {
    const p = new StableAudioSfxProvider({ mode: 'production' });
    await expect(p.generate(baseCall)).rejects.toBeInstanceOf(NotYetImplementedError);
    await expect(p.generate(baseCall)).rejects.toThrow(/T-434a/);
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
