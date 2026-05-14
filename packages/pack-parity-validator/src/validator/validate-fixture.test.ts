// packages/pack-parity-validator/src/validator/validate-fixture.test.ts

import { PNG } from 'pngjs';
import { describe, expect, it } from 'vitest';
import { validateFixture } from './validate-fixture';

/** Build a synthetic PNG byte buffer of solid color (RGBA, 8 bpc). */
function solidPng(
  width: number,
  height: number,
  rgba: readonly [number, number, number, number],
): Uint8Array {
  const png = new PNG({ width, height });
  for (let i = 0; i < png.data.length; i += 4) {
    png.data[i] = rgba[0] ?? 0;
    png.data[i + 1] = rgba[1] ?? 0;
    png.data[i + 2] = rgba[2] ?? 0;
    png.data[i + 3] = rgba[3] ?? 255;
  }
  return new Uint8Array(PNG.sync.write(png));
}

describe('validateFixture', () => {
  it('returns ok=true for bit-identical PNGs (PSNR=Infinity, SSIM=1.0)', () => {
    const png = solidPng(16, 16, [128, 128, 128, 255]);
    const result = validateFixture({
      clusterId: 'cluster-a',
      actualPngBytes: png,
      referencePngBytes: png,
    });
    expect(result.ok).toBe(true);
    expect(result.psnr).toBe(Number.POSITIVE_INFINITY);
    expect(result.ssim).toBeCloseTo(1, 6);
    expect(result.reason).toBeUndefined();
  });

  it('returns ok=false with reason=psnr-below-threshold for tampered PNG', () => {
    const a = solidPng(16, 16, [128, 128, 128, 255]);
    const b = solidPng(16, 16, [200, 50, 50, 255]); // big colour delta
    const result = validateFixture({
      clusterId: 'cluster-a',
      actualPngBytes: a,
      referencePngBytes: b,
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('psnr-below-threshold');
    expect(result.psnr).toBeLessThan(35);
    expect(result.psnr).toBeGreaterThan(0);
  });

  it('returns reason=unknown-cluster for unenumerated cluster ids', () => {
    const png = solidPng(8, 8, [10, 20, 30, 255]);
    const result = validateFixture({
      clusterId: 'cluster-finance',
      actualPngBytes: png,
      referencePngBytes: png,
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('unknown-cluster');
    // Threshold falls back to default for scoring context
    expect(result.threshold.clusterId).toBe('default');
    expect(result.psnr).toBe(Number.POSITIVE_INFINITY);
  });

  it('returns reason=malformed-png on invalid PNG bytes (actual)', () => {
    const ref = solidPng(8, 8, [0, 0, 0, 255]);
    const result = validateFixture({
      clusterId: 'cluster-a',
      actualPngBytes: new Uint8Array([0x00, 0x01, 0x02, 0x03]),
      referencePngBytes: ref,
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('malformed-png');
    expect(result.psnr).toBe(0);
    expect(result.ssim).toBe(0);
  });

  it('returns reason=malformed-png on invalid PNG bytes (reference)', () => {
    const actual = solidPng(8, 8, [0, 0, 0, 255]);
    const result = validateFixture({
      clusterId: 'cluster-a',
      actualPngBytes: actual,
      referencePngBytes: new Uint8Array([]),
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('malformed-png');
  });

  it('returns reason=dimension-mismatch when sizes differ', () => {
    const a = solidPng(16, 16, [0, 0, 0, 255]);
    const b = solidPng(8, 8, [0, 0, 0, 255]);
    const result = validateFixture({
      clusterId: 'cluster-a',
      actualPngBytes: a,
      referencePngBytes: b,
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('dimension-mismatch');
  });

  it('honours the cluster-d (typography) tighter threshold', () => {
    // Construct a small delta that passes cluster-c (32 dB) but fails
    // cluster-d (36 dB). Per-channel delta of 4 → MSE = 16 → PSNR ≈ 36.2
    // dB. Bump to 5 → MSE = 25 → PSNR ≈ 34.15 dB → fails cluster-d only.
    const a = solidPng(32, 32, [128, 128, 128, 255]);
    const b = solidPng(32, 32, [133, 133, 133, 255]);
    const c = validateFixture({
      clusterId: 'cluster-c',
      actualPngBytes: a,
      referencePngBytes: b,
    });
    const d = validateFixture({
      clusterId: 'cluster-d',
      actualPngBytes: a,
      referencePngBytes: b,
    });
    expect(c.psnr).toBeGreaterThan(32);
    expect(c.psnr).toBeLessThan(36);
    expect(c.ok).toBe(true);
    expect(d.ok).toBe(false);
    expect(d.reason).toBe('psnr-below-threshold');
  });

  it('threshold object on the result reflects the resolved cluster row', () => {
    const png = solidPng(8, 8, [50, 60, 70, 255]);
    const result = validateFixture({
      clusterId: 'cluster-h',
      actualPngBytes: png,
      referencePngBytes: png,
    });
    expect(result.threshold).toEqual({ clusterId: 'cluster-h', minPsnr: 33, minSsim: 0.93 });
  });

  it('does not throw on empty pngBytes — surfaces malformed-png', () => {
    const ref = solidPng(8, 8, [0, 0, 0, 255]);
    expect(() =>
      validateFixture({
        clusterId: 'cluster-a',
        actualPngBytes: new Uint8Array(0),
        referencePngBytes: ref,
      }),
    ).not.toThrow();
  });

  it('PSNR formula matches 10*log10(MAX^2/MSE) for known delta', () => {
    // Per-channel delta of 10 across a uniform image:
    //   sumSquaredError = pixels * 3 * 100
    //   mse = sumSquaredError / (pixels * 3) = 100
    //   psnr = 10 * log10(255^2 / 100) ≈ 28.13 dB
    const a = solidPng(8, 8, [0, 0, 0, 255]);
    const b = solidPng(8, 8, [10, 10, 10, 255]);
    const result = validateFixture({
      clusterId: 'cluster-a',
      actualPngBytes: a,
      referencePngBytes: b,
    });
    expect(result.psnr).toBeGreaterThan(28);
    expect(result.psnr).toBeLessThan(29);
  });

  it('alpha-only differences are ignored (same RGB → ok)', () => {
    const opaque = solidPng(8, 8, [128, 128, 128, 255]);
    const transparent = solidPng(8, 8, [128, 128, 128, 0]);
    const result = validateFixture({
      clusterId: 'cluster-a',
      actualPngBytes: opaque,
      referencePngBytes: transparent,
    });
    expect(result.psnr).toBe(Number.POSITIVE_INFINITY);
    expect(result.ok).toBe(true);
  });
});
