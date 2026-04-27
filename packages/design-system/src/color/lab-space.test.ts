// packages/design-system/src/color/lab-space.test.ts
// Round-trip + edge-case tests for the hand-rolled Lab-space conversion.

import { describe, expect, it } from 'vitest';
import { deltaE, hexToLab, labToRgb, lightness, parseHex, rgbToLab, toHex } from './lab-space.js';

describe('parseHex / toHex', () => {
  it('parses #rrggbb', () => {
    expect(parseHex('#ff0000')).toEqual({ r: 255, g: 0, b: 0 });
    expect(parseHex('#00ff00')).toEqual({ r: 0, g: 255, b: 0 });
    expect(parseHex('#0000ff')).toEqual({ r: 0, g: 0, b: 255 });
  });

  it('parses 3-digit shorthand', () => {
    expect(parseHex('#f00')).toEqual({ r: 255, g: 0, b: 0 });
    expect(parseHex('#abc')).toEqual({ r: 170, g: 187, b: 204 });
  });

  it('parses 8-digit and ignores alpha', () => {
    expect(parseHex('#ff000080')).toEqual({ r: 255, g: 0, b: 0 });
  });

  it('rejects malformed', () => {
    expect(() => parseHex('ff0000')).toThrow();
    expect(() => parseHex('#zz0000')).toThrow();
    expect(() => parseHex('#1234')).toThrow();
  });

  it('round-trips toHex', () => {
    expect(toHex({ r: 255, g: 0, b: 128 })).toBe('#ff0080');
    expect(toHex({ r: 0, g: 0, b: 0 })).toBe('#000000');
    expect(toHex({ r: 255, g: 255, b: 255 })).toBe('#ffffff');
  });

  it('clamps out-of-range channels in toHex', () => {
    expect(toHex({ r: 300, g: -10, b: 128 })).toBe('#ff0080');
  });
});

describe('rgbToLab / labToRgb', () => {
  it('white → L=100, a=0, b=0', () => {
    const lab = rgbToLab({ r: 255, g: 255, b: 255 });
    expect(lab.L).toBeCloseTo(100, 1);
    expect(lab.a).toBeCloseTo(0, 1);
    expect(lab.b).toBeCloseTo(0, 1);
  });

  it('black → L=0', () => {
    const lab = rgbToLab({ r: 0, g: 0, b: 0 });
    expect(lab.L).toBeCloseTo(0, 1);
  });

  it('round-trips to within 1 unit', () => {
    for (const hex of ['#ff0000', '#00ff00', '#0000ff', '#7f7f7f', '#123456', '#abcdef']) {
      const orig = parseHex(hex);
      const back = labToRgb(rgbToLab(orig));
      expect(Math.abs(back.r - orig.r)).toBeLessThan(1.5);
      expect(Math.abs(back.g - orig.g)).toBeLessThan(1.5);
      expect(Math.abs(back.b - orig.b)).toBeLessThan(1.5);
    }
  });
});

describe('deltaE', () => {
  it('identical colors → 0', () => {
    const a = hexToLab('#ff0000');
    expect(deltaE(a, a)).toBe(0);
  });

  it('perceptually-similar reds cluster (ΔE < 5)', () => {
    // AC #7 — #ff0000 and #ff0808 should be perceptually close.
    const a = hexToLab('#ff0000');
    const b = hexToLab('#ff0808');
    expect(deltaE(a, b)).toBeLessThan(5);
  });

  it('opposite colors are far apart', () => {
    expect(deltaE(hexToLab('#ffffff'), hexToLab('#000000'))).toBeGreaterThan(50);
  });
});

describe('lightness', () => {
  it('white is bright', () => {
    expect(lightness(hexToLab('#ffffff'))).toBeGreaterThan(0.85);
  });

  it('black is dark', () => {
    expect(lightness(hexToLab('#000000'))).toBeLessThan(0.2);
  });

  it('mid-gray is in between', () => {
    const l = lightness(hexToLab('#808080'));
    expect(l).toBeGreaterThan(0.4);
    expect(l).toBeLessThan(0.65);
  });
});
