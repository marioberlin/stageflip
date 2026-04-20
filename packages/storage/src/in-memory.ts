// packages/storage/src/in-memory.ts
// Dev-grade in-memory StorageAdapter. Implements all three contract methods
// with tested concurrency semantics: multi-subscriber fan-out, per-doc
// isolation, bounded buffer with drop-oldest policy, abort-signal cleanup.
// Minimum-viable version shipped in T-025; dev-grade assurances added in
// T-026 (see packages/storage/src/in-memory.dev-grade.test.ts).

import {
  type ChangeSet,
  type DocumentSnapshot,
  type HistoryOptions,
  type StorageAdapter,
  StorageVersionMismatchError,
  type SubscribeOptions,
} from './contract.js';

/**
 * Async queue used to deliver updates to a single subscriber. Bounded buffer
 * prevents a slow consumer from pinning unbounded memory; on overflow the
 * oldest queued update is dropped and a drop counter is surfaced via
 * `droppedCount()` so tests can assert backpressure behaviour.
 */
class UpdateQueue {
  private buffer: Uint8Array[] = [];
  private waiters: Array<(value: IteratorResult<Uint8Array>) => void> = [];
  private closed = false;
  private dropped = 0;

  constructor(readonly maxBuffered: number = 1024) {}

  push(update: Uint8Array): void {
    if (this.closed) return;
    const waiter = this.waiters.shift();
    if (waiter) {
      waiter({ value: update, done: false });
      return;
    }
    this.buffer.push(update);
    while (this.buffer.length > this.maxBuffered) {
      this.buffer.shift();
      this.dropped += 1;
    }
  }

  close(): void {
    this.closed = true;
    for (const w of this.waiters) w({ value: undefined, done: true });
    this.waiters = [];
  }

  next(): Promise<IteratorResult<Uint8Array>> {
    const buffered = this.buffer.shift();
    if (buffered !== undefined) return Promise.resolve({ value: buffered, done: false });
    if (this.closed) return Promise.resolve({ value: undefined, done: true });
    return new Promise((resolve) => this.waiters.push(resolve));
  }

  /** Total updates dropped by the overflow policy. Exposed for tests. */
  droppedCount(): number {
    return this.dropped;
  }

  /** Whether the queue has been closed via `close()`. */
  isClosed(): boolean {
    return this.closed;
  }
}

/**
 * In-memory StorageAdapter. Not thread-safe in the Node worker-thread sense;
 * fine for a single-process runtime.
 */
export class InMemoryStorageAdapter implements StorageAdapter {
  private snapshots = new Map<string, DocumentSnapshot>();
  private history = new Map<string, ChangeSet[]>();
  private subscribers = new Map<string, Set<UpdateQueue>>();

  async getSnapshot(docId: string): Promise<DocumentSnapshot | null> {
    return this.snapshots.get(docId) ?? null;
  }

  async putSnapshot(docId: string, snapshot: DocumentSnapshot): Promise<void> {
    if (snapshot.docId !== docId) {
      throw new Error(`snapshot.docId "${snapshot.docId}" does not match docId "${docId}"`);
    }
    this.snapshots.set(docId, snapshot);
  }

  async applyUpdate(docId: string, update: Uint8Array): Promise<void> {
    const subs = this.subscribers.get(docId);
    if (!subs) return;
    // Copy to avoid the subscriber mutating the sender's buffer.
    const copy = new Uint8Array(update);
    for (const q of subs) q.push(copy);
  }

  subscribeUpdates(docId: string, opts: SubscribeOptions = {}): AsyncIterable<Uint8Array> {
    const queue = new UpdateQueue();
    let subs = this.subscribers.get(docId);
    if (!subs) {
      subs = new Set();
      this.subscribers.set(docId, subs);
    }
    subs.add(queue);

    const cleanup = (): void => {
      subs?.delete(queue);
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

  async applyPatch(docId: string, patch: ChangeSet): Promise<void> {
    if (patch.docId !== docId) {
      throw new Error(`patch.docId "${patch.docId}" does not match docId "${docId}"`);
    }
    const snapshot = this.snapshots.get(docId);
    const log = this.history.get(docId) ?? [];
    // Version is snapshot.version if a snapshot exists; otherwise it tracks
    // the applied-patch count. This lets adapters run patch-only without an
    // explicit putSnapshot call (useful in tests and in fresh-doc flows).
    const actualVersion = snapshot?.version ?? log.length;
    if (patch.parentVersion !== actualVersion) {
      throw new StorageVersionMismatchError(docId, patch.parentVersion, actualVersion);
    }
    log.push(patch);
    this.history.set(docId, log);
    // Content application (applying JSON-Patch ops to snapshot.content) is
    // deferred to a higher layer; this adapter only tracks versions + history.
    if (snapshot) {
      this.snapshots.set(docId, { ...snapshot, version: snapshot.version + 1 });
    }
  }

  async *getHistory(docId: string, opts: HistoryOptions = {}): AsyncIterable<ChangeSet> {
    const log = this.history.get(docId) ?? [];
    let filtered: ChangeSet[] = opts.after
      ? log.filter((c) => c.createdAt > (opts.after as string))
      : log.slice();
    if (opts.limit !== undefined) filtered = filtered.slice(-opts.limit);
    for (const entry of filtered) yield entry;
  }

  /** Test-only hook to reset all state. */
  reset(): void {
    for (const [, subs] of this.subscribers) for (const q of subs) q.close();
    this.snapshots.clear();
    this.history.clear();
    this.subscribers.clear();
  }

  /** Number of live subscribers for a docId. 0 when unknown. */
  subscriberCount(docId: string): number {
    return this.subscribers.get(docId)?.size ?? 0;
  }

  /** Number of docs the adapter knows about (either snapshot or history present). */
  docCount(): number {
    const ids = new Set<string>();
    for (const k of this.snapshots.keys()) ids.add(k);
    for (const k of this.history.keys()) ids.add(k);
    return ids.size;
  }

  /** Drop all state for one document. Live subscribers on that doc are closed. */
  clear(docId: string): void {
    const subs = this.subscribers.get(docId);
    if (subs) {
      for (const q of subs) q.close();
      this.subscribers.delete(docId);
    }
    this.snapshots.delete(docId);
    this.history.delete(docId);
  }
}
