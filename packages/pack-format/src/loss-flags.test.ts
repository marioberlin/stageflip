// packages/pack-format/src/loss-flags.test.ts

import { describe, expect, it } from 'vitest';

import { PACK_FORMAT_LF_CODES, PACK_FORMAT_LF_SPECS } from './loss-flags.js';

describe('PACK_FORMAT_LF_CODES', () => {
  it('contains 7 codes (5 ADR-012 §D10 + 2 T-505 trial)', () => {
    expect(PACK_FORMAT_LF_CODES).toHaveLength(7);
  });

  it('matches the inventory exactly (ADR-012 §D10 + T-505)', () => {
    expect([...PACK_FORMAT_LF_CODES]).toEqual([
      'LF-LICENSE-PACK-DENIED',
      'LF-LICENSE-CLIP-REVOKED',
      'LF-PACK-SIGNATURE-INVALID',
      'LF-PACK-INCOMPATIBLE-VERSION',
      'LF-PACK-MANIFEST-PARSE-ERROR',
      'LF-LICENSE-TRIAL-ACTIVE',
      'LF-LICENSE-TRIAL-EXPIRED',
    ]);
  });

  it('includes the two T-505 trial-mode codes', () => {
    expect(PACK_FORMAT_LF_CODES).toContain('LF-LICENSE-TRIAL-ACTIVE');
    expect(PACK_FORMAT_LF_CODES).toContain('LF-LICENSE-TRIAL-EXPIRED');
  });
});

describe('PACK_FORMAT_LF_SPECS', () => {
  it('has one spec per code', () => {
    expect(PACK_FORMAT_LF_SPECS).toHaveLength(PACK_FORMAT_LF_CODES.length);
  });

  it('declares severities consistent with ADR-012 §D10 + T-505 table', () => {
    const expected: Record<string, 'info' | 'warn' | 'error'> = {
      'LF-LICENSE-PACK-DENIED': 'error',
      'LF-LICENSE-CLIP-REVOKED': 'warn',
      'LF-PACK-SIGNATURE-INVALID': 'error',
      'LF-PACK-INCOMPATIBLE-VERSION': 'error',
      'LF-PACK-MANIFEST-PARSE-ERROR': 'error',
      'LF-LICENSE-TRIAL-ACTIVE': 'warn',
      'LF-LICENSE-TRIAL-EXPIRED': 'error',
    };
    for (const spec of PACK_FORMAT_LF_SPECS) {
      expect(spec.severity).toBe(expected[spec.code]);
    }
  });

  it('marks LF-LICENSE-TRIAL-ACTIVE as warn severity', () => {
    const spec = PACK_FORMAT_LF_SPECS.find((s) => s.code === 'LF-LICENSE-TRIAL-ACTIVE');
    expect(spec?.severity).toBe('warn');
  });

  it('marks LF-LICENSE-TRIAL-EXPIRED as error severity', () => {
    const spec = PACK_FORMAT_LF_SPECS.find((s) => s.code === 'LF-LICENSE-TRIAL-EXPIRED');
    expect(spec?.severity).toBe('error');
  });
});
