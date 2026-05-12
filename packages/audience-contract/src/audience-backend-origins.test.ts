// packages/audience-contract/src/audience-backend-origins.test.ts
// Unit tests for the AUDIENCE_BACKEND_ORIGINS allowlist (T-484).

import { describe, expect, it } from 'vitest';

import { AUDIENCE_BACKEND_ORIGINS, isAudienceBackendOrigin } from './audience-backend-origins.js';

describe('AUDIENCE_BACKEND_ORIGINS', () => {
  it('contains 10 entries (5 vendors × 2 origins: api + app)', () => {
    expect(AUDIENCE_BACKEND_ORIGINS).toHaveLength(10);
  });

  it('includes both api and app origins for every vendor', () => {
    const vendors = ['slido', 'mentimeter', 'polleverywhere', 'vevox', 'wooclap'];
    for (const v of vendors) {
      expect(AUDIENCE_BACKEND_ORIGINS).toContain(`https://api.${v}.com`);
      expect(AUDIENCE_BACKEND_ORIGINS).toContain(`https://app.${v}.com`);
    }
  });

  it('uses https:// exclusively (no http:// scheme leakage)', () => {
    for (const origin of AUDIENCE_BACKEND_ORIGINS) {
      expect(origin.startsWith('https://')).toBe(true);
    }
  });
});

describe('isAudienceBackendOrigin', () => {
  it('returns true for known vendor origins (api + app)', () => {
    expect(isAudienceBackendOrigin('https://api.slido.com/v1/sessions')).toBe(true);
    expect(isAudienceBackendOrigin('https://app.slido.com/join/abc')).toBe(true);
    expect(isAudienceBackendOrigin('https://api.mentimeter.com/x')).toBe(true);
    expect(isAudienceBackendOrigin('https://api.polleverywhere.com')).toBe(true);
    expect(isAudienceBackendOrigin('https://api.vevox.com')).toBe(true);
    expect(isAudienceBackendOrigin('https://app.wooclap.com')).toBe(true);
  });

  it('returns false for unknown origins', () => {
    expect(isAudienceBackendOrigin('https://example.com')).toBe(false);
    expect(isAudienceBackendOrigin('https://google.com')).toBe(false);
  });

  it('returns false for known vendor over http:// (security: only https)', () => {
    expect(isAudienceBackendOrigin('http://api.slido.com')).toBe(false);
  });

  it('returns false for subdomain-attacked URLs', () => {
    expect(isAudienceBackendOrigin('https://api.slido.com.evil.example')).toBe(false);
    expect(isAudienceBackendOrigin('https://app.slido.com.attacker.tld')).toBe(false);
  });

  it('returns false for malformed URL strings', () => {
    expect(isAudienceBackendOrigin('not-a-url')).toBe(false);
    expect(isAudienceBackendOrigin('')).toBe(false);
    expect(isAudienceBackendOrigin('://invalid')).toBe(false);
  });
});
