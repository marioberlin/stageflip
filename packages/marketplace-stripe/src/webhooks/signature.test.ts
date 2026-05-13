// packages/marketplace-stripe/src/webhooks/signature.test.ts
// T-537 — Stripe HMAC-SHA256 webhook signature verification.

import { describe, expect, it } from 'vitest';

import { _computeSignatureForTestOnly, verifyStripeSignature } from './signature.js';

const SECRET = 'whsec_test_abc123';
const PAYLOAD = '{"id":"evt_1","type":"checkout.session.completed"}';
const TS = '1700000000';

describe('verifyStripeSignature', () => {
  it('accepts a valid signature', () => {
    const header = _computeSignatureForTestOnly(PAYLOAD, TS, SECRET);
    expect(verifyStripeSignature(PAYLOAD, header, SECRET)).toBe(true);
  });

  it('rejects a tampered payload', () => {
    const header = _computeSignatureForTestOnly(PAYLOAD, TS, SECRET);
    const tampered = `${PAYLOAD.slice(0, -1)}X"}`;
    expect(verifyStripeSignature(tampered, header, SECRET)).toBe(false);
  });

  it('rejects the wrong secret', () => {
    const header = _computeSignatureForTestOnly(PAYLOAD, TS, SECRET);
    expect(verifyStripeSignature(PAYLOAD, header, 'whsec_wrong')).toBe(false);
  });

  it('rejects a missing or empty header', () => {
    expect(verifyStripeSignature(PAYLOAD, '', SECRET)).toBe(false);
  });

  it('rejects a malformed header with no t= part', () => {
    const header = 'v1=deadbeef';
    expect(verifyStripeSignature(PAYLOAD, header, SECRET)).toBe(false);
  });

  it('rejects a malformed header with no v1= part', () => {
    const header = `t=${TS}`;
    expect(verifyStripeSignature(PAYLOAD, header, SECRET)).toBe(false);
  });

  it('accepts a header that carries multiple v1= candidates (one matches)', () => {
    const header = _computeSignatureForTestOnly(PAYLOAD, TS, SECRET);
    // Append a bogus v1= — verifier must still accept because the real
    // one is present.
    const multi = `${header},v1=00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff`;
    expect(verifyStripeSignature(PAYLOAD, multi, SECRET)).toBe(true);
  });

  it('rejects when secret or header is empty string', () => {
    expect(verifyStripeSignature(PAYLOAD, 't=x,v1=ab', '')).toBe(false);
  });
});
