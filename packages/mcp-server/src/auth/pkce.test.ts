// packages/mcp-server/src/auth/pkce.test.ts
// T-223 — PKCE helper coverage. RFC 7636 defines a narrow shape and
// every live IdP (Google, GitHub, Okta) will validate our challenge,
// so testing the derivation end-to-end keeps us in spec.

import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import { derivePkceChallenge, generatePkceVerifier } from './pkce.js';

describe('generatePkceVerifier', () => {
  it('produces a string of 43+ chars using the PKCE-safe alphabet', () => {
    const v = generatePkceVerifier();
    expect(v.length).toBeGreaterThanOrEqual(43);
    expect(v.length).toBeLessThanOrEqual(128);
    expect(v).toMatch(/^[A-Za-z0-9\-._~]+$/);
  });

  it('returns a different verifier on successive calls', () => {
    const a = generatePkceVerifier();
    const b = generatePkceVerifier();
    expect(a).not.toBe(b);
  });
});

describe('derivePkceChallenge', () => {
  it('S256-derives the challenge exactly as RFC 7636 specifies', () => {
    const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
    // RFC 7636 §4.6 sample:
    const expected = 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM';
    expect(derivePkceChallenge(verifier)).toBe(expected);
  });

  it('uses base64url (no padding, no + /) output', () => {
    const verifier = generatePkceVerifier();
    const challenge = derivePkceChallenge(verifier);
    expect(challenge).toMatch(/^[A-Za-z0-9\-_]+$/);
    expect(challenge).not.toContain('=');
  });

  it('matches a fresh SHA-256 round-trip of the verifier', () => {
    const verifier = generatePkceVerifier();
    const ref = createHash('sha256')
      .update(verifier)
      .digest('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
    expect(derivePkceChallenge(verifier)).toBe(ref);
  });
});
