// packages/audience-join-shared/src/room-code-node.ts
// T-456 — Node-only synchronous variant of `roomCodeFor`. Imports
// `node:crypto` directly so this file MUST NOT be referenced from any
// browser bundle (avoids the T-304-class browser-bundle hazard). The
// package barrel (`index.ts`) deliberately does not re-export from
// here — Node-side callers (tests, server routes, scripts) import the
// path explicitly.

import { createHash } from 'node:crypto';

import { assertSessionId, encodeRoomCode } from './room-code.js';

/**
 * Synchronous room-code computation backed by `node:crypto.createHash`.
 * Identical algorithm to `roomCodeFor` — produces byte-equal output for
 * the same `sessionId`. Intended for tests and explicit Node-side
 * callers (e.g. server-rendered audience-join pages, scripts).
 *
 * Throws if `sessionId` is empty.
 */
export function roomCodeForSync(sessionId: string): string {
  assertSessionId(sessionId);
  const hash = createHash('sha256').update(sessionId, 'utf8').digest();
  return encodeRoomCode(new Uint8Array(hash.buffer, hash.byteOffset, hash.byteLength));
}
