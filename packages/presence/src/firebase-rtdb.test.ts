// packages/presence/src/firebase-rtdb.test.ts
// AC #10–#14: RTDB-backed PresenceAdapter behaviour.
// Strategy (documented per AC #10): we use a structural mock implementing
// `DatabaseLike` / `ReferenceLike` / `OnDisconnectLike`. This mirrors the
// `BucketLike` recording-mock pattern used by
// `@stageflip/storage-firebase`'s asset-storage tests — no Firebase runtime
// involvement, fully deterministic, and the real `firebase-admin/database`
// `Database` structurally satisfies the same shape.

import { describe, expect, it } from 'vitest';
import type {
  DataSnapshotLike,
  DatabaseLike,
  OnDisconnectLike,
  ReferenceLike,
} from './firebase-rtdb.js';
import { FirebaseRtdbPresenceAdapter } from './firebase-rtdb.js';
import type { Presence } from './presence.js';

type Listener = (snap: DataSnapshotLike) => void;

interface MockNode {
  value: unknown;
  // Listeners attached at this node.
  listeners: Map<string, Set<Listener>>;
  /** Pending onDisconnect callback — fired by helper. */
  onDisconnectRemove?: () => void;
}

interface MockDatabase extends DatabaseLike {
  /** Test helper: simulate the socket dropping for a given path. */
  __triggerDisconnect(path: string): void;
  /** Test helper: get a node's current value. */
  __peek(path: string): unknown;
}

function createMockDatabase(): MockDatabase {
  const nodes = new Map<string, MockNode>();

  const getNode = (path: string): MockNode => {
    let n = nodes.get(path);
    if (!n) {
      n = { value: null, listeners: new Map() };
      nodes.set(path, n);
    }
    return n;
  };

  const fireParentChild = (
    childPath: string,
    type: 'child_added' | 'child_changed' | 'child_removed',
    value: unknown,
  ): void => {
    const slash = childPath.lastIndexOf('/');
    if (slash < 0) return;
    const parentPath = childPath.slice(0, slash);
    const key = childPath.slice(slash + 1);
    const parent = nodes.get(parentPath);
    if (!parent) return;
    const ls = parent.listeners.get(type);
    if (!ls) return;
    const snap: DataSnapshotLike = { key, val: () => value };
    for (const cb of ls) cb(snap);
  };

  const buildRef = (path: string): ReferenceLike => ({
    child(sub) {
      return buildRef(`${path}/${sub}`);
    },
    async set(value) {
      const node = getNode(path);
      const had = node.value !== null && node.value !== undefined;
      node.value = value;
      // Also reflect into "value" listeners on this node.
      const valLs = node.listeners.get('value');
      if (valLs) {
        for (const cb of valLs) cb({ key: path.split('/').pop() ?? null, val: () => value });
      }
      // Fire as child_added or child_changed on the parent.
      fireParentChild(path, had ? 'child_changed' : 'child_added', value);
    },
    async remove() {
      const node = getNode(path);
      if (node.value === null || node.value === undefined) return;
      node.value = null;
      fireParentChild(path, 'child_removed', null);
    },
    onDisconnect(): OnDisconnectLike {
      return {
        async remove() {
          const node = getNode(path);
          node.onDisconnectRemove = () => {
            if (node.value !== null && node.value !== undefined) {
              node.value = null;
              fireParentChild(path, 'child_removed', null);
            }
          };
        },
      };
    },
    on(eventType, cb) {
      const node = getNode(path);
      let set = node.listeners.get(eventType);
      if (!set) {
        set = new Set();
        node.listeners.set(eventType, set);
      }
      set.add(cb);
      // Replay existing children for child_added per RTDB semantics.
      if (eventType === 'child_added') {
        for (const [otherPath, other] of nodes) {
          if (
            otherPath.startsWith(`${path}/`) &&
            other.value !== null &&
            other.value !== undefined
          ) {
            const rest = otherPath.slice(path.length + 1);
            if (!rest.includes('/')) {
              cb({ key: rest, val: () => other.value });
            }
          }
        }
      }
      return undefined;
    },
    off(eventType, cb) {
      const node = nodes.get(path);
      if (!node) return undefined;
      const set = node.listeners.get(eventType);
      if (!set) return undefined;
      if (cb) set.delete(cb);
      else set.clear();
      return undefined;
    },
    async once(_eventType) {
      const node = getNode(path);
      // For doc-level once('value'), aggregate all immediate-children values.
      const aggregated: Record<string, unknown> = {};
      for (const [otherPath, other] of nodes) {
        if (otherPath.startsWith(`${path}/`) && other.value !== null && other.value !== undefined) {
          const rest = otherPath.slice(path.length + 1);
          if (!rest.includes('/')) aggregated[rest] = other.value;
        }
      }
      const value = Object.keys(aggregated).length === 0 ? node.value : aggregated;
      return { key: path.split('/').pop() ?? null, val: () => value };
    },
  });

  return {
    ref(path) {
      // strip leading slash if any
      return buildRef(path.startsWith('/') ? path.slice(1) : path);
    },
    __triggerDisconnect(path) {
      const node = nodes.get(path.startsWith('/') ? path.slice(1) : path);
      if (!node) return;
      node.onDisconnectRemove?.();
    },
    __peek(path) {
      const node = nodes.get(path.startsWith('/') ? path.slice(1) : path);
      return node?.value ?? null;
    },
  };
}

