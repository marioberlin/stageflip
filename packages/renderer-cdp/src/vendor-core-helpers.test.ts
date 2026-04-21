// packages/renderer-cdp/src/vendor-core-helpers.test.ts

import { describe, expect, it } from 'vitest';

import { MEDIA_VISUAL_STYLE_PROPERTIES, quantizeTimeToFrame } from './vendor-core-helpers';

describe('MEDIA_VISUAL_STYLE_PROPERTIES', () => {
  it('is a frozen-shape tuple of CSS property names', () => {
    expect(MEDIA_VISUAL_STYLE_PROPERTIES.length).toBeGreaterThan(10);
    for (const prop of MEDIA_VISUAL_STYLE_PROPERTIES) {
      expect(prop).toMatch(/^[a-z-]+$/);
    }
  });

  it('includes the transform + object-fit + opacity properties', () => {
    const set = new Set<string>(MEDIA_VISUAL_STYLE_PROPERTIES);
    expect(set.has('transform')).toBe(true);
    expect(set.has('object-fit')).toBe(true);
    expect(set.has('opacity')).toBe(true);
  });

  it('has no duplicate entries', () => {
    expect(new Set(MEDIA_VISUAL_STYLE_PROPERTIES).size).toBe(MEDIA_VISUAL_STYLE_PROPERTIES.length);
  });
});

describe('quantizeTimeToFrame', () => {
  it('snaps a mid-frame time to the enclosing frame start', () => {
    // 30 fps → frame 3 starts at 0.1s; 0.115s is mid-frame-3 → quantizes to 0.1s.
    expect(quantizeTimeToFrame(0.115, 30)).toBeCloseTo(0.1, 10);
  });

  it('leaves already-quantized times on their frame boundary', () => {
    // 30 fps → frame 6 starts at 0.2s; should round-trip exactly.
    expect(quantizeTimeToFrame(0.2, 30)).toBeCloseTo(0.2, 10);
  });

  it('snaps 24 fps frame boundaries', () => {
    // 24 fps → frame 1 starts at 1/24 ≈ 0.04166…s.
    expect(quantizeTimeToFrame(1 / 24, 24)).toBeCloseTo(1 / 24, 10);
    expect(quantizeTimeToFrame(0.08, 24)).toBeCloseTo(1 / 24, 10);
  });

  it('clamps negative time to zero', () => {
    expect(quantizeTimeToFrame(-1, 30)).toBe(0);
  });

  it('clamps non-finite time to zero', () => {
    expect(quantizeTimeToFrame(Number.NaN, 30)).toBe(0);
    expect(quantizeTimeToFrame(Number.POSITIVE_INFINITY, 30)).toBe(0);
  });

  it('falls back to 30 fps for non-finite or non-positive fps', () => {
    // At 30 fps fallback, t=0.1s → frame 3 → 0.1s.
    expect(quantizeTimeToFrame(0.1, 0)).toBeCloseTo(0.1, 10);
    expect(quantizeTimeToFrame(0.1, Number.NaN)).toBeCloseTo(0.1, 10);
    expect(quantizeTimeToFrame(0.1, -5)).toBeCloseTo(0.1, 10);
  });

  it('handles time at exactly zero', () => {
    expect(quantizeTimeToFrame(0, 30)).toBe(0);
  });
});
