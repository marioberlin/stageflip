// packages/music-acestep/src/provider.test.ts
// Coverage for `AceStepMusicProvider` — stub-mode happy path, validation
// errors, production-mode NotYetImplementedError, determinism. Per
// docs/tasks/T-432.md AC #7.

import { describe, expect, it } from 'vitest';

import type { MusicGenCall } from '@stageflip/asset-gen-contract';

import { aceStepDescriptor } from './descriptor.js';
import { AceStepMusicProvider, NotYetImplementedError } from './provider.js';

const baseCall: MusicGenCall = {
  prompt: 'A driving electronic track with a melodic intro',
  durationS: 60,
  outputFormat: 'wav',
};

describe('AceStepMusicProvider — construction', () => {
  it('defaults to stub mode', () => {
    const p = new AceStepMusicProvider();
    expect(p.mode).toBe('stub');
  });

  it('passes through descriptor fields (id / modality / license / sandbox / cost / latency)', () => {
    const p = new AceStepMusicProvider();
    expect(p.id).toBe(aceStepDescriptor.id);
    expect(p.modality.kind).toBe('music-gen');
    expect(p.license).toEqual(aceStepDescriptor.license);
    expect(p.sandbox).toEqual(aceStepDescriptor.sandbox);
    expect(p.costPerCall).toEqual(aceStepDescriptor.costPerCall);
    expect(p.latencyMs).toEqual(aceStepDescriptor.latencyMs);
  });

  it('exposes a strict MusicGenCapabilityDescriptor (no catalog-summary leakage)', () => {
    const p = new AceStepMusicProvider();
    expect(p.capability.genres).toHaveLength(8);
    expect(p.capability.outputFormats).toEqual(['wav', 'mp3']);
    expect(p.capability.maxDurationS).toBe(300);
    expect(p.capability.outputLicense).toBe('permissive');
    // Catalog-summary fields are NOT on the strict capability surface
    // — they live on the raw `aceStepDescriptor.capability` envelope.
    expect((p.capability as Record<string, unknown>).maxDurationSec).toBeUndefined();
    expect((p.capability as Record<string, unknown>).sampleRateHz).toBeUndefined();
  });
});

describe('AceStepMusicProvider.generate — stub mode', () => {
  it('returns a MusicGenResult with a data:audio/wav;base64 url', async () => {
    const p = new AceStepMusicProvider({ mode: 'stub' });
    const result = await p.generate(baseCall);
    expect(result.url.startsWith('data:audio/wav;base64,')).toBe(true);
  });

  it('returns a cacheKey shaped music-gen/<64-hex>', async () => {
    const p = new AceStepMusicProvider({ mode: 'stub' });
    const result = await p.generate(baseCall);
    expect(result.cacheKey).toMatch(/^music-gen\/[0-9a-f]{64}$/);
  });

  it('returns durationS equal to the input', async () => {
    const p = new AceStepMusicProvider({ mode: 'stub' });
    const result = await p.generate(baseCall);
    expect(result.durationS).toBe(60);
  });

  it('omits attribution (permissive output license)', async () => {
    const p = new AceStepMusicProvider({ mode: 'stub' });
    const result = await p.generate(baseCall);
    expect(result.attribution).toBeUndefined();
  });

  it('is deterministic — identical input → identical cacheKey + url', async () => {
    const p = new AceStepMusicProvider({ mode: 'stub' });
    const a = await p.generate(baseCall);
    const b = await p.generate(baseCall);
    expect(a.cacheKey).toBe(b.cacheKey);
    expect(a.url).toBe(b.url);
    expect(a.durationS).toBe(b.durationS);
  });

  it('produces different cacheKeys for different prompts', async () => {
    const p = new AceStepMusicProvider({ mode: 'stub' });
    const a = await p.generate(baseCall);
    const b = await p.generate({ ...baseCall, prompt: 'A jazz piano ballad' });
    expect(a.cacheKey).not.toBe(b.cacheKey);
  });

  it('produces different cacheKeys for different durations', async () => {
    const p = new AceStepMusicProvider({ mode: 'stub' });
    const a = await p.generate({ ...baseCall, durationS: 30 });
    const b = await p.generate({ ...baseCall, durationS: 120 });
    expect(a.cacheKey).not.toBe(b.cacheKey);
  });

  it('produces different cacheKeys for different genres', async () => {
    const p = new AceStepMusicProvider({ mode: 'stub' });
    const a = await p.generate({ ...baseCall, genre: 'electronic' });
    const b = await p.generate({ ...baseCall, genre: 'jazz' });
    expect(a.cacheKey).not.toBe(b.cacheKey);
  });

  it('produces different cacheKeys for different seeds', async () => {
    const p = new AceStepMusicProvider({ mode: 'stub' });
    const a = await p.generate({ ...baseCall, seed: 1 });
    const b = await p.generate({ ...baseCall, seed: 2 });
    expect(a.cacheKey).not.toBe(b.cacheKey);
  });

  it('succeeds with no genre (genre is optional)', async () => {
    const p = new AceStepMusicProvider({ mode: 'stub' });
    const result = await p.generate(baseCall);
    expect(result.cacheKey).toMatch(/^music-gen\/[0-9a-f]{64}$/);
  });

  it('emits a 44100Hz mono PCM WAV (matches declared sampleRateHz)', async () => {
    const p = new AceStepMusicProvider({ mode: 'stub' });
    const result = await p.generate(baseCall);
    const prefix = 'data:audio/wav;base64,';
    const bytes = new Uint8Array(Buffer.from(result.url.slice(prefix.length), 'base64'));
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    expect(view.getUint32(24, true)).toBe(44100); // sample rate
    expect(view.getUint16(22, true)).toBe(1); // num channels (mono)
    expect(view.getUint16(34, true)).toBe(16); // bits per sample
  });
});

