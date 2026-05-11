// packages/3d-tripo/src/provider.test.ts
// Coverage for `TripoThreeDProvider` — stub-mode happy path, validation
// errors, production-mode NotYetImplementedError, determinism. Per
// docs/tasks/T-428.md AC #7.

import { describe, expect, it } from 'vitest';

import type { ThreeDCall } from '@stageflip/asset-gen-contract';

import { tripoDescriptor } from './descriptor.js';
import { NotYetImplementedError, TripoThreeDProvider } from './provider.js';

const baseCall: ThreeDCall = {
  prompt: 'A friendly cartoon wizard character.',
};

describe('TripoThreeDProvider — construction', () => {
  it('defaults to stub mode', () => {
    const p = new TripoThreeDProvider();
    expect(p.mode).toBe('stub');
  });

  it('passes through descriptor fields (id / modality / license / sandbox / cost / latency)', () => {
    const p = new TripoThreeDProvider();
    expect(p.id).toBe(tripoDescriptor.id);
    expect(p.modality.kind).toBe('three-d');
    expect(p.license).toEqual(tripoDescriptor.license);
    expect(p.sandbox).toEqual(tripoDescriptor.sandbox);
    expect(p.costPerCall).toEqual(tripoDescriptor.costPerCall);
    expect(p.latencyMs).toEqual(tripoDescriptor.latencyMs);
  });

  it('exposes a strict ThreeDCapabilityDescriptor (no catalog-summary leakage)', () => {
    const p = new TripoThreeDProvider();
    expect(p.capability.outputFormats).toEqual(['glb']);
    expect(p.capability.topology).toBe('quad-clean');
    expect(p.capability.supportsAutoRigging).toBe(true);
    expect(p.capability.maxVertices).toBe(50_000);
    // Catalog-summary fields are NOT on the strict capability surface
    // — they live on the raw `tripoDescriptor.capability` envelope.
    expect((p.capability as Record<string, unknown>).formats).toBeUndefined();
    expect((p.capability as Record<string, unknown>).maxPolyCount).toBeUndefined();
  });
});

describe('TripoThreeDProvider.generate — stub mode', () => {
  it('returns a ThreeDResult with a data:model/gltf-binary;base64 url', async () => {
    const p = new TripoThreeDProvider({ mode: 'stub' });
    const result = await p.generate(baseCall);
    expect(result.url.startsWith('data:model/gltf-binary;base64,')).toBe(true);
  });

  it('returns a cacheKey shaped <modality>/<64-hex>', async () => {
    const p = new TripoThreeDProvider({ mode: 'stub' });
    const result = await p.generate(baseCall);
    expect(result.cacheKey).toMatch(/^three-d\/[0-9a-f]{64}$/);
  });

  it('returns vertices = 8 (unit-cube placeholder)', async () => {
    const p = new TripoThreeDProvider({ mode: 'stub' });
    const result = await p.generate(baseCall);
    expect(result.vertices).toBe(8);
  });

  it('returns rigged = false when rig flag omitted', async () => {
    const p = new TripoThreeDProvider({ mode: 'stub' });
    const result = await p.generate(baseCall);
    expect(result.rigged).toBe(false);
  });

  it('returns rigged = true when rig: true (capability supports auto-rigging)', async () => {
    const p = new TripoThreeDProvider({ mode: 'stub' });
    const result = await p.generate({ ...baseCall, rig: true });
    expect(result.rigged).toBe(true);
  });

  it('is deterministic — identical input → identical cacheKey + url (cache-key roundtrip)', async () => {
    const p = new TripoThreeDProvider({ mode: 'stub' });
    const a = await p.generate(baseCall);
    const b = await p.generate(baseCall);
    expect(a.cacheKey).toBe(b.cacheKey);
    expect(a.url).toBe(b.url);
    expect(a.vertices).toBe(b.vertices);
    expect(a.rigged).toBe(b.rigged);
  });

  it('produces different cacheKeys for different prompts', async () => {
    const p = new TripoThreeDProvider({ mode: 'stub' });
    const a = await p.generate(baseCall);
    const b = await p.generate({ ...baseCall, prompt: 'A robot dragon' });
    expect(a.cacheKey).not.toBe(b.cacheKey);
  });

  it('produces different cacheKeys for different rig flags', async () => {
    const p = new TripoThreeDProvider({ mode: 'stub' });
    const a = await p.generate({ ...baseCall, rig: false });
    const b = await p.generate({ ...baseCall, rig: true });
    expect(a.cacheKey).not.toBe(b.cacheKey);
  });

  it('produces different cacheKeys for different seeds', async () => {
    const p = new TripoThreeDProvider({ mode: 'stub' });
    const a = await p.generate({ ...baseCall, seed: 1 });
    const b = await p.generate({ ...baseCall, seed: 2 });
    expect(a.cacheKey).not.toBe(b.cacheKey);
  });

  it('seed-undefined ≠ seed-0 (the canonical formula renders absent seed as "none")', async () => {
    const p = new TripoThreeDProvider({ mode: 'stub' });
    const a = await p.generate(baseCall); // no seed
    const b = await p.generate({ ...baseCall, seed: 0 });
    expect(a.cacheKey).not.toBe(b.cacheKey);
  });
});

describe('TripoThreeDProvider.generate — input validation', () => {
  it('throws on empty prompt', async () => {
    const p = new TripoThreeDProvider({ mode: 'stub' });
    await expect(p.generate({ ...baseCall, prompt: '' })).rejects.toThrow(/non-empty/);
  });

  it('throws on whitespace-only prompt', async () => {
    const p = new TripoThreeDProvider({ mode: 'stub' });
    await expect(p.generate({ ...baseCall, prompt: '   ' })).rejects.toThrow(/non-empty/);
  });

  it('validation errors fire BEFORE production-mode NotYetImplementedError (defensive ordering)', async () => {
    const p = new TripoThreeDProvider({ mode: 'production' });
    await expect(p.generate({ ...baseCall, prompt: '' })).rejects.toThrow(/non-empty/);
  });
});

describe('TripoThreeDProvider.generate — production mode', () => {
  it('throws NotYetImplementedError with the deferral note', async () => {
    const p = new TripoThreeDProvider({ mode: 'production' });
    await expect(p.generate(baseCall)).rejects.toBeInstanceOf(NotYetImplementedError);
    await expect(p.generate(baseCall)).rejects.toThrow(/T-428a/);
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
