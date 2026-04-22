// packages/import-slidemotion-legacy/src/sanitize.test.ts

import { describe, expect, it } from 'vitest';
import { normalizeHexColor, normalizeIso, sanitizeId, toAssetRef, uniqueifyIds } from './sanitize';

describe('sanitizeId', () => {
  it('passes URL-safe input through unchanged', () => {
    expect(sanitizeId('slide-01', 'fallback')).toBe('slide-01');
  });

  it('replaces runs of invalid chars with a single underscore', () => {
    expect(sanitizeId('foo bar baz', 'fallback')).toBe('foo_bar_baz');
  });

  it('collapses consecutive replacements and trims separators', () => {
    expect(sanitizeId('  --foo   bar--  ', 'fallback')).toBe('foo_bar');
  });

  it('folds unicode / punctuation into underscores', () => {
    expect(sanitizeId('Hello, Wörld! 🦊', 'fallback')).toBe('Hello_W_rld');
  });

  it('falls back when the result would be empty', () => {
    expect(sanitizeId('!!! ??? ###', 'fallback-id')).toBe('fallback-id');
    expect(sanitizeId('', 'fallback-id')).toBe('fallback-id');
  });
});

describe('uniqueifyIds', () => {
  it('keeps unique inputs unchanged', () => {
    expect(uniqueifyIds(['a', 'b', 'c'])).toEqual(['a', 'b', 'c']);
  });

  it('suffixes duplicates with -2, -3, … in first-seen order', () => {
    expect(uniqueifyIds(['a', 'b', 'a', 'a', 'c'])).toEqual(['a', 'b', 'a-2', 'a-3', 'c']);
  });

  it('treats differently-cased ids as distinct', () => {
    expect(uniqueifyIds(['Foo', 'foo'])).toEqual(['Foo', 'foo']);
  });
});

describe('toAssetRef', () => {
  it('prefixes a sanitized asset id', () => {
    expect(toAssetRef('cover.jpg')).toBe('asset:cover_jpg');
  });

  it('passes through already-safe ids', () => {
    expect(toAssetRef('hero-image-42')).toBe('asset:hero-image-42');
  });

  it('returns null on all-invalid inputs', () => {
    expect(toAssetRef('')).toBeNull();
    expect(toAssetRef('!!!')).toBeNull();
  });
});

describe('normalizeIso', () => {
  it('round-trips valid ISO 8601 strings', () => {
    expect(normalizeIso('2026-04-22T12:00:00.000Z')).toBe('2026-04-22T12:00:00.000Z');
  });

  it('canonicalizes non-UTC offsets to Z form', () => {
    expect(normalizeIso('2026-04-22T14:00:00+02:00')).toBe('2026-04-22T12:00:00.000Z');
  });

  it('returns null for unparseable input', () => {
    expect(normalizeIso('not a date')).toBeNull();
    expect(normalizeIso(undefined)).toBeNull();
    expect(normalizeIso('')).toBeNull();
  });
});

describe('normalizeHexColor', () => {
  it('accepts #RGB / #RRGGBB / #RRGGBBAA and lowercases', () => {
    expect(normalizeHexColor('#ABC')).toBe('#abc');
    expect(normalizeHexColor('#112233')).toBe('#112233');
    expect(normalizeHexColor('#11223344')).toBe('#11223344');
  });

  it('rejects CSS names, rgb(), and non-strings', () => {
    expect(normalizeHexColor('red')).toBeNull();
    expect(normalizeHexColor('rgb(1,2,3)')).toBeNull();
    expect(normalizeHexColor(null)).toBeNull();
    expect(normalizeHexColor(123)).toBeNull();
  });
});
