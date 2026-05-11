// packages/audience-contract/src/loss-flags.test.ts
// LF-AUDIENCE-* inventory tests — exactly eight codes; every spec matches
// the ADR-009 §D11 table verbatim.

import { describe, expect, it } from 'vitest';

import { LF_AUDIENCE_CODES, LF_AUDIENCE_SPECS, type LossFlagAudienceCode } from './loss-flags.js';

describe('LF_AUDIENCE_CODES', () => {
  it('has exactly eight entries per ADR-009 §D11', () => {
    expect(LF_AUDIENCE_CODES).toHaveLength(8);
    expect(new Set(LF_AUDIENCE_CODES).size).toBe(8);
  });

  it('matches the ADR-009 §D11 table verbatim', () => {
    expect(LF_AUDIENCE_CODES).toEqual([
      'LF-AUDIENCE-TENANT-RATE-LIMITED',
      'LF-AUDIENCE-VOTER-RATE-LIMITED',
      'LF-AUDIENCE-SESSION-CLOSED',
      'LF-AUDIENCE-CONNECTION-LOST',
      'LF-AUDIENCE-ADAPTER-UNAVAILABLE',
      'LF-AUDIENCE-VENDOR-API-FAILURE',
      'LF-AUDIENCE-SNAPSHOT-MISSING',
      'LF-AUDIENCE-CAPACITY-CAP',
    ]);
  });

  it('every code starts with LF-AUDIENCE-', () => {
    for (const code of LF_AUDIENCE_CODES) {
      expect(code).toMatch(/^LF-AUDIENCE-/);
    }
  });
});

describe('LF_AUDIENCE_SPECS', () => {
  it('has exactly eight specs', () => {
    expect(LF_AUDIENCE_SPECS).toHaveLength(8);
  });

  it('every spec carries category="other" per ADR-009 §D11', () => {
    for (const spec of LF_AUDIENCE_SPECS) {
      expect(spec.category).toBe('other');
    }
  });

  it('spec.code values match LF_AUDIENCE_CODES order', () => {
    const codes = LF_AUDIENCE_SPECS.map((s) => s.code);
    expect(codes).toEqual([...LF_AUDIENCE_CODES]);
  });

  it('severity inventory matches ADR-009 §D11 table', () => {
    const severityByCode = Object.fromEntries(LF_AUDIENCE_SPECS.map((s) => [s.code, s.severity]));
    expect(severityByCode).toEqual({
      'LF-AUDIENCE-TENANT-RATE-LIMITED': 'warn',
      'LF-AUDIENCE-VOTER-RATE-LIMITED': 'info',
      'LF-AUDIENCE-SESSION-CLOSED': 'info',
      'LF-AUDIENCE-CONNECTION-LOST': 'error',
      'LF-AUDIENCE-ADAPTER-UNAVAILABLE': 'error',
      'LF-AUDIENCE-VENDOR-API-FAILURE': 'warn',
      'LF-AUDIENCE-SNAPSHOT-MISSING': 'warn',
      'LF-AUDIENCE-CAPACITY-CAP': 'warn',
    });
  });

  it('every spec carries a non-empty description', () => {
    for (const spec of LF_AUDIENCE_SPECS) {
      expect(spec.description.length).toBeGreaterThan(0);
    }
  });
});

describe('LossFlagAudienceCode type', () => {
  it('admits every code from the sealed array', () => {
    const codes: readonly LossFlagAudienceCode[] = LF_AUDIENCE_CODES;
    expect(codes).toHaveLength(8);
  });
});
