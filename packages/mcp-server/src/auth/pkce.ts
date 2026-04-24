// packages/mcp-server/src/auth/pkce.ts
// T-223 — RFC 7636 PKCE helpers. Verifier is a high-entropy random
// string built from the PKCE-safe alphabet; challenge is a base64url
// SHA-256 of the verifier. Every live IdP (Google, GitHub, Okta)
// expects S256.

import { createHash, randomBytes } from 'node:crypto';

const VERIFIER_LENGTH = 64;
// PKCE-safe alphabet per RFC 7636 §4.1: ALPHA / DIGIT / "-" / "." / "_" / "~"
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';

/** Generate a random code verifier (43..128 chars per spec). */
export function generatePkceVerifier(length: number = VERIFIER_LENGTH): string {
  if (length < 43 || length > 128) {
    throw new Error(`PKCE verifier length must be 43..128 (got ${length})`);
  }
  const buffer = randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i += 1) {
    // Non-null assertion safe because `i < length === buffer.length`.
    const byte = buffer[i] as number;
    out += ALPHABET[byte % ALPHABET.length];
  }
  return out;
}

/** Derive the S256 code challenge from a verifier. */
export function derivePkceChallenge(verifier: string): string {
  return createHash('sha256')
    .update(verifier)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}