function makePresence(userId: string, lastSeenMs: number): Presence {
  return {
    userId,
    color: '#3b82f6',
    lastSeenMs,
    cursor: { slideId: 's1', x: 1, y: 2 },
  };
}

async function nextSnap(
  iter: AsyncIterator<Map<string, Presence>>,
): Promise<Map<string, Presence>> {
  const r = await iter.next();
  if (r.done) throw new Error('iterator exhausted');
  return r.value;
}

describe('FirebaseRtdbPresenceAdapter', () => {
  // AC #10
  it('constructor accepts a Database instance (structural)', () => {
    const db = createMockDatabase();
    const adapter = new FirebaseRtdbPresenceAdapter({ database: db });
    expect(adapter).toBeInstanceOf(FirebaseRtdbPresenceAdapter);
  });

  // AC #11
  it('set writes to /presence/{docId}/{userId}', async () => {
    const db = createMockDatabase();
    const adapter = new FirebaseRtdbPresenceAdapter({ database: db });
    const p = makePresence('alice', 1_700_000_000_000);
    await adapter.set('doc-1', 'alice', p);

    expect(db.__peek('presence/doc-1/alice')).toEqual(p);
  });

  // AC #12
  it('subscribe yields the full peer map after each change', async () => {
    const db = createMockDatabase();
    const now = 1_700_000_000_000;
    const adapter = new FirebaseRtdbPresenceAdapter({ database: db, now: () => now });

    const ac = new AbortController();
    const iter = adapter.subscribe('doc-1', { signal: ac.signal })[Symbol.asyncIterator]();

    // initial empty snapshot
    const s0 = await nextSnap(iter);
    expect(s0.size).toBe(0);

    await adapter.set('doc-1', 'alice', makePresence('alice', now));
    const s1 = await nextSnap(iter);
    expect(s1.has('alice')).toBe(true);

    await adapter.set('doc-1', 'bob', makePresence('bob', now));
    const s2 = await nextSnap(iter);
    expect(s2.size).toBe(2);
    expect(s2.has('alice')).toBe(true);
    expect(s2.has('bob')).toBe(true);

    await adapter.remove('doc-1', 'alice');
    const s3 = await nextSnap(iter);
    expect(s3.size).toBe(1);
    expect(s3.has('alice')).toBe(false);

    ac.abort();
  });

  // AC #13 — actually triggers on simulated socket-close, not on intentional dispose.
  it('registerDisconnectCleanup removes the path on socket disconnect', async () => {
    const db = createMockDatabase();
    const adapter = new FirebaseRtdbPresenceAdapter({ database: db });
    await adapter.set('doc-1', 'alice', makePresence('alice', 1_700_000_000_000));
    await adapter.registerDisconnectCleanup('doc-1', 'alice');

    expect(db.__peek('presence/doc-1/alice')).not.toBeNull();

    // Simulate the socket dropping — the queued onDisconnect runs.
    db.__triggerDisconnect('presence/doc-1/alice');

    expect(db.__peek('presence/doc-1/alice')).toBeNull();
  });

  // AC #14 — stale records (lastSeenMs older than 30s) are filtered from yielded maps.
  it('subscribe filters records where Date.now() - lastSeenMs > 30_000', async () => {
    const db = createMockDatabase();
    const now = 1_700_000_000_000;
    const adapter = new FirebaseRtdbPresenceAdapter({ database: db, now: () => now });

    // alice fresh, ghost stale (older than 30s).
    await adapter.set('doc-1', 'alice', makePresence('alice', now));
    await adapter.set('doc-1', 'ghost', makePresence('ghost', now - 31_000));

    const ac = new AbortController();
    const iter = adapter.subscribe('doc-1', { signal: ac.signal })[Symbol.asyncIterator]();
    const snap = await nextSnap(iter);
    expect(snap.has('alice')).toBe(true);
    expect(snap.has('ghost')).toBe(false);
    ac.abort();
  });

  it('subscribe abort tears down listeners', async () => {
    const db = createMockDatabase();
    const adapter = new FirebaseRtdbPresenceAdapter({ database: db });
    const ac = new AbortController();
    const iter = adapter.subscribe('doc-1', { signal: ac.signal })[Symbol.asyncIterator]();
    await nextSnap(iter);
    ac.abort();
    const r = await iter.next();
    expect(r.done).toBe(true);
  });

  it('rejects malformed records (defensive against rogue writes)', async () => {
    const db = createMockDatabase();
    const adapter = new FirebaseRtdbPresenceAdapter({ database: db });

    // Hand-write a malformed record bypassing the adapter.
    await db.ref('presence/doc-1/junk').set({ not: 'a presence' });

    const ac = new AbortController();
    const iter = adapter.subscribe('doc-1', { signal: ac.signal })[Symbol.asyncIterator]();
    const snap = await nextSnap(iter);
    expect(snap.has('junk')).toBe(false);
    ac.abort();
  });

  it('iterator return() runs cleanup', async () => {
    const db = createMockDatabase();
    const adapter = new FirebaseRtdbPresenceAdapter({ database: db });
    const it = adapter.subscribe('doc-1')[Symbol.asyncIterator]();
    await it.next();
    const r = await (it.return?.() ?? Promise.resolve({ value: undefined, done: true }));
    expect(r.done).toBe(true);
  });
});
