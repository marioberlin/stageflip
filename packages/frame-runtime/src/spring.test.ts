// packages/frame-runtime/src/spring.test.ts
// Unit + property tests for spring() physics.

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { spring } from './spring.js';

describe('spring — starting conditions', () => {
  it('frame=0 returns `from`', () => {
    expect(spring({ frame: 0, fps: 60 })).toBe(0);
    expect(spring({ frame: 0, fps: 60, from: 5, to: 10 })).toBe(5);
  });

  it('converges toward `to` over many frames', () => {
    const v = spring({ frame: 300, fps: 60 });
    expect(v).toBeCloseTo(1, 2);
  });

  it('default config produces a smooth ramp 0 -> ~1', () => {
    const mid = spring({ frame: 30, fps: 60 });
    expect(mid).toBeGreaterThan(0);
    expect(mid).toBeLessThan(1.3); // may overshoot slightly under default damping
  });
});

describe('spring — parameter validation', () => {
  it('frame must be finite + non-negative', () => {
    expect(() => spring({ frame: -1, fps: 60 })).toThrow(/frame/);
    expect(() => spring({ frame: Number.NaN, fps: 60 })).toThrow(/frame/);
    expect(() => spring({ frame: Number.POSITIVE_INFINITY, fps: 60 })).toThrow(/frame/);
  });

  it('fps must be finite + > 0', () => {
    expect(() => spring({ frame: 0, fps: 0 })).toThrow(/fps/);
    expect(() => spring({ frame: 0, fps: -60 })).toThrow(/fps/);
    expect(() => spring({ frame: 0, fps: Number.NaN })).toThrow(/fps/);
  });

  it('mass > 0', () => {
    expect(() => spring({ frame: 0, fps: 60, mass: 0 })).toThrow(/mass/);
    expect(() => spring({ frame: 0, fps: 60, mass: -1 })).toThrow(/mass/);
  });

  it('stiffness > 0', () => {
    expect(() => spring({ frame: 0, fps: 60, stiffness: 0 })).toThrow(/stiffness/);
    expect(() => spring({ frame: 0, fps: 60, stiffness: -50 })).toThrow(/stiffness/);
  });

  it('damping ≥ 0.01 (matches T-043 [rev])', () => {
    expect(() => spring({ frame: 0, fps: 60, damping: 0 })).toThrow(/damping/);
    expect(() => spring({ frame: 0, fps: 60, damping: 0.005 })).toThrow(/damping/);
    // 0.01 is the boundary; should pass.
    spring({ frame: 10, fps: 60, damping: 0.01 });
  });
});

describe('spring — overshootClamping', () => {
  it('does not exceed target when clamped', () => {
    // Low-damping spring will normally overshoot; clamp prevents it.
    for (let frame = 0; frame <= 120; frame++) {
      const v = spring({
        frame,
        fps: 60,
        from: 0,
        to: 1,
        damping: 2,
        stiffness: 200,
        overshootClamping: true,
      });
      expect(v).toBeLessThanOrEqual(1);
    }
  });

  it('can overshoot when clamping is off', () => {
    let sawOvershoot = false;
    for (let frame = 0; frame <= 120; frame++) {
      const v = spring({
        frame,
        fps: 60,
        from: 0,
        to: 1,
        damping: 2,
        stiffness: 200,
      });
      if (v > 1.001) sawOvershoot = true;
    }
    expect(sawOvershoot).toBe(true);
  });
});

describe('spring — determinism', () => {
  it('same config + same frame -> identical output across calls', () => {
    const config = { frame: 50, fps: 60, from: 0, to: 1 };
    const a = spring(config);
    const b = spring(config);
    expect(a).toBe(b);
  });

  it('never returns NaN for well-formed input', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 600 }),
        fc.double({ min: 0.1, max: 10, noNaN: true }),
        fc.double({ min: 1, max: 1000, noNaN: true }),
        fc.double({ min: 0.01, max: 100, noNaN: true }),
        (frame, mass, stiffness, damping) => {
          const v = spring({ frame, fps: 60, mass, stiffness, damping });
          expect(Number.isNaN(v)).toBe(false);
          expect(Number.isFinite(v)).toBe(true);
        },
      ),
      { numRuns: 40 },
    );
  });
});

describe('spring — convergence properties', () => {
  it('critically damped spring approaches target monotonically', () => {
    // Approximate critical damping: damping ≈ 2·sqrt(mass·stiffness) = 20 for
    // defaults (2*sqrt(100)=20).
    let prev = 0;
    for (let frame = 0; frame <= 300; frame++) {
      const v = spring({ frame, fps: 60, damping: 20 });
      // Monotonic-approach check within small tolerance for numerical error.
      expect(v).toBeGreaterThanOrEqual(prev - 1e-6);
      prev = v;
    }
  });

  it('underdamped spring overshoots and recovers', () => {
    let maxVal = 0;
    for (let frame = 0; frame <= 300; frame++) {
      const v = spring({ frame, fps: 60, damping: 2 });
      if (v > maxVal) maxVal = v;
    }
    expect(maxVal).toBeGreaterThan(1);
  });
});
