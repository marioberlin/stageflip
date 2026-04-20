// packages/frame-runtime/src/interpolate-path.test.ts
// Unit tests for interpolatePath().

import { describe, expect, it } from 'vitest';

import { EASINGS } from './easings.js';
import { interpolatePath } from './interpolate-path.js';

const SQUARE = 'M 0 0 L 10 0 L 10 10 L 0 10 Z';
const TRIANGLE = 'M 5 0 L 10 10 L 0 10 Z';
const HOUSE = 'M 0 5 L 5 0 L 10 5 L 10 10 L 0 10 Z';

describe('interpolatePath — shape of output', () => {
  it('returns a string starting with M at t=0', () => {
    const out = interpolatePath(0, [0, 100], [SQUARE, TRIANGLE]);
    expect(typeof out).toBe('string');
    expect(out.trim().startsWith('M')).toBe(true);
  });

  it('returns a string starting with M at t=1', () => {
    const out = interpolatePath(100, [0, 100], [SQUARE, TRIANGLE]);
    expect(typeof out).toBe('string');
    expect(out.trim().startsWith('M')).toBe(true);
  });

  it('returns a string starting with M at the midpoint', () => {
    const out = interpolatePath(50, [0, 100], [SQUARE, TRIANGLE]);
    expect(typeof out).toBe('string');
    expect(out.trim().startsWith('M')).toBe(true);
  });
});

describe('interpolatePath — morph progression', () => {
  it('endpoint at t=0 differs from endpoint at t=1', () => {
    const a = interpolatePath(0, [0, 100], [SQUARE, TRIANGLE]);
    const b = interpolatePath(100, [0, 100], [SQUARE, TRIANGLE]);
    expect(a).not.toBe(b);
  });

  it('midpoint differs from both endpoints', () => {
    const a = interpolatePath(0, [0, 100], [SQUARE, TRIANGLE]);
    const mid = interpolatePath(50, [0, 100], [SQUARE, TRIANGLE]);
    const b = interpolatePath(100, [0, 100], [SQUARE, TRIANGLE]);
    expect(mid).not.toBe(a);
    expect(mid).not.toBe(b);
  });

  it('repeated calls at the same input are deterministic (stable across calls)', () => {
    const a1 = interpolatePath(37, [0, 100], [SQUARE, TRIANGLE]);
    const a2 = interpolatePath(37, [0, 100], [SQUARE, TRIANGLE]);
    expect(a1).toBe(a2);
  });
});

describe('interpolatePath — multi-segment', () => {
  it('selects the correct segment piecewise', () => {
    const pts = [0, 50, 100];
    const paths = [SQUARE, TRIANGLE, HOUSE];

    const atFirstSegmentMid = interpolatePath(25, pts, paths);
    const atSecondSegmentMid = interpolatePath(75, pts, paths);
    // They map through different interpolators (square→triangle vs
    // triangle→house), so the outputs must differ.
    expect(atFirstSegmentMid).not.toBe(atSecondSegmentMid);
  });
});

describe('interpolatePath — easing applied', () => {
  it('non-linear easing shifts the midpoint away from linear midpoint', () => {
    const linearMid = interpolatePath(50, [0, 100], [SQUARE, TRIANGLE]);
    const easedMid = interpolatePath(50, [0, 100], [SQUARE, TRIANGLE], {
      easing: EASINGS['quad-in'],
    });
    expect(easedMid).not.toBe(linearMid);
  });
});

describe('interpolatePath — extrapolation', () => {
  it('clamp left returns the first-endpoint path', () => {
    const endpoint = interpolatePath(0, [0, 100], [SQUARE, TRIANGLE]);
    const clamped = interpolatePath(-10, [0, 100], [SQUARE, TRIANGLE], {
      extrapolateLeft: 'clamp',
    });
    expect(clamped).toBe(endpoint);
  });

  it('clamp right returns the last-endpoint path', () => {
    const endpoint = interpolatePath(100, [0, 100], [SQUARE, TRIANGLE]);
    const clamped = interpolatePath(200, [0, 100], [SQUARE, TRIANGLE], {
      extrapolateRight: 'clamp',
    });
    expect(clamped).toBe(endpoint);
  });

  it("'identity' is rejected for paths", () => {
    expect(() =>
      interpolatePath(-10, [0, 100], [SQUARE, TRIANGLE], { extrapolateLeft: 'identity' }),
    ).toThrow(/identity/);
  });

  it("'extend' is rejected for paths (no meaningful extrapolation)", () => {
    expect(() =>
      interpolatePath(-10, [0, 100], [SQUARE, TRIANGLE], { extrapolateLeft: 'extend' }),
    ).toThrow(/extend/);
  });
});

describe('interpolatePath — validation', () => {
  it('throws on fewer than 2 range points', () => {
    expect(() => interpolatePath(0, [0], [SQUARE])).toThrow(/at least 2/);
  });

  it('throws on length mismatch', () => {
    expect(() => interpolatePath(0, [0, 50, 100], [SQUARE, TRIANGLE])).toThrow(
      /length.*must equal/,
    );
  });

  it('throws on non-ascending inputRange', () => {
    expect(() => interpolatePath(0, [100, 0], [SQUARE, TRIANGLE])).toThrow(/strictly ascending/);
  });

  it('throws on NaN input', () => {
    expect(() => interpolatePath(Number.NaN, [0, 100], [SQUARE, TRIANGLE])).toThrow(/NaN/);
  });

  it('throws on unparseable path', () => {
    expect(() => interpolatePath(0, [0, 100], ['not a path', SQUARE])).toThrow(/path/i);
  });
});
