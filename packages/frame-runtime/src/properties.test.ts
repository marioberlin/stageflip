// packages/frame-runtime/src/properties.test.ts
// T-048 consolidated property-based tests for the frame-runtime primitives.
// Covers monotonicity, convergence, and boundary behaviour across
// easings / interpolate / interpolateColors / spring. Individual test files
// keep their unit coverage; this file exists specifically for the wider
// fast-check sweeps that exercise the realistic parameter envelope.

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { EASINGS, type NamedEasing } from './easings.js';
import { interpolateColors } from './interpolate-colors.js';
import { interpolate } from './interpolate.js';
import { spring } from './spring.js';

const BOUNDED_T = fc.double({ min: 0, max: 1, noNaN: true, noDefaultInfinity: true });

/**
 * Easings that are monotonically non-decreasing on [0, 1]. back-in and
 * back-out overshoot by design (handover §6.13) so they are excluded from
 * monotonicity properties. Keep this list in sync with easings.ts.
 */
const MONOTONIC_EASINGS: NamedEasing[] = [
  'linear',
  'ease',
  'ease-in',
  'ease-out',
  'ease-in-out',
  'quad-in',
  'quad-out',
  'quad-in-out',
  'cubic-in',
  'cubic-out',
  'cubic-in-out',
  'quart-in',
  'quart-out',
  'quart-in-out',
  'quint-in',
  'quint-out',
  'quint-in-out',
  'expo-in',
  'expo-out',
  'expo-in-out',
  'circ-in',
  'circ-out',
  'circ-in-out',
];

const CODOMAIN_BOUNDED_EASINGS: NamedEasing[] = MONOTONIC_EASINGS;

// ---------------------------------------------------------------------------
// Easings
// ---------------------------------------------------------------------------

describe('property: easings — endpoint convergence', () => {
  it.each(Object.entries(EASINGS))('%s maps 0 -> 0 and 1 -> 1', (_name, fn) => {
    expect(fn(0)).toBeCloseTo(0, 10);
    expect(fn(1)).toBeCloseTo(1, 10);
  });
});

describe('property: easings — monotonic easings are non-decreasing', () => {
  it.each(MONOTONIC_EASINGS)('%s is non-decreasing on [0, 1]', (name) => {
    const fn = EASINGS[name];
    fc.assert(
      fc.property(BOUNDED_T, BOUNDED_T, (t0, t1) => {
        const [a, b] = t0 <= t1 ? [t0, t1] : [t1, t0];
        expect(fn(b)).toBeGreaterThanOrEqual(fn(a) - 1e-9);
      }),
      { numRuns: 200 },
    );
  });
});

describe('property: easings — codomain stays in [0, 1] for non-back easings', () => {
  it.each(CODOMAIN_BOUNDED_EASINGS)('%s(t) in [0, 1] for t in [0, 1]', (name) => {
    const fn = EASINGS[name];
    fc.assert(
      fc.property(BOUNDED_T, (t) => {
        const y = fn(t);
        expect(y).toBeGreaterThanOrEqual(-1e-9);
        expect(y).toBeLessThanOrEqual(1 + 1e-9);
      }),
      { numRuns: 200 },
    );
  });
});

// ---------------------------------------------------------------------------
// interpolate()
// ---------------------------------------------------------------------------

describe('property: interpolate — boundary identity', () => {
  it('input at each inputRange point equals the paired outputRange value', () => {
    fc.assert(
      fc.property(
        fc
          .array(fc.double({ min: -1e4, max: 1e4, noNaN: true, noDefaultInfinity: true }), {
            minLength: 2,
            maxLength: 6,
          })
          .map((xs) => Array.from(new Set(xs)).sort((a, b) => a - b))
          .filter((xs) => xs.length >= 2),
        fc.array(fc.double({ min: -1e4, max: 1e4, noNaN: true, noDefaultInfinity: true }), {
          minLength: 2,
          maxLength: 6,
        }),
        (inputRange, outputRangeRaw) => {
          const outputRange = outputRangeRaw.slice(0, inputRange.length);
          while (outputRange.length < inputRange.length) outputRange.push(0);
          for (let i = 0; i < inputRange.length; i++) {
            const out = interpolate(inputRange[i] as number, inputRange, outputRange);
            expect(out).toBeCloseTo(outputRange[i] as number, 9);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});

describe('property: interpolate — monotone input => monotone output (linear easing)', () => {
  it('with an ascending outputRange, interpolate is non-decreasing in input', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 100, noNaN: true }),
        fc.double({ min: 0, max: 100, noNaN: true }),
        (x0, x1) => {
          const [a, b] = x0 <= x1 ? [x0, x1] : [x1, x0];
          const inputRange = [0, 50, 100];
          const outputRange = [0, 3, 10];
          const ya = interpolate(a, inputRange, outputRange);
          const yb = interpolate(b, inputRange, outputRange);
          expect(yb).toBeGreaterThanOrEqual(ya - 1e-9);
        },
      ),
      { numRuns: 200 },
    );
  });

  it('with a descending outputRange, interpolate is non-increasing in input', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 100, noNaN: true }),
        fc.double({ min: 0, max: 100, noNaN: true }),
        (x0, x1) => {
          const [a, b] = x0 <= x1 ? [x0, x1] : [x1, x0];
          const inputRange = [0, 50, 100];
          const outputRange = [10, 3, 0];
          const ya = interpolate(a, inputRange, outputRange);
          const yb = interpolate(b, inputRange, outputRange);
          expect(yb).toBeLessThanOrEqual(ya + 1e-9);
        },
      ),
      { numRuns: 200 },
    );
  });
});

