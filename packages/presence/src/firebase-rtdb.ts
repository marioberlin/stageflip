// packages/presence/src/firebase-rtdb.ts
// Realtime-Database-backed PresenceAdapter. Per docs/architecture.md:336–337
// presence lives at `/presence/{docId}/{userId}` (path is fixed). The adapter
// wraps a structural slice of the firebase-admin/database API
// (`DatabaseLike` / `ReferenceLike` / `OnDisconnectLike`) so unit tests can
// pass an in-memory shim instead of a live RTDB.
//
// References (CLAUDE.md §7 — public docs only):
//   https://firebase.google.com/docs/database/admin/start
//   https://firebase.google.com/docs/database/admin/save-data#section-on-disconnect

import type { PresenceAdapter, PresenceSubscribeOptions } from './contract.js';
import type { Presence } from './presence.js';

/**
 * Subset of `firebase-admin/database`'s `OnDisconnect` we use. The real
 * `OnDisconnect.remove()` queues a server-side deletion that fires when the
 * client's socket closes (or a connection-loss watchdog times out).
 */
export interface OnDisconnectLike {
  remove(): Promise<unknown>;
}

/** Subset of `firebase-admin/database`'s `Reference` we use. */
export interface ReferenceLike {
  child(path: string): ReferenceLike;
  set(value: unknown): Promise<unknown>;
  remove(): Promise<unknown>;
  onDisconnect(): OnDisconnectLike;
  on(
    eventType: 'child_added' | 'child_changed' | 'child_removed' | 'value',
    cb: (snap: DataSnapshotLike) => void,
  ): unknown;
  off(
    eventType: 'child_added' | 'child_changed' | 'child_removed' | 'value',
    cb?: (snap: DataSnapshotLike) => void,
  ): unknown;
  once(eventType: 'value'): Promise<DataSnapshotLike>;
}

/** Subset of `firebase-admin/database`'s `DataSnapshot` we use. */
export interface DataSnapshotLike {
  key: string | null;
  val(): unknown;
}

/** Subset of `firebase-admin/database`'s `Database` we use. */
export interface DatabaseLike {
  ref(path: string): ReferenceLike;
}

/** Default stale-record cutoff (D-T261-2). Records older than this are filtered. */
export const DEFAULT_STALE_TTL_MS = 30_000;

export interface FirebaseRtdbPresenceAdapterOptions {
  database: DatabaseLike;
  /** Stale-record TTL in ms. Defaults to {@link DEFAULT_STALE_TTL_MS}. */
  staleTtlMs?: number;
  /** Wall-clock provider — overridable for deterministic tests. */
  now?: () => number;
}

const PRESENCE_ROOT = 'presence';

function presencePath(docId: string, userId: string): string {
  return `${PRESENCE_ROOT}/${docId}/${userId}`;
}

function presenceDocPath(docId: string): string {
  return `${PRESENCE_ROOT}/${docId}`;
}

/**
 * Async queue used to deliver per-doc snapshot maps to a single subscriber.
 */
class SnapshotQueue {
  private buffer: Map<string, Presence>[] = [];
  private waiters: Array<(value: IteratorResult<Map<string, Presence>>) => void> = [];
  private closed = false;

  push(snapshot: Map<string, Presence>): void {
    if (this.closed) return;
    const waiter = this.waiters.shift();
    if (waiter) {
      waiter({ value: snapshot, done: false });
      return;
    }
    this.buffer.push(snapshot);
    while (this.buffer.length > 1024) this.buffer.shift();
  }

  close(): void {
    this.closed = true;
    for (const w of this.waiters) w({ value: undefined, done: true });
    this.waiters = [];
  }

  next(): Promise<IteratorResult<Map<string, Presence>>> {
    const buffered = this.buffer.shift();
    if (buffered !== undefined) return Promise.resolve({ value: buffered, done: false });
    if (this.closed) return Promise.resolve({ value: undefined, done: true });
    return new Promise((resolve) => this.waiters.push(resolve));
  }
}

/**
 * RTDB-backed PresenceAdapter. Constructor accepts a `DatabaseLike` so unit
 * tests can pass a structural mock; production passes the real
 * `firebase-admin/database` `Database`.
 */
export class FirebaseRtdbPresenceAdapter implements PresenceAdapter {
  private readonly database: DatabaseLike;
  private readonly staleTtlMs: number;
  private readonly now: () => number;

  constructor(opts: FirebaseRtdbPresenceAdapterOptions) {
    this.database = opts.database;
    this.staleTtlMs = opts.staleTtlMs ?? DEFAULT_STALE_TTL_MS;
    this.now = opts.now ?? (() => Date.now());
  }

  async set(docId: string, userId: string, presence: Presence): Promise<void> {
    await this.database.ref(presencePath(docId, userId)).set(presence);
  }

  async remove(docId: string, userId: string): Promise<void> {
    await this.database.ref(presencePath(docId, userId)).remove();
  }

  async registerDisconnectCleanup(docId: string, userId: string): Promise<void> {
    // The killer feature of RTDB for presence: the server queues this
    // remove() and fires it when the client's socket closes. T-261 wires
    // it; verifying it actually triggers on disconnect is AC #13.
    await this.database.ref(presencePath(docId, userId)).onDisconnect().remove();
  }

  subscribe(
    docId: string,
    opts: PresenceSubscribeOptions = {},
  ): AsyncIterable<Map<string, Presence>> {
    const queue = new SnapshotQueue();
    const records = new Map<string, Presence>();
    const ref = this.database.ref(presenceDocPath(docId));

    const emit = (): void => {
      queue.push(this.filterStale(records));
    };

    const onChild = (snap: DataSnapshotLike): void => {
      if (snap.key === null) return;
      const value = snap.val();
      if (this.isPresence(value)) {
        records.set(snap.key, value);
        emit();
      }
    };
    const onChildRemoved = (snap: DataSnapshotLike): void => {
      if (snap.key === null) return;
      if (records.delete(snap.key)) emit();
    };

    // Initial bootstrap: read the current state, then attach listeners. We
    // emit one snapshot immediately so subscribers don't race the first
    // mutation.
    void ref.once('value').then((snap) => {
      const initial = snap.val();
      if (initial && typeof initial === 'object') {
        for (const [uid, raw] of Object.entries(initial as Record<string, unknown>)) {
          if (this.isPresence(raw)) records.set(uid, raw);
        }
      }
      emit();
      ref.on('child_added', onChild);
      ref.on('child_changed', onChild);
      ref.on('child_removed', onChildRemoved);
    });

    const cleanup = (): void => {
      ref.off('child_added', onChild);
      ref.off('child_changed', onChild);
      ref.off('child_removed', onChildRemoved);
      queue.close();
    };
    opts.signal?.addEventListener('abort', cleanup, { once: true });

    return {
      [Symbol.asyncIterator]: () => ({
        next: () => queue.next(),
        return: async () => {
          cleanup();
          return { value: undefined, done: true };
        },
      }),
    };
  }

  private filterStale(records: Map<string, Presence>): Map<string, Presence> {
    const cutoff = this.now() - this.staleTtlMs;
    const out = new Map<string, Presence>();
    for (const [uid, p] of records) {
      if (p.lastSeenMs >= cutoff) out.set(uid, p);
    }
    return out;
  }

  private isPresence(v: unknown): v is Presence {
    if (!v || typeof v !== 'object') return false;
    const r = v as Record<string, unknown>;
    return (
      typeof r.userId === 'string' &&
      typeof r.color === 'string' &&
      typeof r.lastSeenMs === 'number'
    );
  }
}
