// packages/marketplace-stripe/src/webhooks/signature.ts
// T-537 — Stripe webhook signature verification per
// https://stripe.com/docs/webhooks/signatures. The header format is
// `t=<unix-ts>,v1=<hex-hmac-sha256>[,v0=<...>]`; we verify against the
// configured webhook secret using HMAC-SHA256 over `<ts>.<payload>`.
// Multiple `v1=` values are tolerated — we accept the signature if
// ANY of them match (Stripe rotates secrets by emitting both during
// the cutover window).
//
// Determinism perimeter: outside (server-side).

import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Verify a Stripe webhook signature. Returns `true` iff:
 *   - `signatureHeader` parses into at least one `t=` and one `v1=`
 *   - HMAC-SHA256(secret, `${t}.${payload}`) matches one of the `v1=`
 *     values via a constant-time compare
 *
 * Returns `false` for malformed input, missing fields, or no match.
 * Does NOT throw — callers branch on the boolean.
 *
 * Note: Stripe additionally rejects timestamps outside a tolerance
 * window to defeat replay attacks. The library does NOT enforce a
 * tolerance — that policy decision lives in `composeWebhookHandler`
 * via the `IdempotencyStore` (Stripe also dedupes by event id, which
 * we honor). T-550 wiring MAY layer a separate timestamp check.
 */
export function verifyStripeSignature(
  payload: string,
  signatureHeader: string,
  secret: string,
): boolean {
  if (
    typeof payload !== 'string' ||
    typeof signatureHeader !== 'string' ||
    typeof secret !== 'string' ||
    signatureHeader.length === 0 ||
    secret.length === 0
  ) {
    return false;
  }
  const parsed = parseSignatureHeader(signatureHeader);
  if (parsed === null) {
    return false;
  }
  const expected = createHmac('sha256', secret).update(`${parsed.t}.${payload}`, 'utf8').digest();
  for (const candidate of parsed.v1) {
    const actual = safeHexDecode(candidate);
    if (actual === null) {
      continue;
    }
    if (actual.length !== expected.length) {
      continue;
    }
    if (timingSafeEqual(actual, expected)) {
      return true;
    }
  }
  return false;
}

interface ParsedSignature {
  readonly t: string;
  readonly v1: readonly string[];
}

function parseSignatureHeader(header: string): ParsedSignature | null {
  const parts = header.split(',');
  let t: string | null = null;
  const v1: string[] = [];
  for (const p of parts) {
    const eq = p.indexOf('=');
    if (eq <= 0) {
      continue;
    }
    const key = p.slice(0, eq).trim();
    const value = p.slice(eq + 1).trim();
    if (key === 't' && /^[0-9]+$/.test(value)) {
      t = value;
    } else if (key === 'v1' && /^[0-9a-f]+$/i.test(value)) {
      v1.push(value);
    }
  }
  if (t === null || v1.length === 0) {
    return null;
  }
  return { t, v1 };
}

function safeHexDecode(hex: string): Buffer | null {
  if (hex.length % 2 !== 0) {
    return null;
  }
  try {
    return Buffer.from(hex, 'hex');
  } catch {
    return null;
  }
}

/**
 * Test-only helper — compute a valid signature header for `payload`
 * at `timestamp` with `secret`. Not exported from the package root;
 * tests inside the package use it to drive the verifier.
 */
export function _computeSignatureForTestOnly(
  payload: string,
  timestamp: string,
  secret: string,
): string {
  const v1 = createHmac('sha256', secret).update(`${timestamp}.${payload}`, 'utf8').digest('hex');
  return `t=${timestamp},v1=${v1}`;
}
