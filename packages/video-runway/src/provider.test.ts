// packages/video-runway/src/provider.test.ts
// Coverage for `RunwayVideoProvider` — stub-mode happy path, validation
// errors, production-mode NotYetImplementedError, determinism. Per
// docs/tasks/T-431.md AC #7.

import { describe, expect, it } from 'vitest';

import type { VideoGenCall } from '@stageflip/asset-gen-contract';

import { runwayDescriptor } from './descriptor.js';
import { NotYetImplementedError, RunwayVideoProvider } from './provider.js';

const baseCall: VideoGenCall = {
  prompt: 'A cinematic shot of a sunrise over a calm sea, golden hour, drone view.',
  aspectRatio: '16:9',
  frameRate: 24,
  durationS: 10,
  outputFormat: 'mp4',
};

describe('RunwayVideoProvider — construction', () => {
  it('defaults to stub mode', () => {
    const p = new RunwayVideoProvider();
    expect(p.mode).toBe('stub');
  });

  it('passes through descriptor fields (id / modality / license / sandbox / cost / latency)', () => {
    const p = new RunwayVideoProvider();
    expect(p.id).toBe(runwayDescriptor.id);
    expect(p.modality.kind).toBe('video-gen');
    expect(p.license).toEqual(runwayDescriptor.license);
    expect(p.sandbox).toEqual(runwayDescriptor.sandbox);
    expect(p.costPerCall).toEqual(runwayDescriptor.costPerCall);
    expect(p.latencyMs).toEqual(runwayDescriptor.latencyMs);
  });

  it('exposes a strict VideoGenCapabilityDescriptor (no catalog-summary / differentiator leakage)', () => {
    const p = new RunwayVideoProvider();
    expect(p.capability.outputFormats).toEqual(['mp4']);
    expect(p.capability.aspectRatios).toEqual(['16:9', '9:16', '1:1', '4:3', '3:4']);
    expect(p.capability.frameRates).toEqual([24]);
    expect(p.capability.maxDurationS).toBe(10);
    expect(p.capability.emitsAudio).toBe(false);
    expect(p.capability.safetyFilters).toEqual([]);
    // Catalog-summary + differentiator fields are NOT on the strict
    // capability surface — they live on the raw
    // `runwayDescriptor.capability` envelope.
    expect((p.capability as Record<string, unknown>).maxDurationSec).toBeUndefined();
    expect((p.capability as Record<string, unknown>).supportsLipSync).toBeUndefined();
    expect((p.capability as Record<string, unknown>).supportsNativeAudio).toBeUndefined();
    expect((p.capability as Record<string, unknown>).supportedResolutions).toBeUndefined();
    expect((p.capability as Record<string, unknown>).qualityHint).toBeUndefined();
  });
});

describe('RunwayVideoProvider.generate — stub mode', () => {
  it('returns a VideoGenResult with a data:video/mp4;base64 url', async () => {
    const p = new RunwayVideoProvider({ mode: 'stub' });
    const result = await p.generate(baseCall);
    expect(result.url.startsWith('data:video/mp4;base64,')).toBe(true);
  });

  it('returns a cacheKey shaped <modality>/<64-hex>', async () => {
    const p = new RunwayVideoProvider({ mode: 'stub' });
    const result = await p.generate(baseCall);
    expect(result.cacheKey).toMatch(/^video-gen\/[0-9a-f]{64}$/);
  });

  it('echoes durationS / aspectRatio / frameRate from the request', async () => {
    const p = new RunwayVideoProvider({ mode: 'stub' });
    const result = await p.generate(baseCall);
    expect(result.durationS).toBe(baseCall.durationS);
    expect(result.aspectRatio).toBe(baseCall.aspectRatio);
    expect(result.frameRate).toBe(baseCall.frameRate);
  });

  it('is deterministic — identical input → identical cacheKey + url (cache-key roundtrip)', async () => {
    const p = new RunwayVideoProvider({ mode: 'stub' });
    const a = await p.generate(baseCall);
    const b = await p.generate(baseCall);
    expect(a.cacheKey).toBe(b.cacheKey);
    expect(a.url).toBe(b.url);
    expect(a.durationS).toBe(b.durationS);
    expect(a.aspectRatio).toBe(b.aspectRatio);
    expect(a.frameRate).toBe(b.frameRate);
  });

  it('produces different cacheKeys for different prompts', async () => {
    const p = new RunwayVideoProvider({ mode: 'stub' });
    const a = await p.generate(baseCall);
    const b = await p.generate({ ...baseCall, prompt: 'A bustling cyberpunk night market' });
    expect(a.cacheKey).not.toBe(b.cacheKey);
  });

  it('produces different cacheKeys for different aspect ratios', async () => {
    const p = new RunwayVideoProvider({ mode: 'stub' });
    const a = await p.generate(baseCall);
    const b = await p.generate({ ...baseCall, aspectRatio: '4:3' });
    expect(a.cacheKey).not.toBe(b.cacheKey);
  });

  it('produces different cacheKeys for different durations', async () => {
    const p = new RunwayVideoProvider({ mode: 'stub' });
    const a = await p.generate(baseCall);
    const b = await p.generate({ ...baseCall, durationS: 5 });
    expect(a.cacheKey).not.toBe(b.cacheKey);
  });

  it('produces different cacheKeys for different seeds', async () => {
    const p = new RunwayVideoProvider({ mode: 'stub' });
    const a = await p.generate({ ...baseCall, seed: 1 });
    const b = await p.generate({ ...baseCall, seed: 2 });
    expect(a.cacheKey).not.toBe(b.cacheKey);
  });

  it('seed-undefined ≠ seed-0 (the canonical formula renders absent seed as "none")', async () => {
    const p = new RunwayVideoProvider({ mode: 'stub' });
    const a = await p.generate(baseCall); // no seed
    const b = await p.generate({ ...baseCall, seed: 0 });
    expect(a.cacheKey).not.toBe(b.cacheKey);
  });
});

describe('RunwayVideoProvider.generate — input validation', () => {
  it('throws on empty prompt', async () => {
    const p = new RunwayVideoProvider({ mode: 'stub' });
    await expect(p.generate({ ...baseCall, prompt: '' })).rejects.toThrow(/non-empty/);
  });

  it('throws on whitespace-only prompt', async () => {
    const p = new RunwayVideoProvider({ mode: 'stub' });
    await expect(p.generate({ ...baseCall, prompt: '   ' })).rejects.toThrow(/non-empty/);
  });

  it('validation errors fire BEFORE production-mode NotYetImplementedError (defensive ordering)', async () => {
    const p = new RunwayVideoProvider({ mode: 'production' });
    await expect(p.generate({ ...baseCall, prompt: '' })).rejects.toThrow(/non-empty/);
  });
});

describe('RunwayVideoProvider.generate — production mode', () => {
  it('throws NotYetImplementedError with the deferral note', async () => {
    const p = new RunwayVideoProvider({ mode: 'production' });
    await expect(p.generate(baseCall)).rejects.toBeInstanceOf(NotYetImplementedError);
    await expect(p.generate(baseCall)).rejects.toThrow(/T-431a/);
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
