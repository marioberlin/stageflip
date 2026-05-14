// packages/pack-parity-validator/src/validator/validate-pack.test.ts

import { PNG } from 'pngjs';
import { describe, expect, it } from 'vitest';
import { type PackFixtureManifest, validatePackFixtures } from './validate-pack';

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

describe('validatePackFixtures', () => {
  it('returns an empty report for empty input', () => {
    const report = validatePackFixtures({ fixtures: [] });
    expect(report.results).toEqual([]);
    expect(report.summary).toEqual({
      total: 0,
      passed: 0,
      failed: 0,
      byReason: {},
    });
  });

  it('aggregates a single passing fixture', () => {
    const png = solidPng(8, 8, [0, 128, 0, 255]);
    const fixtures: PackFixtureManifest[] = [
      {
        path: 'pack/fixtures/cluster-a/intro.png',
        clusterId: 'cluster-a',
        actualPngBytes: png,
        referencePngBytes: png,
      },
    ];
    const report = validatePackFixtures({ fixtures });
    expect(report.summary.total).toBe(1);
    expect(report.summary.passed).toBe(1);
    expect(report.summary.failed).toBe(0);
    expect(report.results[0]?.result.ok).toBe(true);
    expect(report.results[0]?.fixturePath).toBe('pack/fixtures/cluster-a/intro.png');
  });

  it('aggregates mixed pass / fail and groups failure reasons', () => {
    const ok = solidPng(8, 8, [0, 0, 0, 255]);
    const tampered = solidPng(8, 8, [200, 200, 200, 255]);
    const malformed = new Uint8Array([0xff, 0xff, 0xff]);
    const fixtures: PackFixtureManifest[] = [
      {
        path: 'pack/fixtures/cluster-a/a.png',
        clusterId: 'cluster-a',
        actualPngBytes: ok,
        referencePngBytes: ok,
      },
      {
        path: 'pack/fixtures/cluster-a/b.png',
        clusterId: 'cluster-a',
        actualPngBytes: ok,
        referencePngBytes: tampered,
      },
      {
        path: 'pack/fixtures/cluster-finance/c.png',
        clusterId: 'cluster-finance',
        actualPngBytes: ok,
        referencePngBytes: ok,
      },
      {
        path: 'pack/fixtures/cluster-a/d.png',
        clusterId: 'cluster-a',
        actualPngBytes: malformed,
        referencePngBytes: ok,
      },
    ];
    const report = validatePackFixtures({ fixtures });
    expect(report.summary.total).toBe(4);
    expect(report.summary.passed).toBe(1);
    expect(report.summary.failed).toBe(3);
    expect(report.summary.byReason['psnr-below-threshold']).toBe(1);
    expect(report.summary.byReason['unknown-cluster']).toBe(1);
    expect(report.summary.byReason['malformed-png']).toBe(1);
  });

  it('preserves input order in the results array', () => {
    const png = solidPng(8, 8, [10, 10, 10, 255]);
    const fixtures: PackFixtureManifest[] = [
      { path: 'a.png', clusterId: 'cluster-a', actualPngBytes: png, referencePngBytes: png },
      { path: 'b.png', clusterId: 'cluster-b', actualPngBytes: png, referencePngBytes: png },
      { path: 'c.png', clusterId: 'cluster-c', actualPngBytes: png, referencePngBytes: png },
    ];
    const report = validatePackFixtures({ fixtures });
    expect(report.results.map((r) => r.fixturePath)).toEqual(['a.png', 'b.png', 'c.png']);
  });

  it('summary.byReason contains only failure reasons (no `ok` key)', () => {
    const png = solidPng(8, 8, [0, 0, 0, 255]);
    const report = validatePackFixtures({
      fixtures: [
        { path: 'a.png', clusterId: 'cluster-a', actualPngBytes: png, referencePngBytes: png },
      ],
    });
    expect(report.summary.byReason).toEqual({});
  });

  it('every result entry includes the threshold used for scoring', () => {
    const png = solidPng(8, 8, [0, 0, 0, 255]);
    const report = validatePackFixtures({
      fixtures: [
        { path: 'a.png', clusterId: 'cluster-d', actualPngBytes: png, referencePngBytes: png },
      ],
    });
    expect(report.results[0]?.result.threshold).toEqual({
      clusterId: 'cluster-d',
      minPsnr: 36,
      minSsim: 0.96,
    });
  });

  it('counts dimension-mismatch failures separately', () => {
    const small = solidPng(4, 4, [0, 0, 0, 255]);
    const big = solidPng(8, 8, [0, 0, 0, 255]);
    const report = validatePackFixtures({
      fixtures: [
        { path: 'a.png', clusterId: 'cluster-a', actualPngBytes: small, referencePngBytes: big },
      ],
    });
    expect(report.summary.failed).toBe(1);
    expect(report.summary.byReason['dimension-mismatch']).toBe(1);
  });
});
