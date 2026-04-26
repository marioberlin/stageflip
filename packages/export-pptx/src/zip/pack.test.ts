// packages/export-pptx/src/zip/pack.test.ts
import { unzipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { FROZEN_EPOCH } from '../types.js';
import { packZip } from './pack.js';

describe('zip/pack', () => {
  it('packs a sortable map and round-trips through unzipSync', () => {
    const bytes = packZip({
      'b/file.txt': 'hello',
      'a/file.txt': 'world',
    });
    const out = unzipSync(bytes);
    expect(Object.keys(out).sort()).toEqual(['a/file.txt', 'b/file.txt']);
  });

  it('produces byte-identical output across two calls with the same modifiedAt', () => {
    const entries = {
      'a.txt': 'a',
      'b.txt': 'b',
    } as const;
    const a = packZip(entries, new Date('2025-01-01T00:00:00Z'));
    const b = packZip(entries, new Date('2025-01-01T00:00:00Z'));
    expect(Buffer.from(a).equals(Buffer.from(b))).toBe(true);
  });

  it('produces byte-identical output across two calls when modifiedAt is omitted (frozen epoch fallback)', () => {
    const entries = { 'a.txt': 'a' } as const;
    const a = packZip(entries);
    const b = packZip(entries);
    expect(Buffer.from(a).equals(Buffer.from(b))).toBe(true);
  });

  it('FROZEN_EPOCH is exposed at 2024-01-01T00:00:00Z', () => {
    expect(FROZEN_EPOCH.toISOString()).toBe('2024-01-01T00:00:00.000Z');
  });
});
