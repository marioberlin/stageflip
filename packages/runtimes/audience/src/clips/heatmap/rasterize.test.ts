// packages/runtimes/audience/src/clips/heatmap/rasterize.test.ts
// T-469 — Tests for the pure `rasterizeHeatmap` helper. Verifies:
//   - byte-identical output for identical inputs (determinism perimeter);
//   - empty taps → all-zero alpha output;
//   - single centered tap → max-intensity pixel sits at the centre and
//     decays radially;
//   - high-intensity centered tap produces red-band pixels in the centre
//     (RGBA at 0xff..0x... ≈ red colormap bucket).
//
// Runs under the workspace default (node) — `rasterizeHeatmap` does not
// require a DOM. The module installs a structural stand-in when the
// host lacks a global `ImageData` constructor so tests can still
// inspect the returned `data` byte buffer.

import { describe, expect, it } from 'vitest';

import { rasterizeHeatmap } from './rasterize.js';

describe('rasterizeHeatmap', () => {
  it('returns an ImageData of the requested canvas dimensions', () => {
    const out = rasterizeHeatmap([{ x: 0.5, y: 0.5, intensity: 1 }], { w: 32, h: 32 }, 64, 48);
    expect(out.width).toBe(64);
    expect(out.height).toBe(48);
    expect(out.data.length).toBe(64 * 48 * 4);
  });

  it('is deterministic — same input bytes → bit-identical output bytes', () => {
    const taps = [
      { x: 0.5, y: 0.5, intensity: 5 },
      { x: 0.3, y: 0.4, intensity: 3 },
      { x: 0.7, y: 0.6, intensity: 2 },
    ];
    const a = rasterizeHeatmap(taps, { w: 32, h: 32 }, 128, 128);
    const b = rasterizeHeatmap(taps, { w: 32, h: 32 }, 128, 128);
    expect(a.data.length).toBe(b.data.length);
    let identical = true;
    for (let i = 0; i < a.data.length; i += 1) {
      if (a.data[i] !== b.data[i]) {
        identical = false;
        break;
      }
    }
    expect(identical).toBe(true);
  });

  it('renders an all-transparent image when there are no taps', () => {
    const out = rasterizeHeatmap([], { w: 32, h: 32 }, 64, 64);
    let allZero = true;
    for (let i = 0; i < out.data.length; i += 1) {
      if (out.data[i] !== 0) {
        allZero = false;
        break;
      }
    }
    expect(allZero).toBe(true);
  });

  it('places the max intensity near the centre for a centered tap', () => {
    const out = rasterizeHeatmap([{ x: 0.5, y: 0.5, intensity: 5 }], { w: 32, h: 32 }, 32, 32);
    // Probe centre pixel alpha vs. a corner pixel alpha.
    const centreIdx = (32 * 16 + 16) * 4 + 3;
    const cornerIdx = (32 * 0 + 0) * 4 + 3;
    expect(out.data[centreIdx]).toBeGreaterThan(0);
    expect(out.data[centreIdx]).toBeGreaterThan(out.data[cornerIdx] ?? 0);
  });

  it('produces red-band pixels at the centre for a high-intensity centered tap', () => {
    const out = rasterizeHeatmap([{ x: 0.5, y: 0.5, intensity: 10 }], { w: 32, h: 32 }, 32, 32);
    // The centre pixel after normalisation is at the top of the
    // colormap range; the colormap goes red at v > 0.75. R should be
    // dominant relative to B.
    const centrePx = (32 * 16 + 16) * 4;
    const r = out.data[centrePx] ?? 0;
    const b = out.data[centrePx + 2] ?? 0;
    expect(r).toBeGreaterThan(b);
    expect(r).toBeGreaterThan(127);
  });

  it('produces at least 5% non-transparent pixels for a meaningful taps set', () => {
    const out = rasterizeHeatmap(
      [
        { x: 0.5, y: 0.5, intensity: 5 },
        { x: 0.3, y: 0.4, intensity: 3 },
        { x: 0.7, y: 0.6, intensity: 2 },
        { x: 0.5, y: 0.8, intensity: 1 },
      ],
      { w: 32, h: 32 },
      64,
      64,
    );
    let nonZero = 0;
    const totalPixels = 64 * 64;
    for (let i = 0; i < totalPixels; i += 1) {
      const alpha = out.data[i * 4 + 3] ?? 0;
      if (alpha > 0) nonZero += 1;
    }
    expect(nonZero / totalPixels).toBeGreaterThan(0.05);
  });

  it('keeps alpha bounded at 70% of 255 (~178)', () => {
    const out = rasterizeHeatmap([{ x: 0.5, y: 0.5, intensity: 100 }], { w: 32, h: 32 }, 32, 32);
    let maxAlpha = 0;
    for (let i = 0; i < out.data.length; i += 4) {
      const a = out.data[i + 3] ?? 0;
      if (a > maxAlpha) maxAlpha = a;
    }
    // Max possible alpha at v=1 is `255 * 0.7 = 178.5` clamped → 178.
    expect(maxAlpha).toBeLessThanOrEqual(179);
  });
});
