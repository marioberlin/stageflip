// packages/audience-join-shared/src/room-code.ts
// T-456 — `roomCodeFor(sessionId)` deterministic 6-char room-code helper.
//
// Algorithm (per docs/tasks/T-456.md "Implementation notes"):
//   1. Compute SHA-256(utf8(sessionId)) → 32-byte digest.
//   2. Take the first 30 bits (high-order) of the digest.
//   3. Split into 6 × 5-bit groups; index each group into a 32-char
//      Crockford-style alphabet that excludes the visually-ambiguous
//      I, O, 0, 1.
//
// This module is BROWSER-SAFE: it uses `globalThis.crypto.subtle.digest`
// (Web Crypto API) — available in modern browsers and Node 19+. The
// async-only surface keeps `node:crypto` out of any client-bundle code
// path (T-304-class browser-bundle hazard avoidance).
//
// The synchronous, Node-only counterpart `roomCodeForSync` lives in
// `room-code-node.ts` and is imported only by tests and any explicit
// Node-side caller. It is NOT re-exported from the package barrel.
//
// Determinism perimeter (CLAUDE.md §3): this package is OUTSIDE the
// determinism perimeter. Standard primitives are fine.
//
// Not a security boundary — the room code is a human-friendly entry
// alias, not a session secret. The voter token minted by
// `POST /v1/audience/sessions/:id/join` is the real auth material.

/**
 * 32-character Crockford-style alphabet for the room code. Excludes
 * `I`, `O`, `0`, `1` (visually ambiguous when scanned by a human off a
 * presentation screen).
 */
export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' as const;

/** Number of characters in the encoded room code. */
export const ROOM_CODE_LENGTH = 6;

/**
 * Encode the high-order 30 bits of `digest` (a 32-byte SHA-256 buffer)
 * as 6 base-32 characters over `ROOM_CODE_ALPHABET`.
 *
 * Reads the first 4 bytes (32 bits), discards the low 2 bits to get a
 * clean 30-bit window, then splits into 6 × 5-bit indices, MSB-first.
 */
export function encodeRoomCode(digest: Uint8Array): string {
  if (digest.length < 4) {
    throw new RangeError('encodeRoomCode: digest must be at least 4 bytes');
  }
  const b0 = digest[0] ?? 0;
  const b1 = digest[1] ?? 0;
  const b2 = digest[2] ?? 0;
  const b3 = digest[3] ?? 0;
  const packed = b0 * 0x1000000 + b1 * 0x10000 + b2 * 0x100 + b3;
  const window30 = Math.floor(packed / 4); // shift right 2 → 30-bit value

  let chars = '';
  for (let i = ROOM_CODE_LENGTH - 1; i >= 0; i -= 1) {
    const shift = i * 5;
    const idx = Math.floor(window30 / 2 ** shift) & 0x1f;
    chars += ROOM_CODE_ALPHABET[idx];
  }
  if (chars.length !== ROOM_CODE_LENGTH) {
    throw new Error(`encodeRoomCode: expected ${ROOM_CODE_LENGTH} chars, got ${chars.length}`);
  }
  return chars;
}

/** Internal — non-empty-string assertion for sessionId inputs. */
export function assertSessionId(sessionId: string): void {
  if (typeof sessionId !== 'string' || sessionId.length === 0) {
    throw new Error('roomCodeFor: sessionId must be a non-empty string');
  }
}

/**
 * Encode a deterministic 6-char room code for `sessionId` using the
 * Web Crypto API. Resolves to a 6-character string drawn from
 * `ROOM_CODE_ALPHABET`. Same `sessionId` always yields the same code.
 *
 * Throws if `sessionId` is empty or if `globalThis.crypto.subtle` is
 * unavailable (callers running on legacy Node should use
 * `roomCodeForSync` from `./room-code-node.js`).
 */
export async function roomCodeFor(sessionId: string): Promise<string> {
  assertSessionId(sessionId);
  const subtle = globalThis.crypto?.subtle;
  if (subtle === undefined) {
    throw new Error(
      'roomCodeFor: globalThis.crypto.subtle is unavailable; call roomCodeForSync from a Node context.',
    );
  }
  const bytes = new TextEncoder().encode(sessionId);
  const digestBuf = await subtle.digest('SHA-256', bytes);
  return encodeRoomCode(new Uint8Array(digestBuf));
}

/**
 * Type-guard / validator: returns `true` iff `value` is a 6-character
 * string drawn entirely from `ROOM_CODE_ALPHABET`. Intended for input
 * validation on the voter landing page's "enter your code" form.
 */
export function isRoomCode(value: string): boolean {
  if (typeof value !== 'string' || value.length !== ROOM_CODE_LENGTH) return false;
  for (const ch of value) {
    if (!ROOM_CODE_ALPHABET.includes(ch)) return false;
  }
  return true;
}
