// packages/frame-runtime/src/interpolate.test.ts
// Unit + property tests for interpolate().

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { EASINGS } from './easings.js';
import { interpolate } from './interpolate.js';

describe('interpolate — basic linear mapping', () => {
  it('maps input 0 to first output', () => {
    expect(interpolate(0, [0, 100], [0, 1])).toBe(0);
  });

  it('maps input 100 to last output', () => {
    expect(interpolate(100, [0, 100], [0, 1])).toBe(1);
  });

  it('maps midpoint linearly by default', () => {
    expect(interpolate(50, [0, 100], [0, 1])).toBeCloseTo(0.5, 10);
  });

  it('maps negative ranges correctly', () => {
    expect(interpolate(0, [-10, 10], [100, 200])).toBeCloseTo(150, 10);
  });
});

describe('interpolate — multi-segment', () => {
  it('maps across a 3-point range piecewise', () => {
    const pts = [0, 50, 100];
    const out = [0, 0.2, 1];
    expect(interpolate(25, pts, out)).toBeCloseTo(0.1, 10);
    expect(interpolate(75, pts, out)).toBeCloseTo(0.6, 10);
  });
});

describe('interpolate — easing applied', () => {
  it('applies easing to the segment fraction', () => {
    // quad-in at t=0.5 -> 0.25; so interpolate(50, [0,100], [0,1], {easing: quadIn})
    // should give 0.25.
    const result = interpolate(50, [0, 100], [0, 1], { easing: EASINGS['quad-in'] });
    expect(result).toBeCloseTo(0.25, 10);
  });
});

describe('interpolate — extrapolation modes', () => {
  const pts = [0, 100];
  const out = [0, 1];

  it('clamp: below first in -> first out', () => {
    expect(interpolate(-50, pts, out, { extrapolateLeft: 'clamp' })).toBe(0);
  });
  it('clamp: above last in -> last out', () => {
    expect(interpolate(150, pts, out, { extrapolateRight: 'clamp' })).toBe(1);
  });

  it('identity: returns the input unchanged', () => {
    expect(interpolate(-50, pts, out, { extrapolateLeft: 'identity' })).toBe(-50);
    expect(interpolate(150, pts, out, { extrapolateRight: 'identity' })).toBe(150);
  });

  it('extend (default): extrapolates linearly', () => {
    expect(interpolate(200, pts, out)).toBeCloseTo(2, 10);
    expect(interpolate(-100, pts, out)).toBeCloseTo(-1, 10);
  });
});

describe('interpolate — input validation', () => {
  it('rejects inputRange with < 2 points', () => {
    expect(() => interpolate(0, [0], [0])).toThrow(/at least 2 points/);
  });

  it('rejects mismatched lengths', () => {
    expect(() => interpolate(0, [0, 100], [0, 1, 2])).toThrow(/must equal outputRange/);
  });

  it('rejects non-monotonic inputRange', () => {
    expect(() => interpolate(0, [0, 100, 50], [0, 1, 2])).toThrow(/strictly ascending/);
    expect(() => interpolate(0, [0, 0], [0, 1])).toThrow(/strictly ascending/);
  });

  it('rejects NaN input', () => {
    expect(() => interpolate(Number.NaN, [0, 1], [0, 1])).toThrow(/NaN/);
  });
});

describe('interpolate — property-based', () => {
  it('endpoints map exactly to outputs', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 1e6, noNaN: true, noDefaultInfinity: true }),
        fc.double({ min: -1e6, max: 1e6, noNaN: true, noDefaultInfinity: true }),
        fc.double({ min: -1e6, max: 1e6, noNaN: true, noDefaultInfinity: true }),
        (span, outA, outB) => {
          if (span <= 0) return;
          const pts = [0, span];
          const out = [outA, outB];
          expect(interpolate(0, pts, out)).toBeCloseTo(outA, 5);
          expect(interpolate(span, pts, out)).toBeCloseTo(outB, 5);
        },
      ),
      { numRuns: 50 },
    );
  });

  it('clamp extrapolation keeps output in [outA, outB] bounds', () => {
    fc.assert(
      fc.property(fc.double({ min: -1e4, max: 1e4, noNaN: true }), (input) => {
        const out = interpolate(input, [0, 100], [10, 20], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        });
        expect(out).toBeGreaterThanOrEqual(10);
        expect(out).toBeLessThanOrEqual(20);
      }),
      { numRuns: 50 },
    );
  });

  it('produces finite output for any finite input in range', () => {
    fc.assert(
      fc.property(fc.double({ min: 0, max: 100, noNaN: true }), (input) => {
        const out = interpolate(input, [0, 100], [-5, 5]);
        expect(Number.isFinite(out)).toBe(true);
      }),
      { numRuns: 50 },
    );
  });
});
