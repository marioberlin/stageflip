// packages/import-hyperframes-html/src/dom/inline-style.test.ts
// Unit tests for the inline-style parser. Pin AC #19 / #20 / #20a math at the
// `parseTransform` level here; the higher-level transform extraction in
// `elements/shared.ts` re-asserts the pinning at element scope.

import { describe, expect, it } from 'vitest';
import {
  parseInlineStyle,
  parsePxLength,
  parseTransform,
  serializeInlineStyle,
} from './inline-style.js';

describe('parseInlineStyle', () => {
  it('parses a multi-property declaration', () => {
    const out = parseInlineStyle('left: 540px; top: 1360px; width: 200px');
    expect(out).toEqual({ left: '540px', top: '1360px', width: '200px' });
  });

  it('lowercases property names', () => {
    const out = parseInlineStyle('LEFT: 540px');
    expect(out).toEqual({ left: '540px' });
  });

  it('skips declarations missing colons', () => {
    const out = parseInlineStyle('left: 0; bogus; top: 1');
    expect(out).toEqual({ left: '0', top: '1' });
  });

  it('round-trips through serializeInlineStyle', () => {
    const props = { left: '0px', top: '0px' };
    expect(parseInlineStyle(serializeInlineStyle(props))).toEqual(props);
  });
});

describe('parsePxLength', () => {
  it('parses pixel lengths', () => {
    expect(parsePxLength('540px')).toBe(540);
    expect(parsePxLength(' -50px ')).toBe(-50);
  });

  it('returns undefined for non-pixel values', () => {
    expect(parsePxLength('50%')).toBeUndefined();
    expect(parsePxLength(undefined)).toBeUndefined();
  });
});

describe('parseTransform', () => {
  it('detects center-anchor translate(-50%, -50%) (AC #19 source signal)', () => {
    const t = parseTransform('translate(-50%, -50%)');
    expect(t.centerAnchor).toBe(true);
  });

  it('parses scale(N) (AC #20 source signal)', () => {
    const t = parseTransform('scale(0)');
    expect(t.scale).toBe(0);
  });

  it('parses rotate(Ndeg) (AC #20a)', () => {
    const t = parseTransform('rotate(45deg)');
    expect(t.rotation).toBe(45);
  });

  it('parses combined translate + rotate', () => {
    const t = parseTransform('translate(-50%, -50%) rotate(90deg)');
    expect(t.centerAnchor).toBe(true);
    expect(t.rotation).toBe(90);
  });

  it('returns undefined-bearing record when value is missing', () => {
    const t = parseTransform(undefined);
    expect(t).toEqual({ centerAnchor: false });
  });
});
