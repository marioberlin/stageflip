// packages/pack-format/src/compatibility.test.ts
// T-502 — Tests for the engine ↔ manifestVersion compatibility matrix.

import { describe, expect, it } from 'vitest';

import {
  COMPATIBILITY_MATRIX,
  isCompatible,
  matchingRows,
  readableManifestVersions,
} from './compatibility.js';

describe('isCompatible', () => {
  it('engine 2.0.0 + manifestVersion 1 → true', () => {
    expect(isCompatible('2.0.0', '1')).toBe(true);
  });

  it('engine 2.99.99 + manifestVersion 1 → true', () => {
    expect(isCompatible('2.99.99', '1')).toBe(true);
  });

  it('engine 1.99.99 + manifestVersion 1 → false (engine pre-launch)', () => {
    expect(isCompatible('1.99.99', '1')).toBe(false);
  });

  it('engine 2.0.0 + manifestVersion 2 → false (no row supports v2 yet)', () => {
    expect(isCompatible('2.0.0', '2')).toBe(false);
  });

  it('malformed engine version → false, does not throw', () => {
    expect(isCompatible('not-a-version', '1')).toBe(false);
  });

  it('unknown manifestVersion → false', () => {
    expect(isCompatible('2.5.0', '99')).toBe(false);
  });

  it('empty manifestVersion → false', () => {
    expect(isCompatible('2.5.0', '')).toBe(false);
  });
});

describe('readableManifestVersions', () => {
  it('engine 2.5.0 → ["1"]', () => {
    expect(readableManifestVersions('2.5.0')).toEqual(['1']);
  });

  it('engine 1.0.0 (pre-launch) → []', () => {
    expect(readableManifestVersions('1.0.0')).toEqual([]);
  });

  it('malformed engine version → []', () => {
    expect(readableManifestVersions('garbage')).toEqual([]);
  });

  it('returned array is deduplicated', () => {
    // Defensive: even if a future row repeats '1' across multiple rows
    // that both match the engine, the result must be unique.
    const result = readableManifestVersions('2.5.0');
    expect(new Set(result).size).toBe(result.length);
  });
});

describe('matchingRows', () => {
  it('returns the P16-launch row for engine 2.5.0', () => {
    const rows = matchingRows('2.5.0');
    expect(rows.length).toBe(1);
    expect(rows[0]?.manifestVersions).toEqual(['1']);
    expect(rows[0]?.note).toBe('P16 launch: manifestVersion 1 only');
  });

  it('returns [] for engine 1.0.0', () => {
    expect(matchingRows('1.0.0')).toEqual([]);
  });

  it('returns [] for malformed engine version', () => {
    expect(matchingRows('not-a-version')).toEqual([]);
  });
});

describe('COMPATIBILITY_MATRIX', () => {
  it('includes a row for engine 2.x covering manifestVersion 1', () => {
    const found = COMPATIBILITY_MATRIX.some(
      (row) => row.engineRange.includes('2.0.0') && row.manifestVersions.includes('1'),
    );
    expect(found).toBe(true);
  });

  it('every row has at least one manifestVersion', () => {
    for (const row of COMPATIBILITY_MATRIX) {
      expect(row.manifestVersions.length).toBeGreaterThan(0);
    }
  });

  it('every engineRange is non-empty', () => {
    for (const row of COMPATIBILITY_MATRIX) {
      expect(row.engineRange.length).toBeGreaterThan(0);
    }
  });
});
