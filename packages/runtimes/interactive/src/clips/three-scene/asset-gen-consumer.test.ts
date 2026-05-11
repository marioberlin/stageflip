// packages/runtimes/interactive/src/clips/three-scene/asset-gen-consumer.test.ts
// Unit tests for the 3D→ThreeSceneClip GLB consumer (T-437): whitelist,
// kind discriminator, cache-miss / empty-bytes fallback, provider lookup
// recording. Mirrors the captions/tts-bypass.test.ts shape from T-436.

import { describe, expect, it, vi } from 'vitest';

import {
  type AssetCacheLookup,
  type AssetGenSeedSrc,
  THREE_D_BYPASS_WHITELIST,
  resolveAssetGenGlb,
} from './asset-gen-consumer.js';

// ----- fixtures -----

const SAMPLE_GLB_BYTES = new Uint8Array([0x67, 0x6c, 0x54, 0x46, 0x02, 0x00, 0x00, 0x00]);

const validTripoSeed: AssetGenSeedSrc = {
  kind: 'asset-gen',
  cacheKey: 'three-d/abc123',
  provider: 'tripo',
};

const validMeshySeed: AssetGenSeedSrc = {
  kind: 'asset-gen',
  cacheKey: 'three-d/def456',
  provider: 'meshy',
};

function makeLookup(map: Record<string, Uint8Array>): AssetCacheLookup {
  return async (key: string) => map[key];
}

// ----- whitelist -----

describe('THREE_D_BYPASS_WHITELIST', () => {
  it('contains tripo and meshy', () => {
    expect(THREE_D_BYPASS_WHITELIST).toContain('tripo');
    expect(THREE_D_BYPASS_WHITELIST).toContain('meshy');
  });

  it('has exactly two entries (T-437 ships with Tripo + Meshy only)', () => {
    expect(THREE_D_BYPASS_WHITELIST).toHaveLength(2);
  });
});

// ----- resolveAssetGenGlb -----

describe('resolveAssetGenGlb', () => {
  it('returns ok with bytes for a whitelisted tripo cacheKey', async () => {
    const lookup = makeLookup({ 'three-d/abc123': SAMPLE_GLB_BYTES });
    const result = await resolveAssetGenGlb(validTripoSeed, lookup);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('unreachable');
    expect(result.bytes).toBe(SAMPLE_GLB_BYTES);
    expect(result.provider).toBe('tripo');
  });

  it('returns ok with bytes for a whitelisted meshy cacheKey', async () => {
    const lookup = makeLookup({ 'three-d/def456': SAMPLE_GLB_BYTES });
    const result = await resolveAssetGenGlb(validMeshySeed, lookup);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('unreachable');
    expect(result.bytes).toBe(SAMPLE_GLB_BYTES);
    expect(result.provider).toBe('meshy');
  });

  it('returns ok=false with kind-mismatch when seedSrc.kind is not "asset-gen"', async () => {
    const lookup = makeLookup({ 'three-d/abc123': SAMPLE_GLB_BYTES });
    const result = await resolveAssetGenGlb(
      // Deliberate cast: testing the wrong-kind fallback path.
      { kind: 'live', cacheKey: 'three-d/abc123', provider: 'tripo' } as unknown as AssetGenSeedSrc,
      lookup,
    );
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('unreachable');
    expect(result.reason).toBe('kind-mismatch');
  });

  it('returns ok=false with provider-not-whitelisted when provider is unknown', async () => {
    const lookup = makeLookup({ 'three-d/abc123': SAMPLE_GLB_BYTES });
    const result = await resolveAssetGenGlb(
      { kind: 'asset-gen', cacheKey: 'three-d/abc123', provider: 'rodin' },
      lookup,
    );
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('unreachable');
    expect(result.reason).toBe('provider-not-whitelisted');
  });

  it('returns ok=false with provider-missing when provider field is absent', async () => {
    const lookup = makeLookup({ 'three-d/abc123': SAMPLE_GLB_BYTES });
    const result = await resolveAssetGenGlb(
      // Deliberate cast: testing absent-provider path.
      { kind: 'asset-gen', cacheKey: 'three-d/abc123' } as unknown as AssetGenSeedSrc,
      lookup,
    );
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('unreachable');
    expect(result.reason).toBe('provider-missing');
  });

  it('returns ok=false with cacheKey-missing when cacheKey is empty', async () => {
    const lookup = makeLookup({});
    const result = await resolveAssetGenGlb(
      { kind: 'asset-gen', cacheKey: '', provider: 'tripo' },
      lookup,
    );
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('unreachable');
    expect(result.reason).toBe('cacheKey-missing');
  });

  it('returns ok=false with cache-miss when cache returns undefined', async () => {
    const lookup = makeLookup({});
    const result = await resolveAssetGenGlb(validTripoSeed, lookup);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('unreachable');
    expect(result.reason).toBe('cache-miss');
  });

  it('returns ok=false with cache-empty when cache returns zero-length bytes', async () => {
    const lookup = makeLookup({ 'three-d/abc123': new Uint8Array(0) });
    const result = await resolveAssetGenGlb(validTripoSeed, lookup);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('unreachable');
    expect(result.reason).toBe('cache-empty');
  });

  it('invokes the cache lookup with the exact cacheKey string', async () => {
    const lookup = vi.fn<AssetCacheLookup>(async () => SAMPLE_GLB_BYTES);
    await resolveAssetGenGlb(validTripoSeed, lookup);
    expect(lookup).toHaveBeenCalledTimes(1);
    expect(lookup).toHaveBeenCalledWith('three-d/abc123');
  });

  it('does NOT invoke the cache lookup when whitelist check fails', async () => {
    const lookup = vi.fn<AssetCacheLookup>(async () => SAMPLE_GLB_BYTES);
    await resolveAssetGenGlb(
      { kind: 'asset-gen', cacheKey: 'three-d/abc123', provider: 'rodin' },
      lookup,
    );
    expect(lookup).not.toHaveBeenCalled();
  });

  it('does NOT invoke the cache lookup when kind discriminator fails', async () => {
    const lookup = vi.fn<AssetCacheLookup>(async () => SAMPLE_GLB_BYTES);
    await resolveAssetGenGlb(
      { kind: 'live', cacheKey: 'three-d/abc123', provider: 'tripo' } as unknown as AssetGenSeedSrc,
      lookup,
    );
    expect(lookup).not.toHaveBeenCalled();
  });
});