describe('AceStepMusicProvider.generate — input validation', () => {
  it('throws on empty prompt', async () => {
    const p = new AceStepMusicProvider({ mode: 'stub' });
    await expect(p.generate({ ...baseCall, prompt: '' })).rejects.toThrow(
      /prompt must be non-empty/,
    );
  });

  it('throws on whitespace-only prompt', async () => {
    const p = new AceStepMusicProvider({ mode: 'stub' });
    await expect(p.generate({ ...baseCall, prompt: '   ' })).rejects.toThrow(
      /prompt must be non-empty/,
    );
  });

  it('throws on non-wav outputFormat (mp3 declared but stub body emits wav only)', async () => {
    const p = new AceStepMusicProvider({ mode: 'stub' });
    await expect(p.generate({ ...baseCall, outputFormat: 'mp3' })).rejects.toThrow(
      /unsupported outputFormat "mp3"/,
    );
  });

  it('throws on durationS > 300', async () => {
    const p = new AceStepMusicProvider({ mode: 'stub' });
    await expect(p.generate({ ...baseCall, durationS: 301 })).rejects.toThrow(
      /durationS .* out of range/,
    );
  });

  it('throws on durationS <= 0', async () => {
    const p = new AceStepMusicProvider({ mode: 'stub' });
    await expect(p.generate({ ...baseCall, durationS: 0 })).rejects.toThrow(
      /durationS .* out of range/,
    );
    await expect(p.generate({ ...baseCall, durationS: -1 })).rejects.toThrow(
      /durationS .* out of range/,
    );
  });

  it('throws on unknown genre', async () => {
    const p = new AceStepMusicProvider({ mode: 'stub' });
    await expect(p.generate({ ...baseCall, genre: 'opera' })).rejects.toThrow(
      /unknown genre "opera"/,
    );
  });

  it('validation errors fire BEFORE production-mode NotYetImplementedError (defensive ordering)', async () => {
    const p = new AceStepMusicProvider({ mode: 'production' });
    await expect(p.generate({ ...baseCall, prompt: '' })).rejects.toThrow(
      /prompt must be non-empty/,
    );
  });
});

describe('AceStepMusicProvider.generate — production mode', () => {
  it('throws NotYetImplementedError with the deferral note', async () => {
    const p = new AceStepMusicProvider({ mode: 'production' });
    await expect(p.generate(baseCall)).rejects.toBeInstanceOf(NotYetImplementedError);
    await expect(p.generate(baseCall)).rejects.toThrow(/T-432a/);
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
