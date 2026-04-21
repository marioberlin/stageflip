// packages/parity/src/ssim.test.ts

import { describe, expect, it } from 'vitest';
import type { ParityImageData } from './image-data';
import { ssim } from './ssim';

function solid(
  width: number,
  height: number,
  rgba: readonly [number, number, number, number],
): ParityImageData {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = rgba[0];
    data[i + 1] = rgba[1];
    data[i + 2] = rgba[2];
    data[i + 3] = rgba[3];
  }
  return { width, height, data };
}

/** Deterministic noise — identical seed → identical bytes. */
function noise(width: number, height: number, seed: number): ParityImageData {
  const data = new Uint8ClampedArray(width * height * 4);
  let s = seed >>> 0;
  for (let i = 0; i < data.length; i += 4) {
    s = (s * 1664525 + 1013904223) >>> 0;
    data[i] = s & 0xff;
    data[i + 1] = (s >> 8) & 0xff;
    data[i + 2] = (s >> 16) & 0xff;
    data[i + 3] = 255;
  }
  return { width, height, data };
}

describe('ssim', () => {
  it('scores identical images at 1', () => {
    const a = solid(32, 32, [128, 128, 128, 255]);
    const b = solid(32, 32, [128, 128, 128, 255]);
    expect(ssim(a, b)).toBe(1);
  });

  it('scores slightly-off images close to 1', () => {
    const a = solid(32, 32, [128, 128, 128, 255]);
    const b = solid(32, 32, [130, 128, 128, 255]); // +2 on red
    const score = ssim(a, b);
    expect(score).toBeGreaterThan(0.97);
    expect(score).toBeLessThan(1);
  });

  it('scores noise vs a solid image well below 1', () => {
    const a = solid(32, 32, [128, 128, 128, 255]);
    const b = noise(32, 32, 0xdeadbeef);
    const score = ssim(a, b);
    expect(score).toBeLessThan(0.5);
  });

  it('produces the same score regardless of operand order', () => {
    const a = solid(32, 32, [40, 60, 80, 255]);
    const b = solid(32, 32, [80, 60, 40, 255]);
    expect(ssim(a, b)).toBeCloseTo(ssim(b, a), 10);
  });

  it('applies the region crop to both images before scoring', () => {
    // Two 32x32 images that differ only in the top-left 16x16 quadrant.
    const a = solid(32, 32, [128, 128, 128, 255]);
    const b = solid(32, 32, [128, 128, 128, 255]);
    // Stomp top-left 16x16 of `b` with black.
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const off = (y * 32 + x) * 4;
        b.data[off] = 0;
        b.data[off + 1] = 0;
        b.data[off + 2] = 0;
      }
    }
    const fullScore = ssim(a, b);
    const bottomRight = ssim(a, b, { region: { x: 16, y: 16, width: 16, height: 16 } });
    const topLeft = ssim(a, b, { region: { x: 0, y: 0, width: 16, height: 16 } });
    expect(bottomRight).toBe(1);
    expect(topLeft).toBeLessThan(fullScore);
  });
});
