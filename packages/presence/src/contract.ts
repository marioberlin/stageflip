// packages/presence/src/contract.ts
// PresenceAdapter contract — the pluggable transport for ephemeral presence
// records, mirroring the shape of @stageflip/storage's adapter pattern but
// scoped to a single doc-keyed map of user records.
//
// Implementations:
//   - InMemoryPresenceAdapter (in-memory.ts) — dev/test fan-out
//   - FirebaseRtdbPresenceAdapter (firebase-rtdb.ts) — prod transport
//
// `registerDisconnectCleanup` is RTDB-specific in concept (it wraps
// `ref.onDisconnect().remove()`) but is part of the contract so the
// in-memory adapter can simulate it (via AbortSignal-driven cleanup) and
// future adapters (Postgres LISTEN/NOTIFY, custom sockets) can implement
// it via session-state tracking.

import type { Presence } from './presence.js';

export interface PresenceSubscribeOptions {
  signal?: AbortSignal;
}

/**
 * Pluggable transport for the presence plane. All methods are scoped by
 * `docId`; per-doc isolation is required (writes to `docA` must not surface
 * in `subscribe('docB')`).
 */
export interface PresenceAdapter {
  /** Write or refresh this user's presence record. */
  set(docId: string, userId: string, presence: Presence): Promise<void>;

  /** Remove this user's record. Used on intentional client teardown. */
  remove(docId: string, userId: string): Promise<void>;

  /**
   * Subscribe to presence changes for a doc. Each yielded map is the full
   * peer set after the change. The iterator terminates on `opts.signal`
   * abort (cleanup runs synchronously with the abort).
   */
  subscribe(docId: string, opts?: PresenceSubscribeOptions): AsyncIterable<Map<string, Presence>>;

  /**
   * Register an `onDisconnect`-style cleanup so the user's record is removed
   * on socket close. Called once per connect; idempotent within a session.
   */
  registerDisconnectCleanup(docId: string, userId: string): Promise<void>;
}
