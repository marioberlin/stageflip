// packages/pack-format/src/loss-flags.test.ts

import { describe, expect, it } from 'vitest';

import { PACK_FORMAT_LF_CODES, PACK_FORMAT_LF_SPECS } from './loss-flags.js';

describe('PACK_FORMAT_LF_CODES', () => {
  it('contains 5 codes per ADR-012 §D10', () => {
    expect(PACK_FORMAT_LF_CODES).toHaveLength(5);
  });

  it('matches the ADR-012 §D10 inventory exactly', () => {
    expect([...PACK_FORMAT_LF_CODES]).toEqual([
      'LF-LICENSE-PACK-DENIED',
      'LF-LICENSE-CLIP-REVOKED',
      'LF-PACK-SIGNATURE-INVALID',
      'LF-PACK-INCOMPATIBLE-VERSION',
      'LF-PACK-MANIFEST-PARSE-ERROR',
    ]);
  });
});

describe('PACK_FORMAT_LF_SPECS', () => {
  it('has one spec per code', () => {
    expect(PACK_FORMAT_LF_SPECS).toHaveLength(PACK_FORMAT_LF_CODES.length);
  });

  it('declares severities consistent with ADR-012 §D10 table', () => {
    const expected: Record<string, 'info' | 'warn' | 'error'> = {
      'LF-LICENSE-PACK-DENIED': 'error',
      'LF-LICENSE-CLIP-REVOKED': 'warn',
      'LF-PACK-SIGNATURE-INVALID': 'error',
      'LF-PACK-INCOMPATIBLE-VERSION': 'error',
      'LF-PACK-MANIFEST-PARSE-ERROR': 'error',
    };
    for (const spec of PACK_FORMAT_LF_SPECS) {
      expect(spec.severity).toBe(expected[spec.code]);
    }
  });
});
