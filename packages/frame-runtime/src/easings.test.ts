// packages/frame-runtime/src/easings.test.ts
// Unit + property tests for the 25 named easings.

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { EASINGS, NAMED_EASINGS, cubicBezier } from './easings.js';

const EPS = 1e-6;

describe('NAMED_EASINGS registry', () => {
  it('contains exactly 25 entries, each unique', () => {
    expect(NAMED_EASINGS.length).toBe(25);
    expect(new Set(NAMED_EASINGS).size).toBe(25);
  });

  it('every name resolves to a function in EASINGS', () => {
    for (const name of NAMED_EASINGS) {
      expect(typeof EASINGS[name]).toBe('function');
    }
  });
});

describe('boundary conditions — f(0) = 0, f(1) = 1', () => {
  for (const name of NAMED_EASINGS) {
    it(`${name}`, () => {
      const fn = EASINGS[name];
      expect(fn(0)).toBeCloseTo(0, 5);
      expect(fn(1)).toBeCloseTo(1, 5);
    });
  }
});

describe('monotonicity — non-back easings are monotonic on [0, 1]', () => {
  const nonMonotonic = new Set(['back-in', 'back-out']);
  for (const name of NAMED_EASINGS) {
    if (nonMonotonic.has(name)) continue;
    it(`${name}`, () => {
      const fn = EASINGS[name];
      let prev = fn(0);
      for (let i = 1; i <= 100; i++) {
        const t = i / 100;
        const v = fn(t);
        // Allow floating-point slack.
        expect(v).toBeGreaterThanOrEqual(prev - EPS);
        prev = v;
      }
    });
  }
});

describe('linear is identity on [0, 1]', () => {
  it('returns t for any t in [0, 1]', () => {
    fc.assert(
      fc.property(fc.double({ min: 0, max: 1, noNaN: true }), (t) => {
        expect(EASINGS.linear(t)).toBeCloseTo(t, 10);
      }),
      { numRuns: 50 },
    );
  });
});

describe('ease-in/ease-out symmetry', () => {
  it('ease-out(t) ≈ 1 - ease-in(1 - t) for quad', () => {
    const easeIn = EASINGS['quad-in'];
    const easeOut = EASINGS['quad-out'];
    fc.assert(
      fc.property(fc.double({ min: 0, max: 1, noNaN: true }), (t) => {
        expect(easeOut(t)).toBeCloseTo(1 - easeIn(1 - t), 6);
      }),
      { numRuns: 50 },
    );
  });

  it('ease-out(t) ≈ 1 - ease-in(1 - t) for cubic', () => {
    const easeIn = EASINGS['cubic-in'];
    const easeOut = EASINGS['cubic-out'];
    fc.assert(
      fc.property(fc.double({ min: 0, max: 1, noNaN: true }), (t) => {
        expect(easeOut(t)).toBeCloseTo(1 - easeIn(1 - t), 6);
      }),
      { numRuns: 50 },
    );
  });
});

describe('in-out midpoint', () => {
  it('every *-in-out variant crosses 0.5 at t=0.5', () => {
    const midpointEasings = NAMED_EASINGS.filter((n) => n.endsWith('-in-out'));
    expect(midpointEasings.length).toBeGreaterThan(4);
    for (const name of midpointEasings) {
      const v = EASINGS[name](0.5);
      expect(v).toBeCloseTo(0.5, 3);
    }
  });
});

describe('back easings overshoot', () => {
  it('back-in produces values below 0 somewhere in [0, 1]', () => {
    let sawNegative = false;
    for (let i = 0; i <= 100; i++) {
      if (EASINGS['back-in'](i / 100) < 0) sawNegative = true;
    }
    expect(sawNegative).toBe(true);
  });

  it('back-out produces values above 1 somewhere in [0, 1]', () => {
    let sawAbove = false;
    for (let i = 0; i <= 100; i++) {
      if (EASINGS['back-out'](i / 100) > 1) sawAbove = true;
    }
    expect(sawAbove).toBe(true);
  });
});

describe('cubicBezier', () => {
  it('builds a linear-like easing for (0, 0, 1, 1)', () => {
    const fn = cubicBezier(0, 0, 1, 1);
    fc.assert(
      fc.property(fc.double({ min: 0, max: 1, noNaN: true }), (t) => {
        expect(fn(t)).toBeCloseTo(t, 5);
      }),
      { numRuns: 40 },
    );
  });

  it('rejects out-of-range x1 / x2', () => {
    expect(() => cubicBezier(-0.1, 0, 0.5, 1)).toThrow(/x1 and x2/);
    expect(() => cubicBezier(0.5, 0, 1.1, 1)).toThrow(/x1 and x2/);
  });

  it('always passes through (0, 0) and (1, 1)', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 1, noNaN: true }),
        fc.double({ min: -1, max: 2, noNaN: true }),
        fc.double({ min: 0, max: 1, noNaN: true }),
        fc.double({ min: -1, max: 2, noNaN: true }),
        (x1, y1, x2, y2) => {
          const fn = cubicBezier(x1, y1, x2, y2);
          expect(fn(0)).toBe(0);
          expect(fn(1)).toBe(1);
        },
      ),
      { numRuns: 25 },
    );
  });
});
