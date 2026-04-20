// packages/frame-runtime/src/interpolate-colors.test.ts
// Unit + property tests for interpolateColors().

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { EASINGS } from './easings.js';
import { interpolateColors } from './interpolate-colors.js';

describe('interpolateColors — endpoints', () => {
  it('maps input at first range point to first color (hex)', () => {
    expect(interpolateColors(0, [0, 100], ['#000000', '#ffffff'])).toBe('#000000');
  });

  it('maps input at last range point to last color (hex)', () => {
    expect(interpolateColors(100, [0, 100], ['#000000', '#ffffff'])).toBe('#ffffff');
  });

  it('accepts short-form hex on input', () => {
    expect(interpolateColors(0, [0, 100], ['#000', '#fff'])).toBe('#000000');
    expect(interpolateColors(100, [0, 100], ['#000', '#fff'])).toBe('#ffffff');
  });

  it('accepts named colors', () => {
    expect(interpolateColors(0, [0, 100], ['red', 'blue'])).toBe('#ff0000');
    expect(interpolateColors(100, [0, 100], ['red', 'blue'])).toBe('#0000ff');
  });

  it('accepts rgb() input', () => {
    expect(interpolateColors(0, [0, 100], ['rgb(0, 0, 0)', 'rgb(255, 255, 255)'])).toBe('#000000');
  });
});

describe('interpolateColors — midpoint (rgb space)', () => {
  it('grayscale midpoint is #808080', () => {
    expect(interpolateColors(50, [0, 100], ['#000000', '#ffffff'])).toBe('#808080');
  });

  it('red → blue midpoint is #800080 (purple)', () => {
    expect(interpolateColors(50, [0, 100], ['#ff0000', '#0000ff'])).toBe('#800080');
  });
});

describe('interpolateColors — multi-segment', () => {
  it('piecewise across 3 colors at 0/50/100', () => {
    const colors = ['#ff0000', '#00ff00', '#0000ff'] as const;
    expect(interpolateColors(0, [0, 50, 100], colors)).toBe('#ff0000');
    expect(interpolateColors(50, [0, 50, 100], colors)).toBe('#00ff00');
    expect(interpolateColors(100, [0, 50, 100], colors)).toBe('#0000ff');
    // midway of first segment: red → green at t=0.5 → #808000
    expect(interpolateColors(25, [0, 50, 100], colors)).toBe('#808000');
    // midway of second segment: green → blue at t=0.5 → #008080
    expect(interpolateColors(75, [0, 50, 100], colors)).toBe('#008080');
  });
});