describe('property: interpolate — clamp extrapolation is bounded by outputRange', () => {
  it('output is clamped to [min(output), max(output)] with clamp on both ends', () => {
    fc.assert(
      fc.property(fc.double({ min: -1e4, max: 1e4, noNaN: true }), (x) => {
        const out = interpolate(x, [0, 100], [10, 20], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        });
        expect(out).toBeGreaterThanOrEqual(10 - 1e-9);
        expect(out).toBeLessThanOrEqual(20 + 1e-9);
      }),
      { numRuns: 200 },
    );
  });
});

// ---------------------------------------------------------------------------
// interpolateColors()
// ---------------------------------------------------------------------------

const HEX_RE = /^#[0-9a-f]{6}$/;
const RGBA_RE = /^rgba\(\d+, \d+, \d+, [\d.]+\)$/;
const HEX_CAPTURE = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i;
const RGBA_CAPTURE = /^rgba\((\d+), (\d+), (\d+), [\d.]+\)$/;

describe('property: interpolateColors — output format is always parseable', () => {
  it('output matches hex or rgba() shape', () => {
    fc.assert(
      fc.property(fc.double({ min: -50, max: 150, noNaN: true }), (x) => {
        const out = interpolateColors(x, [0, 100], ['#ff0000', 'rgba(0, 0, 255, 0.5)']);
        expect(HEX_RE.test(out) || RGBA_RE.test(out)).toBe(true);
      }),
      { numRuns: 150 },
    );
  });
});

describe('property: interpolateColors — rgb channels stay in 0..255', () => {
  it('every rgb integer channel of the output is in [0, 255]', () => {
    fc.assert(
      fc.property(fc.double({ min: 0, max: 100, noNaN: true }), (x) => {
        const out = interpolateColors(x, [0, 100], ['#112233', '#eeff00'], {
          colorSpace: 'oklch',
        });
        const hexMatch = out.match(HEX_CAPTURE);
        const rgbaMatch = out.match(RGBA_CAPTURE);
        const parts = hexMatch
          ? [
              Number.parseInt(hexMatch[1] as string, 16),
              Number.parseInt(hexMatch[2] as string, 16),
              Number.parseInt(hexMatch[3] as string, 16),
            ]
          : rgbaMatch
            ? [Number(rgbaMatch[1]), Number(rgbaMatch[2]), Number(rgbaMatch[3])]
            : null;
        expect(parts).not.toBeNull();
        if (!parts) return;
        for (const c of parts) {
          expect(c).toBeGreaterThanOrEqual(0);
          expect(c).toBeLessThanOrEqual(255);
        }
      }),
      { numRuns: 100 },
    );
  });
});

// ---------------------------------------------------------------------------
// spring()
// ---------------------------------------------------------------------------

describe('property: spring — frame=0 returns `from`', () => {
  it('for any (mass, stiffness, damping) in the validated envelope', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0.1, max: 10, noNaN: true, noDefaultInfinity: true }),
        fc.double({ min: 1, max: 1000, noNaN: true, noDefaultInfinity: true }),
        fc.double({ min: 0.01, max: 100, noNaN: true, noDefaultInfinity: true }),
        fc.double({ min: -100, max: 100, noNaN: true, noDefaultInfinity: true }),
        fc.double({ min: -100, max: 100, noNaN: true, noDefaultInfinity: true }),
        (mass, stiffness, damping, from, to) => {
          const v = spring({ frame: 0, fps: 60, mass, stiffness, damping, from, to });
          expect(v).toBeCloseTo(from, 6);
        },
      ),
      { numRuns: 60 },
    );
  });
});

describe('property: spring — convergence', () => {
  it('after enough frames, a heavily-damped spring converges within epsilon of `to`', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0.5, max: 5, noNaN: true, noDefaultInfinity: true }),
        fc.double({ min: 50, max: 500, noNaN: true, noDefaultInfinity: true }),
        (mass, stiffness) => {
          const damping = 4 * Math.sqrt(mass * stiffness);
          const v = spring({
            frame: 600,
            fps: 60,
            mass,
            stiffness,
            damping,
            from: 0,
            to: 1,
          });
          expect(Math.abs(v - 1)).toBeLessThan(1e-2);
        },
      ),
      { numRuns: 30 },
    );
  });
});

describe('property: spring — never NaN or Infinity across envelope', () => {
  it('realistic params never produce non-finite output for any frame in [0, 600]', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 600 }),
        fc.double({ min: 0.1, max: 10, noNaN: true, noDefaultInfinity: true }),
        fc.double({ min: 1, max: 1000, noNaN: true, noDefaultInfinity: true }),
        fc.double({ min: 0.01, max: 200, noNaN: true, noDefaultInfinity: true }),
        (frame, mass, stiffness, damping) => {
          const v = spring({ frame, fps: 60, mass, stiffness, damping });
          expect(Number.isFinite(v)).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });
});
