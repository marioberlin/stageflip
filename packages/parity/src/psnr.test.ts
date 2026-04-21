// packages/parity/src/psnr.test.ts

import { describe, expect, it } from 'vitest';
import type { ParityImageData } from './image-data';
import { psnr } from './psnr';

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

describe('psnr', () => {
  it('returns Infinity for bit-identical images', () => {
    const a = solid(8, 8, [128, 128, 128, 255]);
    const b = solid(8, 8, [128, 128, 128, 255]);
    expect(psnr(a, b)).toBe(Number.POSITIVE_INFINITY);
  });

  it('returns a finite dB value for mismatched images', () => {
    const a = solid(4, 4, [0, 0, 0, 255]);
    const b = solid(4, 4, [10, 10, 10, 255]);
    // MSE over 3 channels of 10² = 100 → 10 * log10(65025/100) ≈ 28.13 dB
    const value = psnr(a, b);
    expect(value).toBeGreaterThan(28);
    expect(value).toBeLessThan(29);
  });

  it('ignores alpha by default — pure-alpha difference yields Infinity', () => {
    const a = solid(4, 4, [128, 128, 128, 255]);
    const b = solid(4, 4, [128, 128, 128, 0]); // same RGB, different alpha
    expect(psnr(a, b)).toBe(Number.POSITIVE_INFINITY);
  });

  it('includeAlpha=true factors alpha into MSE', () => {
    const a = solid(4, 4, [128, 128, 128, 255]);
    const b = solid(4, 4, [128, 128, 128, 0]);
    const value = psnr(a, b, { includeAlpha: true });
    expect(Number.isFinite(value)).toBe(true);
    // MSE = 255² / 4 channels = 16256.25 → ≈ 6.02 dB
    expect(value).toBeGreaterThan(5);
    expect(value).toBeLessThan(7);
  });

  it('throws on dimension mismatch', () => {
    const a = solid(4, 4, [0, 0, 0, 255]);
    const b = solid(8, 4, [0, 0, 0, 255]);
    expect(() => psnr(a, b)).toThrow(/dimension mismatch/);
  });

  it('produces the same score regardless of operand order', () => {
    const a = solid(4, 4, [20, 30, 40, 255]);
    const b = solid(4, 4, [40, 30, 20, 255]);
    expect(psnr(a, b)).toBeCloseTo(psnr(b, a), 10);
  });

  it('throws on an empty (0x0) image', () => {
    const empty: ParityImageData = { width: 0, height: 0, data: new Uint8ClampedArray(0) };
    expect(() => psnr(empty, empty)).toThrow(/empty image/);
  });
});
