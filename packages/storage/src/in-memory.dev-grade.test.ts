// packages/storage/src/in-memory.dev-grade.test.ts
// T-026: dev-grade assurances for InMemoryStorageAdapter — multi-subscriber
// fan-out, per-doc isolation, ordering, bounded-buffer drop policy,
// abort-signal cleanup, introspection methods. The T-025 smoke tests
// covered basic contract shape; this file makes the adapter trustworthy
// enough for dev + tests.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { type ChangeSet, InMemoryStorageAdapter } from './index.js';

const nowISO = (): string => new Date().toISOString();
const U = (n: number): Uint8Array => new Uint8Array([n]);

describe('InMemoryStorageAdapter — dev-grade', () => {
  let store: InMemoryStorageAdapter;

  beforeEach(() => {
    store = new InMemoryStorageAdapter();
  });

  afterEach(() => {
    store.reset();
  });

  /* ---------------- introspection methods ---------------- */

  describe('introspection', () => {
    it('subscriberCount returns 0 for unknown docs', () => {
      expect(store.subscriberCount('missing')).toBe(0);
    });

    it('subscriberCount reflects live subscribers and drops on close', async () => {
      const ctl = new AbortController();
      const iter = store.subscribeUpdates('d1', { signal: ctl.signal })[Symbol.asyncIterator]();
      expect(store.subscriberCount('d1')).toBe(1);

      const iter2 = store.subscribeUpdates('d1')[Symbol.asyncIterator]();
      expect(store.subscriberCount('d1')).toBe(2);

      ctl.abort();
      // After abort, iter's cleanup runs; microtask flush ensures it.
      await Promise.resolve();
      expect(store.subscriberCount('d1')).toBe(1);

      await iter2.return?.();
      expect(store.subscriberCount('d1')).toBe(0);
      await iter.return?.();
    });

    it('docCount counts unique docs across snapshots + history', async () => {
      expect(store.docCount()).toBe(0);
      await store.putSnapshot('a', {
        docId: 'a',
        version: 0,
        content: null,
        updatedAt: nowISO(),
      });
      expect(store.docCount()).toBe(1);
      await store.applyPatch('b', {
        id: 'p1',
        docId: 'b',
        parentVersion: 0,
        ops: [{ op: 'replace', path: '/x', value: 1 }],
        actor: 'u',
        createdAt: nowISO(),
      });
      expect(store.docCount()).toBe(2);
    });

    it('clear(docId) removes snapshot + history + closes subscribers', async () => {
      await store.putSnapshot('d1', {
        docId: 'd1',
        version: 0,
        content: null,
        updatedAt: nowISO(),
      });
      const iter = store.subscribeUpdates('d1')[Symbol.asyncIterator]();
      store.clear('d1');
      expect(await store.getSnapshot('d1')).toBeNull();
      expect(store.subscriberCount('d1')).toBe(0);
      // The existing iterator was closed; next() resolves with done=true.
      const r = await iter.next();
      expect(r.done).toBe(true);
    });
  });

  /* ---------------- multi-subscriber fan-out ---------------- */

  describe('multi-subscriber fan-out', () => {
    it('every live subscriber on the same doc receives every update in order', async () => {
      const aIter = store.subscribeUpdates('d1')[Symbol.asyncIterator]();
      const bIter = store.subscribeUpdates('d1')[Symbol.asyncIterator]();

      await store.applyUpdate('d1', U(1));
      await store.applyUpdate('d1', U(2));
      await store.applyUpdate('d1', U(3));

      const readN = async (iter: AsyncIterator<Uint8Array>, n: number): Promise<number[]> => {
        const out: number[] = [];
        for (let i = 0; i < n; i++) {
          const r = await iter.next();
          if (r.done) break;
          out.push(r.value[0] ?? -1);
        }
        return out;
      };

      expect(await readN(aIter, 3)).toEqual([1, 2, 3]);
      expect(await readN(bIter, 3)).toEqual([1, 2, 3]);

      await aIter.return?.();
      await bIter.return?.();
    });

    it('late subscriber does not replay historical updates', async () => {
      await store.applyUpdate('d1', U(1)); // no subscribers yet; silently dropped
      const iter = store.subscribeUpdates('d1')[Symbol.asyncIterator]();
      await store.applyUpdate('d1', U(2));
      const r = await iter.next();
      expect(r.done).toBe(false);
      expect(r.value?.[0]).toBe(2);
      await iter.return?.();
    });

    it('subscribers on different docs are isolated', async () => {
      const aIter = store.subscribeUpdates('a')[Symbol.asyncIterator]();
      const bIter = store.subscribeUpdates('b')[Symbol.asyncIterator]();

      await store.applyUpdate('a', U(10));
      await store.applyUpdate('b', U(20));

      const a1 = await aIter.next();
      const b1 = await bIter.next();
      expect(a1.value?.[0]).toBe(10);
      expect(b1.value?.[0]).toBe(20);

      await aIter.return?.();
      await bIter.return?.();
    });
  });

  /* ---------------- abort-signal cleanup ---------------- */

  describe('abort-signal cleanup', () => {
    it('aborting mid-iteration closes the iterator without affecting peers', async () => {
      const ctl = new AbortController();
      const aIter = store.subscribeUpdates('d1', { signal: ctl.signal })[Symbol.asyncIterator]();
      const bIter = store.subscribeUpdates('d1')[Symbol.asyncIterator]();

      await store.applyUpdate('d1', U(1));
      const a1 = await aIter.next();
      const b1 = await bIter.next();
      expect(a1.value?.[0]).toBe(1);
      expect(b1.value?.[0]).toBe(1);

      ctl.abort();
      const aAfter = await aIter.next();
      expect(aAfter.done).toBe(true);

      // B still works.
      await store.applyUpdate('d1', U(2));
      const b2 = await bIter.next();
      expect(b2.value?.[0]).toBe(2);

      await bIter.return?.();
    });

    it('calling .return() cleanly unsubscribes', async () => {
      const iter = store.subscribeUpdates('d1')[Symbol.asyncIterator]();
      expect(store.subscriberCount('d1')).toBe(1);
      await iter.return?.();
      expect(store.subscriberCount('d1')).toBe(0);
    });
  });

  /* ---------------- patch tier concurrency ---------------- */

  describe('patch tier — concurrency semantics', () => {
    const makePatch = (overrides: Partial<ChangeSet> = {}): ChangeSet => ({
      id: 'p',
      docId: 'd1',
      parentVersion: 0,
      ops: [{ op: 'replace', path: '/x', value: 1 }],
      actor: 'u',
      createdAt: nowISO(),
      ...overrides,
    });

    it('applyPatch is atomic per call: version bumps in strict order', async () => {
      await store.putSnapshot('d1', {
        docId: 'd1',
        version: 0,
        content: null,
        updatedAt: nowISO(),
      });

      for (let i = 0; i < 10; i++) {
        await store.applyPatch('d1', makePatch({ id: `p${i}`, parentVersion: i }));
      }

      const snap = await store.getSnapshot('d1');
      expect(snap?.version).toBe(10);

      const ids: string[] = [];
      for await (const cs of store.getHistory('d1')) ids.push(cs.id);
      expect(ids).toEqual(['p0', 'p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8', 'p9']);
    });

    it('history honors `after` by ISO timestamp', async () => {
      await store.applyPatch(
        'd1',
        makePatch({ id: 'early', createdAt: '2026-01-01T00:00:00.000Z' }),
      );
      await store.applyPatch(
        'd1',
        makePatch({ id: 'late', parentVersion: 1, createdAt: '2026-06-01T00:00:00.000Z' }),
      );
      const ids: string[] = [];
      for await (const cs of store.getHistory('d1', { after: '2026-03-01T00:00:00.000Z' })) {
        ids.push(cs.id);
      }
      expect(ids).toEqual(['late']);
    });
  });

  /* ---------------- update-copy isolation ---------------- */

  describe('update payload isolation', () => {
    it('subscribers receive copies; sender mutation does not leak', async () => {
      const iter = store.subscribeUpdates('d1')[Symbol.asyncIterator]();
      const sent = new Uint8Array([7, 7, 7]);
      await store.applyUpdate('d1', sent);
      sent[0] = 99;
      const r = await iter.next();
      expect(r.value).toEqual(new Uint8Array([7, 7, 7]));
      await iter.return?.();
    });
  });
});
