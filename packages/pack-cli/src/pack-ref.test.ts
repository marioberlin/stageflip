// packages/pack-cli/src/pack-ref.test.ts

import { describe, expect, it } from 'vitest';

import { parsePackRef } from './pack-ref.js';

describe('parsePackRef', () => {
  it('returns null for undefined input', () => {
    expect(parsePackRef(undefined)).toBeNull();
  });

  it('returns null for empty input', () => {
    expect(parsePackRef('')).toBeNull();
  });

  it('parses a bare id (no @version)', () => {
    expect(parsePackRef('pack-a')).toEqual({ id: 'pack-a' });
  });

  it('parses id@version', () => {
    expect(parsePackRef('pack-a@1.2.3')).toEqual({ id: 'pack-a', version: '1.2.3' });
  });

  it('returns null when the version slice is empty', () => {
    expect(parsePackRef('pack-a@')).toBeNull();
  });

  it('returns null when the id slice is empty', () => {
    expect(parsePackRef('@1.2.3')).toBeNull();
  });
});
