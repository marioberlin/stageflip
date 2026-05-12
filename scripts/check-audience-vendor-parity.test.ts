// scripts/check-audience-vendor-parity.test.ts
// Unit tests for the audience-vendor parity gate (T-485).

import { describe, expect, it } from 'vitest';

import { VENDOR_PARITY_MATRIX, checkRow, runCheck } from './check-audience-vendor-parity.js';

describe('VENDOR_PARITY_MATRIX', () => {
  it('contains all 6 audience-backend adapters (native + 5 vendors)', () => {
    expect(VENDOR_PARITY_MATRIX).toHaveLength(6);
    const ids = VENDOR_PARITY_MATRIX.map((r) => r.adapterId);
    expect(ids).toEqual([
      'audience-native',
      'audience-slido',
      'audience-mentimeter',
      'audience-polleverywhere',
      'audience-vevox',
      'audience-wooclap',
    ]);
  });

  it('audience-native covers all 11 clip kinds (motion-native true)', () => {
    const row = VENDOR_PARITY_MATRIX.find((r) => r.adapterId === 'audience-native');
    expect(row?.expectedSupportedKinds).toHaveLength(11);
    expect(row?.expectedSupportsMotionNative).toBe(true);
  });

  it('audience-vevox omits leaderboard (7 supported kinds)', () => {
    const row = VENDOR_PARITY_MATRIX.find((r) => r.adapterId === 'audience-vevox');
    expect(row?.expectedSupportedKinds).toHaveLength(7);
    expect(row?.expectedSupportedKinds).not.toContain('leaderboard');
  });

  it('other vendors omit motion-native (8 supported kinds each)', () => {
    const eightKindVendors = [
      'audience-slido',
      'audience-mentimeter',
      'audience-polleverywhere',
      'audience-wooclap',
    ];
    for (const id of eightKindVendors) {
      const row = VENDOR_PARITY_MATRIX.find((r) => r.adapterId === id);
      expect(row?.expectedSupportedKinds).toHaveLength(8);
      expect(row?.expectedSupportsMotionNative).toBe(false);
    }
  });
});

describe('checkRow', () => {
  it('returns no drift when descriptor matches', () => {
    for (const row of VENDOR_PARITY_MATRIX) {
      expect(checkRow(row)).toEqual([]);
    }
  });

  it('detects a missing clip kind', () => {
    const row = VENDOR_PARITY_MATRIX[0];
    if (row === undefined) throw new Error('Test setup: row[0] is undefined.');
    const corrupted = {
      ...row,
      descriptor: {
        capability: {
          supportedClipKinds: ['live-poll-multiple-choice'] as readonly string[],
          supportsMotionNative: row.expectedSupportsMotionNative,
        },
      },
    };
    const drifts = checkRow(corrupted);
    expect(drifts.some((d) => d.field === 'supportedClipKinds.missing')).toBe(true);
  });

  it('detects an extra clip kind', () => {
    const row = VENDOR_PARITY_MATRIX[1]; // Slido
    if (row === undefined) throw new Error('Test setup: row[1] is undefined.');
    const corrupted = {
      ...row,
      descriptor: {
        capability: {
          supportedClipKinds: [...row.expectedSupportedKinds, 'heatmap'] as readonly string[],
          supportsMotionNative: false,
        },
      },
    };
    const drifts = checkRow(corrupted);
    expect(drifts.some((d) => d.field === 'supportedClipKinds.extra')).toBe(true);
  });

  it('detects supportsMotionNative drift', () => {
    const row = VENDOR_PARITY_MATRIX[1]; // Slido (expected false)
    if (row === undefined) throw new Error('Test setup: row[1] is undefined.');
    const corrupted = {
      ...row,
      descriptor: {
        capability: {
          supportedClipKinds: row.expectedSupportedKinds,
          supportsMotionNative: true,
        },
      },
    };
    const drifts = checkRow(corrupted);
    expect(drifts.some((d) => d.field === 'supportsMotionNative')).toBe(true);
  });
});

describe('runCheck', () => {
  it('returns empty drift list against the live descriptors (PASS inaugural)', () => {
    expect(runCheck()).toEqual([]);
  });
});
