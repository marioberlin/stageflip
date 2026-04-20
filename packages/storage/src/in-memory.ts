// packages/storage/src/in-memory.ts
// Minimal in-memory StorageAdapter. Implements all three contract methods
// end-to-end so the shape is exercised; T-026 supersedes with a fuller
// dev-grade adapter (tests + concurrency semantics).

import {
  type ChangeSet,
  type DocumentSnapshot,
  type HistoryOptions,
  type StorageAdapter,
  StorageVersionMismatchError,
  type SubscribeOptions,
} from './contract.js';

/** Simple async queue used to deliver updates to live subscribers. */
class UpdateQueue {
  private buffer: Uint8Array[] = [];
  private waiters: Array<(value: IteratorResult<Uint8Array>) => void> = [];
  private closed = false;

  push(update: Uint8Array): void {
    if (this.closed) return;
    const waiter = this.waiters.shift();
    if (waiter) waiter({ value: update, done: false });
    else this.buffer.push(update);
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
}