describe('interpolateColors — alpha channel linear', () => {
  it('transparent → opaque black at midpoint is rgba(0, 0, 0, 0.5)', () => {
    const result = interpolateColors(50, [0, 100], ['rgba(0, 0, 0, 0)', 'rgba(0, 0, 0, 1)']);
    expect(result).toBe('rgba(0, 0, 0, 0.5)');
  });

  it('opaque endpoints produce hex output', () => {
    const result = interpolateColors(50, [0, 100], ['#000000', '#ffffff']);
    expect(result).not.toMatch(/^rgba/);
    expect(result).toMatch(/^#[0-9a-f]{6}$/);
  });

  it('any partial alpha at input yields rgba output', () => {
    const result = interpolateColors(
      50,
      [0, 100],
      ['rgba(255, 0, 0, 0.5)', 'rgba(0, 0, 255, 0.5)'],
    );
    expect(result).toBe('rgba(128, 0, 128, 0.5)');
  });
});

describe('interpolateColors — easing applied', () => {
  it('quad-in at midpoint shifts toward the start color', () => {
    // quadIn(0.5) = 0.25
    const result = interpolateColors(50, [0, 100], ['#000000', '#ffffff'], {
      easing: EASINGS['quad-in'],
    });
    // 0.25 * 255 = 63.75 → 64 = 0x40
    expect(result).toBe('#404040');
  });
});

describe('interpolateColors — color space switching', () => {
  it('rgb vs hsl midpoints for red → blue differ', () => {
    const rgbMid = interpolateColors(50, [0, 100], ['#ff0000', '#0000ff'], { colorSpace: 'rgb' });
    const hslMid = interpolateColors(50, [0, 100], ['#ff0000', '#0000ff'], { colorSpace: 'hsl' });
    expect(rgbMid).toBe('#800080');
    expect(hslMid).not.toBe(rgbMid);
  });

  it('rgb vs oklch midpoints differ for red → green', () => {
    const rgbMid = interpolateColors(50, [0, 100], ['#ff0000', '#00ff00'], { colorSpace: 'rgb' });
    const oklchMid = interpolateColors(50, [0, 100], ['#ff0000', '#00ff00'], {
      colorSpace: 'oklch',
    });
    expect(oklchMid).not.toBe(rgbMid);
    expect(oklchMid).toMatch(/^#[0-9a-f]{6}$/);
  });

  it('defaults to rgb when colorSpace omitted', () => {
    const defaultMid = interpolateColors(50, [0, 100], ['#ff0000', '#0000ff']);
    const rgbMid = interpolateColors(50, [0, 100], ['#ff0000', '#0000ff'], { colorSpace: 'rgb' });
    expect(defaultMid).toBe(rgbMid);
  });
});

describe('interpolateColors — extrapolation', () => {
  it('clamp left returns first color unchanged', () => {
    const result = interpolateColors(-10, [0, 100], ['#ff0000', '#0000ff'], {
      extrapolateLeft: 'clamp',
    });
    expect(result).toBe('#ff0000');
  });

  it('clamp right returns last color unchanged', () => {
    const result = interpolateColors(200, [0, 100], ['#ff0000', '#0000ff'], {
      extrapolateRight: 'clamp',
    });
    expect(result).toBe('#0000ff');
  });

  it('extend extrapolates channel-wise (may clamp to gamut)', () => {
    // input=150 with range [0,100] and colors [black, mid-gray]
    // fraction = 1.5 → rgb midpoint would be (0.75, 0.75, 0.75) clamped to [0,1]
    const result = interpolateColors(150, [0, 100], ['#000000', '#808080'], {
      extrapolateRight: 'extend',
    });
    // 0.5 * 1.5 ≈ 0.7529 → 192 = 0xc0
    expect(result).toBe('#c0c0c0');
  });

  it('extend past white clamps to white (gamut-bound)', () => {
    const result = interpolateColors(300, [0, 100], ['#000000', '#808080'], {
      extrapolateRight: 'extend',
    });
    expect(result).toBe('#ffffff');
  });

  it('identity mode is rejected for colors', () => {
    expect(() =>
      interpolateColors(-10, [0, 100], ['#ff0000', '#0000ff'], { extrapolateLeft: 'identity' }),
    ).toThrow(/identity/);
  });
});

describe('interpolateColors — validation', () => {
  it('throws when ranges are shorter than 2', () => {
    expect(() => interpolateColors(0, [0], ['#ff0000'])).toThrow(/at least 2/);
  });

  it('throws when inputRange and outputColors lengths differ', () => {
    expect(() => interpolateColors(0, [0, 50, 100], ['#ff0000', '#0000ff'])).toThrow(
      /length.*must equal/,
    );
  });

  it('throws on non-ascending inputRange', () => {
    expect(() => interpolateColors(0, [100, 0], ['#ff0000', '#0000ff'])).toThrow(
      /strictly ascending/,
    );
  });

  it('throws on NaN input', () => {
    expect(() => interpolateColors(Number.NaN, [0, 100], ['#ff0000', '#0000ff'])).toThrow(/NaN/);
  });

  it('throws on unparseable color', () => {
    expect(() => interpolateColors(0, [0, 100], ['not-a-color', '#0000ff'])).toThrow(/parse/);
  });

  it('throws on unknown color space', () => {
    expect(() =>
      // biome-ignore lint/suspicious/noExplicitAny: exercising runtime validation
      interpolateColors(0, [0, 100], ['#000', '#fff'], { colorSpace: 'lab' as any }),
    ).toThrow(/colorSpace/);
  });
});

describe('interpolateColors — property: endpoint stability', () => {
  it('input at any inputRange point returns the paired color', () => {
    fc.assert(
      fc.property(
        fc
          .array(
            fc.integer({ min: 0, max: 360 }).map((h) => h),
            { minLength: 2, maxLength: 5 },
          )
          .map((hues) =>
            hues.map((h) => {
              const hex = Math.round((h / 360) * 0xffffff)
                .toString(16)
                .padStart(6, '0');
              return `#${hex}`;
            }),
          ),
        (colors) => {
          const input = colors.map((_, i) => i * 10);
          for (let i = 0; i < colors.length; i++) {
            const at = input[i] as number;
            const c = colors[i] as string;
            const out = interpolateColors(at, input, colors);
            // normalize to #rrggbb from the parsed form — round-trip through
            // interpolateColors canonicalises casing and length
            expect(out.toLowerCase()).toBe(c.toLowerCase());
          }
        },
      ),
      { numRuns: 50 },
    );
  });
});
