// packages/collab/src/provider.test.ts
// Provider tests — bootstrap, fan-out, debounce, origin filtering, reconnect,
// status transitions, dispose. Per T-260 ACs #9–#17.

import { type Document, documentSchema } from '@stageflip/schema';
import {
  type ChangeSet,
  type DocumentSnapshot,
  type HistoryOptions,
  InMemoryStorageAdapter,
  type StorageAdapter,
  type SubscribeOptions,
} from '@stageflip/storage';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as Y from 'yjs';
import { documentToYDoc } from './binding.js';
import { PROVIDER_ORIGIN, YjsStorageProvider } from './provider.js';

const nowISO = (): string => '2026-04-27T00:00:00.000Z';

const makeDoc = (): Document =>
  documentSchema.parse({
    meta: {
      id: 'doc-1',
      version: 0,
      createdAt: nowISO(),
      updatedAt: nowISO(),
      locale: 'en',
      schemaVersion: 1,
    },
    theme: { tokens: {} },
    variables: {},
    components: {},
    masters: [],
    layouts: [],
    content: {
      mode: 'slide',
      slides: [
        {
          id: 's1',
          elements: [],
        },
      ],
    },
  });

/**
 * Test helper — wait for a microtask + a fixed-real-time tick. Used to let
 * async operations resolve when fake timers are not in use.
 */
const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms));

describe('YjsStorageProvider — bootstrap', () => {
  let storage: InMemoryStorageAdapter;

  beforeEach(() => {
    storage = new InMemoryStorageAdapter();
  });

  it('AC#13 — bootstraps from a Uint8Array snapshot', async () => {
    const sourceDoc = new Y.Doc();
    documentToYDoc(makeDoc(), sourceDoc);
    const sourceState = Y.encodeStateAsUpdate(sourceDoc);
    await storage.putSnapshot('d1', {
      docId: 'd1',
      version: 1,
      content: sourceState,
      updatedAt: nowISO(),
    });

    const ydoc = new Y.Doc();
    const provider = new YjsStorageProvider({ ydoc, storage, docId: 'd1' });
    await tick(1);

    const root = ydoc.getMap('document');
    expect(root.get('meta')).toBeDefined();
    expect(provider.latestSnapshotVersion).toBe(1);
    provider.dispose();
  });

  it('AC#14 — bootstraps from a JSON Document snapshot via documentToYDoc', async () => {
    const doc = makeDoc();
    await storage.putSnapshot('d1', {
      docId: 'd1',
      version: 7,
      content: doc,
      updatedAt: nowISO(),
    });

    const ydoc = new Y.Doc();
    const provider = new YjsStorageProvider({ ydoc, storage, docId: 'd1' });
    await tick(1);

    const root = ydoc.getMap('document');
    const meta = root.get('meta') as { id?: string };
    expect(meta?.id).toBe('doc-1');
    expect(provider.latestSnapshotVersion).toBe(7);
    provider.dispose();
  });

  it('handles missing snapshot (no bootstrap, still subscribes)', async () => {
    const ydoc = new Y.Doc();
    const provider = new YjsStorageProvider({ ydoc, storage, docId: 'd1' });
    await tick(1);
    expect(provider.latestSnapshotVersion).toBe(0);
    provider.dispose();
  });
});

describe('YjsStorageProvider — local-update fan-out + debounce', () => {
  let storage: InMemoryStorageAdapter;

  beforeEach(() => {
    storage = new InMemoryStorageAdapter();
  });

  it('AC#10 — single transaction yields exactly one applyUpdate call', async () => {
    const ydoc = new Y.Doc();
    const applyUpdateSpy = vi.spyOn(storage, 'applyUpdate');
    const provider = new YjsStorageProvider({ ydoc, storage, docId: 'd1', debounceMs: 5 });
    await tick(1);

    ydoc.transact(() => {
      const m = ydoc.getMap('document');
      m.set('meta', { id: 'x' });
    });
    await tick(20);

    expect(applyUpdateSpy).toHaveBeenCalledTimes(1);
    provider.dispose();
  });

  it('AC#11 — rapid local updates within debounce window collapse to one call', async () => {
    vi.useFakeTimers();
    try {
      const ydoc = new Y.Doc();
      const applyUpdateSpy = vi.spyOn(storage, 'applyUpdate');
      const provider = new YjsStorageProvider({ ydoc, storage, docId: 'd1', debounceMs: 50 });

      const m = ydoc.getMap('document');
      m.set('a', 1);
      m.set('b', 2);
      m.set('c', 3);

      // Within the debounce window — no applyUpdate yet.
      vi.advanceTimersByTime(10);
      expect(applyUpdateSpy).not.toHaveBeenCalled();

      // After the window — exactly one call.
      vi.advanceTimersByTime(60);
      await vi.runAllTimersAsync();
      expect(applyUpdateSpy).toHaveBeenCalledTimes(1);
      provider.dispose();
    } finally {
      vi.useRealTimers();
    }
  });

  it('AC#12 — origin filtering prevents echo loop with two providers', async () => {
    const ydocA = new Y.Doc();
    const ydocB = new Y.Doc();
    const providerA = new YjsStorageProvider({
      ydoc: ydocA,
      storage,
      docId: 'd1',
      debounceMs: 5,
    });
    const providerB = new YjsStorageProvider({
      ydoc: ydocB,
      storage,
      docId: 'd1',
      debounceMs: 5,
    });
    const applyUpdateSpy = vi.spyOn(storage, 'applyUpdate');
    await tick(20);

    // A makes a local change. The change should fan out to B exactly once.
    ydocA.transact(() => {
      ydocA.getMap('document').set('hello', 'world');
    });
    await tick(50);

    // Total applyUpdate calls should be exactly 1: A forwarded its change.
    // If the echo-loop bug were present, B would re-apply the update, see it
    // as a local change, and forward it back — leading to >1 call (and more
    // ad infinitum).
    expect(applyUpdateSpy).toHaveBeenCalledTimes(1);
    expect(ydocB.getMap('document').get('hello')).toBe('world');

    providerA.dispose();
    providerB.dispose();
  });
});

