// packages/presence/src/index.ts
// @stageflip/presence — RTDB-backed cursor/selection presence per ADR-006 §D5
// and T-261. Public surface consumed by editor-shell (later tasks).

export { PRESENCE_PALETTE, type Presence, colorForUserId } from './presence.js';

export type {
  PresenceAdapter,
  PresenceSubscribeOptions,
} from './contract.js';

export { InMemoryPresenceAdapter } from './in-memory.js';

export {
  DEFAULT_STALE_TTL_MS,
  type DataSnapshotLike,
  type DatabaseLike,
  FirebaseRtdbPresenceAdapter,
  type FirebaseRtdbPresenceAdapterOptions,
  type OnDisconnectLike,
  type ReferenceLike,
} from './firebase-rtdb.js';

export {
  AWAY_AFTER_MS,
  CURSOR_DEBOUNCE_MS,
  HEARTBEAT_MS,
  IDLE_AFTER_MS,
  type LocalListener,
  PresenceClient,
  type PresenceClientOptions,
} from './client.js';
