// packages/fonts/src/aggregate.test.ts
// Unit tests for aggregateFontRequirements + formatFontShorthand.

import { describe, expect, it } from 'vitest';

import type { FontRequirement } from '@stageflip/runtimes-contract';

import { aggregateFontRequirements, formatFontShorthand } from './aggregate.js';

describe('aggregateFontRequirements — dedup', () => {
  it('collapses duplicates with identical (family, weight, style)', () => {
    const out = aggregateFontRequirements([
      { family: 'Inter', weight: 400, style: 'normal' },
      { family: 'Inter', weight: 400, style: 'normal' },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0]?.family).toBe('Inter');
    expect(out[0]?.weight).toBe(400);
  });

  it('treats family case-insensitively for dedup', () => {
    const out = aggregateFontRequirements([
      { family: 'Inter', weight: 400 },
      { family: 'INTER', weight: 400 },
    ]);
    expect(out).toHaveLength(1);
  });

  it('treats missing weight/style as defaults (400, normal)', () => {
    const out = aggregateFontRequirements([
      { family: 'Inter' },
      { family: 'Inter', weight: 400, style: 'normal' },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0]?.weight).toBe(400);
    expect(out[0]?.style).toBe('normal');
  });

  it('keeps different weights as separate entries', () => {
    const out = aggregateFontRequirements([
      { family: 'Inter', weight: 400 },
      { family: 'Inter', weight: 600 },
    ]);
    expect(out).toHaveLength(2);
  });

  it('keeps different styles as separate entries', () => {
    const out = aggregateFontRequirements([
      { family: 'Inter', weight: 400, style: 'normal' },
      { family: 'Inter', weight: 400, style: 'italic' },
    ]);
    expect(out).toHaveLength(2);
  });
});

describe('aggregateFontRequirements — subsets / features union', () => {
  it('unions subsets across merged requirements', () => {
    const out = aggregateFontRequirements([
      { family: 'Inter', weight: 400, subsets: ['latin'] },
      { family: 'Inter', weight: 400, subsets: ['cyrillic', 'latin-ext'] },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0]?.subsets).toEqual(['cyrillic', 'latin', 'latin-ext']);
  });

  it('unions features across merged requirements', () => {
    const out = aggregateFontRequirements([
      { family: 'Inter', weight: 400, features: ['ss01'] },
      { family: 'Inter', weight: 400, features: ['tnum', 'ss01'] },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0]?.features).toEqual(['ss01', 'tnum']);
  });

  it('omits subsets field when no input declared any', () => {
    const out = aggregateFontRequirements([{ family: 'Inter', weight: 400 }]);
    expect(out[0]?.subsets).toBeUndefined();
  });

  it('trims whitespace-only and empty subset entries', () => {
    const out = aggregateFontRequirements([
      { family: 'Inter', weight: 400, subsets: ['latin ', '', '  ', 'cyrillic'] },
    ]);
    expect(out[0]?.subsets).toEqual(['cyrillic', 'latin']);
  });
});

describe('aggregateFontRequirements — sort + validation', () => {
  it('sorts by family (case-insensitive), then weight, then style', () => {
    const out = aggregateFontRequirements([
      { family: 'Roboto', weight: 400 },
      { family: 'Inter', weight: 600 },
      { family: 'Inter', weight: 400, style: 'italic' },
      { family: 'Inter', weight: 400, style: 'normal' },
    ]);
    expect(out.map((r) => [r.family, r.weight, r.style])).toEqual([
      ['Inter', 400, 'normal'],
      ['Inter', 400, 'italic'],
      ['Inter', 600, 'normal'],
      ['Roboto', 400, 'normal'],
    ]);
  });

  it('throws on empty / whitespace family', () => {
    expect(() => aggregateFontRequirements([{ family: '' }])).toThrow(/family/);
    expect(() => aggregateFontRequirements([{ family: '   ' }])).toThrow(/family/);
  });

  it('preserves a stable output on repeated identical inputs', () => {
    const input: FontRequirement[] = [
      { family: 'Inter', weight: 600, subsets: ['latin'] },
      { family: 'Roboto', weight: 400 },
    ];
    const a = aggregateFontRequirements(input);
    const b = aggregateFontRequirements(input);
    expect(a).toEqual(b);
  });
});

describe('formatFontShorthand', () => {
  it('emits CSS-compatible shorthand for document.fonts.check', () => {
    expect(formatFontShorthand({ family: 'Inter', weight: 600, style: 'italic' })).toBe(
      'italic 600 16px "Inter"',
    );
  });

  it('defaults weight + style + px size', () => {
    expect(formatFontShorthand({ family: 'Inter' })).toBe('normal 400 16px "Inter"');
  });

  it('wraps multi-word family names in quotes', () => {
    expect(formatFontShorthand({ family: 'Fraunces Variable' })).toBe(
      'normal 400 16px "Fraunces Variable"',
    );
  });

  it('accepts an explicit px size', () => {
    expect(formatFontShorthand({ family: 'Inter' }, 48)).toBe('normal 400 48px "Inter"');
  });
});