describe('YjsStorageProvider — remote fan-in', () => {
  it('AC#9 — remote applyUpdate is delivered to subscribers', async () => {
    const storage = new InMemoryStorageAdapter();
    const ydoc = new Y.Doc();
    const provider = new YjsStorageProvider({ ydoc, storage, docId: 'd1', debounceMs: 5 });
    await tick(20);

    // Build an update from a different Y.Doc.
    const sourceDoc = new Y.Doc();
    sourceDoc.getMap('document').set('hi', 'there');
    const update = Y.encodeStateAsUpdate(sourceDoc);
    await storage.applyUpdate('d1', update);
    await tick(20);

    expect(ydoc.getMap('document').get('hi')).toBe('there');
    provider.dispose();
  });
});

describe('YjsStorageProvider — status observable (AC#16)', () => {
  it('starts in syncing, transitions to synced on first remote OR after 500 ms quiet', async () => {
    vi.useFakeTimers();
    try {
      const storage = new InMemoryStorageAdapter();
      const ydoc = new Y.Doc();
      const provider = new YjsStorageProvider({ ydoc, storage, docId: 'd1', debounceMs: 5 });

      const seen: string[] = [];
      provider.onStatus((s) => seen.push(s));

      expect(provider.status).toBe('syncing');

      // Drain microtasks (bootstrap is async).
      await vi.runAllTimersAsync();
      // After the 500ms quiet timer fires, status should be 'synced'.
      vi.advanceTimersByTime(600);
      await vi.runAllTimersAsync();
      expect(provider.status).toBe('synced');
      expect(seen).toContain('synced');
      provider.dispose();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('YjsStorageProvider — reconnect with backoff (AC#15)', () => {
  /** Wrapping adapter that fails subscribeUpdates the first N times. */
  class FaultInjectingAdapter implements StorageAdapter {
    constructor(
      private inner: InMemoryStorageAdapter,
      private failures: number,
    ) {}
    getSnapshot = (id: string) => this.inner.getSnapshot(id);
    putSnapshot = (id: string, snap: DocumentSnapshot) => this.inner.putSnapshot(id, snap);
    applyUpdate = (id: string, u: Uint8Array) => this.inner.applyUpdate(id, u);
    applyPatch = (id: string, p: ChangeSet) => this.inner.applyPatch(id, p);
    getHistory = (id: string, opts?: HistoryOptions) => this.inner.getHistory(id, opts);
    subscribeUpdates(id: string, opts?: SubscribeOptions): AsyncIterable<Uint8Array> {
      if (this.failures > 0) {
        this.failures -= 1;
        return {
          // eslint-disable-next-line @typescript-eslint/require-await
          [Symbol.asyncIterator]: () => ({
            next: () => Promise.reject(new Error('induced failure')),
          }),
        };
      }
      return this.inner.subscribeUpdates(id, opts);
    }
  }

  it('rebuilds the subscription after a fault and reaches synced', async () => {
    const inner = new InMemoryStorageAdapter();
    const wrapper = new FaultInjectingAdapter(inner, 2);
    const ydoc = new Y.Doc();
    const provider = new YjsStorageProvider({
      ydoc,
      storage: wrapper,
      docId: 'd1',
      debounceMs: 5,
      backoffBaseMs: 5,
      backoffCapMs: 50,
      random: () => 0,
    });
    // After two failures + reconnects, the loop should hand off to inner
    // adapter cleanly. Drive remote update through to flip to `synced`.
    // Wait long enough for both backoffs to elapse: 5ms + 10ms + scheduling.
    await tick(80);

    const sourceDoc = new Y.Doc();
    sourceDoc.getMap('document').set('hi', 'there');
    await inner.applyUpdate('d1', Y.encodeStateAsUpdate(sourceDoc));
    await tick(40);

    expect(ydoc.getMap('document').get('hi')).toBe('there');
    expect(provider.status).toBe('synced');
    provider.dispose();
  });
});

describe('YjsStorageProvider — dispose (AC#17)', () => {
  it('removes the local-update observer; idempotent', async () => {
    const storage = new InMemoryStorageAdapter();
    const ydoc = new Y.Doc();
    const provider = new YjsStorageProvider({ ydoc, storage, docId: 'd1', debounceMs: 5 });
    await tick(20);

    const applyUpdateSpy = vi.spyOn(storage, 'applyUpdate');
    provider.dispose();
    // Calling dispose twice is a no-op.
    provider.dispose();

    // Local mutations after dispose must not forward.
    ydoc.getMap('document').set('after', true);
    await tick(40);
    expect(applyUpdateSpy).not.toHaveBeenCalled();
  });

  it('aborts the subscribe loop', async () => {
    const storage = new InMemoryStorageAdapter();
    const ydoc = new Y.Doc();
    const provider = new YjsStorageProvider({ ydoc, storage, docId: 'd1', debounceMs: 5 });
    await tick(10);
    expect(storage.subscriberCount('d1')).toBe(1);
    provider.dispose();
    // After dispose, the subscriber should be gone.
    await tick(10);
    expect(storage.subscriberCount('d1')).toBe(0);
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

// Suppress unused import warning — `it` uses PROVIDER_ORIGIN indirectly via
// provider.applySnapshotContent's transact origin; no direct test needed.
void PROVIDER_ORIGIN;
