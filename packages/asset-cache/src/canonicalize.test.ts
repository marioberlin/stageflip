// packages/asset-cache/src/canonicalize.test.ts
// Coverage for the JSON canonical-form serializer used by deriveCacheKey.

import { describe, expect, it } from 'vitest';

import { canonicalize } from './canonicalize.js';

describe('canonicalize', () => {
  it('produces identical output for identical scalars', () => {
    expect(canonicalize('hello')).toBe(canonicalize('hello'));
    expect(canonicalize(42)).toBe(canonicalize(42));
    expect(canonicalize(true)).toBe(canonicalize(true));
    expect(canonicalize(null)).toBe(canonicalize(null));
  });

  it('encodes scalars as JSON', () => {
    expect(canonicalize('hello')).toBe('"hello"');
    expect(canonicalize(42)).toBe('42');
    expect(canonicalize(true)).toBe('true');
    expect(canonicalize(false)).toBe('false');
    expect(canonicalize(null)).toBe('null');
  });

  it('sorts top-level object keys alphabetically', () => {
    expect(canonicalize({ b: 2, a: 1 })).toBe(canonicalize({ a: 1, b: 2 }));
    expect(canonicalize({ b: 2, a: 1 })).toBe('{"a":1,"b":2}');
  });

  it('sorts nested object keys recursively', () => {
    const a = canonicalize({ outer: { z: 1, a: 2 }, alpha: { y: 3, b: 4 } });
    const b = canonicalize({ alpha: { b: 4, y: 3 }, outer: { a: 2, z: 1 } });
    expect(a).toBe(b);
    expect(a).toBe('{"alpha":{"b":4,"y":3},"outer":{"a":2,"z":1}}');
  });

  it('preserves array order (arrays are ordered structures)', () => {
    expect(canonicalize([3, 1, 2])).toBe('[3,1,2]');
    expect(canonicalize([3, 1, 2])).not.toBe(canonicalize([1, 2, 3]));
  });

  it('canonicalizes objects inside arrays', () => {
    const a = canonicalize([{ b: 1, a: 2 }]);
    const b = canonicalize([{ a: 2, b: 1 }]);
    expect(a).toBe(b);
    expect(a).toBe('[{"a":2,"b":1}]');
  });

  it('handles deeply nested mixed structures', () => {
    const a = canonicalize({ a: [1, { y: 2, x: 3 }], b: { c: { f: 4, e: 5 } } });
    const b = canonicalize({ b: { c: { e: 5, f: 4 } }, a: [1, { x: 3, y: 2 }] });
    expect(a).toBe(b);
  });

  it('omits properties whose value is undefined', () => {
    expect(canonicalize({ a: 1, b: undefined })).toBe('{"a":1}');
  });

  it('treats undefined as null inside arrays (matches JSON.stringify)', () => {
    expect(canonicalize([1, undefined, 2])).toBe('[1,null,2]');
  });

  it('handles empty object + empty array', () => {
    expect(canonicalize({})).toBe('{}');
    expect(canonicalize([])).toBe('[]');
  });

  it('escapes strings per JSON spec', () => {
    expect(canonicalize('he said "hi"')).toBe('"he said \\"hi\\""');
    expect(canonicalize('line1\nline2')).toBe('"line1\\nline2"');
  });

  it('round-trips floating-point numbers consistently', () => {
    expect(canonicalize(1.5)).toBe(canonicalize(1.5));
    expect(canonicalize(0)).toBe('0');
    expect(canonicalize(-0)).toBe('0');
  });
});
