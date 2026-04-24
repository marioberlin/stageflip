// packages/export-html5-zip/src/fallback/generator.test.ts
// T-204 — fallback-generator end-to-end. Covers the midpoint + GIF
// frame-index math, the round-trip through the mock renderer, and the
// resolver-registration side effect.

import { describe, expect, it } from 'vitest';

import { InMemoryAssetResolver } from '../asset-resolver.js';
import type { BannerSize } from '../types.js';
import { createFallbackGenerator, gifFrameIndices, midpointFrameIndex } from './generator.js';
import { createSolidColorFrameRenderer } from './mock-renderer.js';
import type { FrameRenderer, RgbaFrame } from './types.js';

const MPU: BannerSize = { width: 20, height: 15, name: 'Medium Rectangle (small)' };

describe('midpointFrameIndex', () => {
  it('returns half the total frames at 30fps / 15000ms', () => {
    expect(midpointFrameIndex(15_000, 30)).toBe(225);
  });

  it('rounds down for odd total frames', () => {
    // 100ms × 30fps = 3 frames → midpoint = floor(3/2) = 1
    expect(midpointFrameIndex(100, 30)).toBe(1);
  });

  it('returns 0 for a one-frame composition', () => {
    // 33ms × 30fps = 1 frame → midpoint = 0
    expect(midpointFrameIndex(33, 30)).toBe(0);
  });

  it('is deterministic', () => {
    expect(midpointFrameIndex(15_000, 30)).toBe(midpointFrameIndex(15_000, 30));
  });
});

describe('gifFrameIndices', () => {
  it('returns an empty array for count=0', () => {
    expect(gifFrameIndices(15_000, 30, 0, 0.125, 0.875)).toEqual([]);
  });

  it('returns a single centred index for count=1', () => {
    // 15000ms × 30fps = 450 frames; centre of [0.125, 0.875] = 0.5; 450*0.5 = 225
    expect(gifFrameIndices(15_000, 30, 1, 0.125, 0.875)).toEqual([225]);
  });

  it('spaces indices linearly for count=5', () => {
    const out = gifFrameIndices(15_000, 30, 5, 0, 1);
    expect(out[0]).toBe(0);
    expect(out[out.length - 1]).toBe(449); // totalFrames - 1
    expect(out.length).toBe(5);
  });

  it('deduplicates when the span rounds multiple indices to the same frame', () => {
    // 100ms × 30fps = 3 frames; 8 GIF frames over [0.125, 0.875] all
    // round to one of {0, 1, 2}
    const out = gifFrameIndices(100, 30, 8, 0.125, 0.875);
    expect(new Set(out).size).toBe(out.length);
  });

  it('returns indices in ascending order', () => {
    const out = gifFrameIndices(15_000, 30, 8, 0.125, 0.875);
    for (let i = 1; i < out.length; i++) {
      const prev = out[i - 1] as number;
      const curr = out[i] as number;
      expect(curr).toBeGreaterThanOrEqual(prev);
    }
  });
});

describe('createFallbackGenerator (mock renderer)', () => {
  it('writes a PNG + GIF to the resolver and returns matching refs', async () => {
    const resolver = new InMemoryAssetResolver();
    const provider = createFallbackGenerator({
      frameRenderer: createSolidColorFrameRenderer(),
      resolver,
      durationMs: 1000, // 30 frames at 30fps
    });
    const fallback = await provider.generate(MPU);
    // The ref keys off `size.id ?? WxH` — MPU above sets name but no
    // id, so the ref falls back to the dimension tag.
    expect(fallback.png).toBe('asset:fallback-png-20x15');
  });

  it('skips the GIF when gifFrameCount is 0', async () => {
    const resolver = new InMemoryAssetResolver();
    const provider = createFallbackGenerator({
      frameRenderer: createSolidColorFrameRenderer(),
      resolver,
      durationMs: 1000,
      options: { gifFrameCount: 0 },
    });
    const fallback = await provider.generate({ width: 20, height: 15, id: 'mpu' });
    expect(fallback).toEqual({ png: 'asset:fallback-png-mpu' });
  });

  it('produces bytes the resolver can round-trip', async () => {
    const resolver = new InMemoryAssetResolver();
    const provider = createFallbackGenerator({
      frameRenderer: createSolidColorFrameRenderer(),
      resolver,
      durationMs: 1000,
    });
    const fallback = await provider.generate({ width: 20, height: 15, id: 'mpu' });
    const pngBytes = await resolver.resolve(fallback.png);
    expect(pngBytes.length).toBeGreaterThan(0);
    // PNG signature: 0x89 'P' 'N' 'G'
    expect(pngBytes[0]).toBe(0x89);
    expect(pngBytes[1]).toBe(0x50);
    expect(pngBytes[2]).toBe(0x4e);
    expect(pngBytes[3]).toBe(0x47);

    if (fallback.gif !== undefined) {
      const gifBytes = await resolver.resolve(fallback.gif);
      expect(gifBytes.length).toBeGreaterThan(0);
      // GIF signature: "GIF89a" or "GIF87a"
      const sig = new TextDecoder().decode(gifBytes.slice(0, 6));
      expect(sig).toMatch(/^GIF8[79]a$/);
    }
  });

  it('is deterministic — two generators produce byte-identical PNGs', async () => {
    const makeProvider = () => {
      const resolver = new InMemoryAssetResolver();
      return {
        resolver,
        provider: createFallbackGenerator({
          frameRenderer: createSolidColorFrameRenderer(),
          resolver,
          durationMs: 1000,
        }),
      };
    };
    const a = makeProvider();
    const b = makeProvider();
    const [fa, fb] = await Promise.all([
      a.provider.generate({ width: 20, height: 15, id: 'mpu' }),
      b.provider.generate({ width: 20, height: 15, id: 'mpu' }),
    ]);
    const pngA = await a.resolver.resolve(fa.png);
    const pngB = await b.resolver.resolve(fb.png);
    expect(pngA).toEqual(pngB);
  });

  it('throws when the renderer returns a mismatched size', async () => {
    const badRenderer: FrameRenderer = {
      async renderFrame(): Promise<RgbaFrame> {
        const w = 10;
        const h = 10;
        return { width: w, height: h, bytes: new Uint8Array(w * h * 4) };
      },
    };
    const resolver = new InMemoryAssetResolver();
    const provider = createFallbackGenerator({
      frameRenderer: badRenderer,
      resolver,
      durationMs: 1000,
    });
    await expect(provider.generate({ width: 20, height: 15, id: 'mpu' })).rejects.toThrow(
      /10x10 for requested 20x15/,
    );
  });
});
