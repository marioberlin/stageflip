// packages/3d-meshy/src/provider.test.ts
// Coverage for `MeshyThreeDProvider` — stub-mode happy path, validation
// errors, production-mode NotYetImplementedError, determinism,
// no-auto-rigging invariant. Per docs/tasks/T-429.md AC #7.

import { describe, expect, it } from 'vitest';

import type { ThreeDCall } from '@stageflip/asset-gen-contract';

import { meshyDescriptor } from './descriptor.js';
import { MeshyThreeDProvider, NotYetImplementedError } from './provider.js';

const baseCall: ThreeDCall = {
  prompt: 'A small wooden treasure chest, weathered.',
};

describe('MeshyThreeDProvider — construction', () => {
  it('defaults to stub mode', () => {
    const p = new MeshyThreeDProvider();
    expect(p.mode).toBe('stub');
  });

  it('passes through descriptor fields (id / modality / license / sandbox / cost / latency)', () => {
    const p = new MeshyThreeDProvider();
    expect(p.id).toBe(meshyDescriptor.id);
    expect(p.modality.kind).toBe('three-d');
    expect(p.license).toEqual(meshyDescriptor.license);
    expect(p.sandbox).toEqual(meshyDescriptor.sandbox);
    expect(p.costPerCall).toEqual(meshyDescriptor.costPerCall);
    expect(p.latencyMs).toEqual(meshyDescriptor.latencyMs);
  });

  it('exposes a strict ThreeDCapabilityDescriptor (no catalog-summary leakage)', () => {
    const p = new MeshyThreeDProvider();
    expect(p.capability.outputFormats).toEqual(['glb']);
    expect(p.capability.topology).toBe('triangle-soup');
    expect(p.capability.supportsAutoRigging).toBe(false);
    expect(p.capability.maxVertices).toBe(30_000);
    // Catalog-summary fields are NOT on the strict capability surface
    // — they live on the raw `meshyDescriptor.capability` envelope.
    expect((p.capability as Record<string, unknown>).formats).toBeUndefined();
    expect((p.capability as Record<string, unknown>).maxPolyCount).toBeUndefined();
  });
});

describe('MeshyThreeDProvider.generate — stub mode', () => {
  it('returns a ThreeDResult with a data:model/gltf-binary;base64 url', async () => {
    const p = new MeshyThreeDProvider({ mode: 'stub' });
    const result = await p.generate(baseCall);
    expect(result.url.startsWith('data:model/gltf-binary;base64,')).toBe(true);
  });

  it('returns a cacheKey shaped <modality>/<64-hex>', async () => {
    const p = new MeshyThreeDProvider({ mode: 'stub' });
    const result = await p.generate(baseCall);
    expect(result.cacheKey).toMatch(/^three-d\/[0-9a-f]{64}$/);
  });

  it('returns vertices = 12 (icosahedron placeholder)', async () => {
    const p = new MeshyThreeDProvider({ mode: 'stub' });
    const result = await p.generate(baseCall);
    expect(result.vertices).toBe(12);
  });

  it('returns rigged = false (capability declares supportsAutoRigging: false)', async () => {
    const p = new MeshyThreeDProvider({ mode: 'stub' });
    const result = await p.generate(baseCall);
    expect(result.rigged).toBe(false);
  });

  it('ALSO returns rigged = false when rig: true (request silently refused; props do not rig)', async () => {
    const p = new MeshyThreeDProvider({ mode: 'stub' });
    const result = await p.generate({ ...baseCall, rig: true });
    expect(result.rigged).toBe(false);
  });

  it('is deterministic — identical input → identical cacheKey + url (cache-key roundtrip)', async () => {
    const p = new MeshyThreeDProvider({ mode: 'stub' });
    const a = await p.generate(baseCall);
    const b = await p.generate(baseCall);
    expect(a.cacheKey).toBe(b.cacheKey);
    expect(a.url).toBe(b.url);
    expect(a.vertices).toBe(b.vertices);
    expect(a.rigged).toBe(b.rigged);
  });

  it('produces different cacheKeys for different prompts', async () => {
    const p = new MeshyThreeDProvider({ mode: 'stub' });
    const a = await p.generate(baseCall);
    const b = await p.generate({ ...baseCall, prompt: 'A medieval cobblestone street' });
    expect(a.cacheKey).not.toBe(b.cacheKey);
  });

  it('produces IDENTICAL cacheKeys for different rig flags (rig is forced false in params)', async () => {
    const p = new MeshyThreeDProvider({ mode: 'stub' });
    const a = await p.generate({ ...baseCall, rig: false });
    const b = await p.generate({ ...baseCall, rig: true });
    // capability.supportsAutoRigging = false → rig is forced false in the
    // cache-key params dict regardless of caller input.
    expect(a.cacheKey).toBe(b.cacheKey);
  });

  it('produces different cacheKeys for different seeds', async () => {
    const p = new MeshyThreeDProvider({ mode: 'stub' });
    const a = await p.generate({ ...baseCall, seed: 1 });
    const b = await p.generate({ ...baseCall, seed: 2 });
    expect(a.cacheKey).not.toBe(b.cacheKey);
  });

  it('seed-undefined ≠ seed-0 (the canonical formula renders absent seed as "none")', async () => {
    const p = new MeshyThreeDProvider({ mode: 'stub' });
    const a = await p.generate(baseCall); // no seed
    const b = await p.generate({ ...baseCall, seed: 0 });
    expect(a.cacheKey).not.toBe(b.cacheKey);
  });
});

describe('MeshyThreeDProvider.generate — input validation', () => {
  it('throws on empty prompt', async () => {
    const p = new MeshyThreeDProvider({ mode: 'stub' });
    await expect(p.generate({ ...baseCall, prompt: '' })).rejects.toThrow(/non-empty/);
  });

  it('throws on whitespace-only prompt', async () => {
    const p = new MeshyThreeDProvider({ mode: 'stub' });
    await expect(p.generate({ ...baseCall, prompt: '   ' })).rejects.toThrow(/non-empty/);
  });

  it('validation errors fire BEFORE production-mode NotYetImplementedError (defensive ordering)', async () => {
    const p = new MeshyThreeDProvider({ mode: 'production' });
    await expect(p.generate({ ...baseCall, prompt: '' })).rejects.toThrow(/non-empty/);
  });
});

describe('MeshyThreeDProvider.generate — production mode', () => {
  it('throws NotYetImplementedError with the deferral note', async () => {
    const p = new MeshyThreeDProvider({ mode: 'production' });
    await expect(p.generate(baseCall)).rejects.toBeInstanceOf(NotYetImplementedError);
    await expect(p.generate(baseCall)).rejects.toThrow(/T-429a/);
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
