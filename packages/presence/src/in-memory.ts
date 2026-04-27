// packages/presence/src/in-memory.ts
// In-process PresenceAdapter for dev/tests. Mirrors the multi-subscriber
// fan-out + AbortSignal cleanup pattern from
// `@stageflip/storage`'s InMemoryStorageAdapter (T-025/T-026).
//
// Disconnect simulation: since there's no socket to drop in-process, we
// model "disconnect" as the abort of a subscriber's signal. When that
// abort fires, every disconnect-cleanup registered for that (docId,
// userId) pair runs and the user's record is removed. This lets unit
// tests exercise the AC #13 path without a real RTDB.

import type { PresenceAdapter, PresenceSubscribeOptions } from './contract.js';
import type { Presence } from './presence.js';

/**
 * Async queue used to deliver per-doc snapshot maps to a single subscriber.
 * Bounded buffer prevents a slow consumer from pinning unbounded memory.
 */
class SnapshotQueue {
  private buffer: Map<string, Presence>[] = [];
  private waiters: Array<(value: IteratorResult<Map<string, Presence>>) => void> = [];
  private closed = false;

  constructor(readonly maxBuffered: number = 1024) {}

  push(snapshot: Map<string, Presence>): void {
    if (this.closed) return;
    const waiter = this.waiters.shift();
    if (waiter) {
      waiter({ value: snapshot, done: false });
      return;
    }
    this.buffer.push(snapshot);
    while (this.buffer.length > this.maxBuffered) this.buffer.shift();
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

interface DisconnectHook {
  docId: string;
  userId: string;
}

/** Dev-grade in-memory PresenceAdapter. */
export class InMemoryPresenceAdapter implements PresenceAdapter {
  private records = new Map<string, Map<string, Presence>>();
  private subscribers = new Map<string, Set<SnapshotQueue>>();
  /** Disconnect cleanups keyed by docId; each AbortSignal fires the matching hooks. */
  private disconnectHooks = new Map<string, DisconnectHook[]>();

  async set(docId: string, userId: string, presence: Presence): Promise<void> {
    let users = this.records.get(docId);
    if (!users) {
      users = new Map();
      this.records.set(docId, users);
    }
    users.set(userId, presence);
    this.fanOut(docId);
  }

  async remove(docId: string, userId: string): Promise<void> {
    const users = this.records.get(docId);
    if (!users) return;
    if (!users.delete(userId)) return;
    this.fanOut(docId);
  }

  subscribe(
    docId: string,
    opts: PresenceSubscribeOptions = {},
  ): AsyncIterable<Map<string, Presence>> {
    const queue = new SnapshotQueue();
    let subs = this.subscribers.get(docId);
    if (!subs) {
      subs = new Set();
      this.subscribers.set(docId, subs);
    }
    subs.add(queue);

    // Emit current state immediately so subscribers don't have to wait for
    // the next mutation to learn who's present.
    queue.push(this.snapshotOf(docId));

    const cleanup = (): void => {
      subs?.delete(queue);
      queue.close();
      // Disconnect-on-abort: fire registered cleanups for hooks whose signal
      // matches this subscribe call. The InMemory adapter ties cleanup to
      // the subscribe loop's signal (RTDB ties it to the socket; same idea).
      const hooks = this.disconnectHooks.get(docId);
      if (hooks) {
        for (const hook of hooks) {
          // Fire-and-forget: remove() is synchronous on the in-memory map.
          void this.remove(hook.docId, hook.userId);
        }
        this.disconnectHooks.delete(docId);
      }
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

  async registerDisconnectCleanup(docId: string, userId: string): Promise<void> {
    let hooks = this.disconnectHooks.get(docId);
    if (!hooks) {
      hooks = [];
      this.disconnectHooks.set(docId, hooks);
    }
    if (!hooks.some((h) => h.userId === userId)) {
      hooks.push({ docId, userId });
    }
  }

  /** Test-only — number of active subscribers for a doc. */
  subscriberCount(docId: string): number {
    return this.subscribers.get(docId)?.size ?? 0;
  }

  /** Test-only — drop everything. */
  reset(): void {
    for (const subs of this.subscribers.values()) {
      for (const q of subs) q.close();
    }
    this.records.clear();
    this.subscribers.clear();
    this.disconnectHooks.clear();
  }

  private snapshotOf(docId: string): Map<string, Presence> {
    const users = this.records.get(docId);
    if (!users) return new Map();
    // Return a copy so subscribers cannot mutate adapter state.
    return new Map(users);
  }

  private fanOut(docId: string): void {
    const subs = this.subscribers.get(docId);
    if (!subs) return;
    const snap = this.snapshotOf(docId);
    for (const q of subs) {
      // Each subscriber gets its own copy.
      q.push(new Map(snap));
    }
  }
}
