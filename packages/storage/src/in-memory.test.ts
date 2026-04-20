// packages/storage/src/in-memory.test.ts
// Smoke tests for the in-memory adapter. T-026 owns the fuller suite
// (concurrency, ordering, backpressure); these cover each contract method's
// basic shape so T-025 has something to point at.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { type ChangeSet, InMemoryStorageAdapter, StorageVersionMismatchError } from './index.js';

const nowISO = (): string => new Date().toISOString();

describe('InMemoryStorageAdapter', () => {
  let store: InMemoryStorageAdapter;

  beforeEach(() => {
    store = new InMemoryStorageAdapter();
  });

  afterEach(() => {
    store.reset();
  });

  describe('snapshot tier', () => {
    it('returns null for an unknown doc', async () => {
      expect(await store.getSnapshot('missing')).toBeNull();
    });

    it('round-trips a snapshot', async () => {
      const snap = {
        docId: 'd1',
        version: 1,
        content: { hello: 'world' },
        updatedAt: nowISO(),
      };
      await store.putSnapshot('d1', snap);
      const got = await store.getSnapshot('d1');
      expect(got).toEqual(snap);
    });

    it('rejects a mismatched docId', async () => {
      await expect(
        store.putSnapshot('a', { docId: 'b', version: 0, content: null, updatedAt: nowISO() }),
      ).rejects.toThrow(/does not match/);
    });
  });

  describe('update tier', () => {
    it('delivers updates to live subscribers', async () => {
      const received: Uint8Array[] = [];
      const iter = store.subscribeUpdates('d1')[Symbol.asyncIterator]();

      await store.applyUpdate('d1', new Uint8Array([1, 2, 3]));
      const r1 = await iter.next();
      expect(r1.done).toBe(false);
      if (!r1.done) received.push(r1.value);

      await store.applyUpdate('d1', new Uint8Array([4, 5]));
      const r2 = await iter.next();
      if (!r2.done) received.push(r2.value);

      expect(received).toEqual([new Uint8Array([1, 2, 3]), new Uint8Array([4, 5])]);
      await iter.return?.();
    });

    it('applyUpdate with no subscribers is a no-op', async () => {
      await expect(store.applyUpdate('d1', new Uint8Array([1]))).resolves.toBeUndefined();
    });

    it('abort via AbortSignal stops the subscription', async () => {
      const ctl = new AbortController();
      const iter = store.subscribeUpdates('d1', { signal: ctl.signal })[Symbol.asyncIterator]();
      ctl.abort();
      const r = await iter.next();
      expect(r.done).toBe(true);
    });
  });

  describe('patch tier', () => {
    const makePatch = (overrides: Partial<ChangeSet> = {}): ChangeSet => ({
      id: 'p1',
      docId: 'd1',
      parentVersion: 0,
      ops: [{ op: 'replace', path: '/x', value: 1 }],
      actor: 'user_1',
      createdAt: nowISO(),
      ...overrides,
    });

    it('applies a patch from parentVersion 0 against an unseen doc (fresh)', async () => {
      await expect(store.applyPatch('d1', makePatch())).resolves.toBeUndefined();
    });

    it('throws StorageVersionMismatchError when parentVersion != current', async () => {
      await store.putSnapshot('d1', {
        docId: 'd1',
        version: 3,
        content: null,
        updatedAt: nowISO(),
      });
      await expect(store.applyPatch('d1', makePatch({ parentVersion: 2 }))).rejects.toBeInstanceOf(
        StorageVersionMismatchError,
      );
    });

    it('bumps snapshot version after a successful patch', async () => {
      await store.putSnapshot('d1', {
        docId: 'd1',
        version: 1,
        content: null,
        updatedAt: nowISO(),
      });
      await store.applyPatch('d1', makePatch({ parentVersion: 1 }));
      const after = await store.getSnapshot('d1');
      expect(after?.version).toBe(2);
    });

    it('history returns the applied ChangeSets in order', async () => {
      await store.applyPatch('d1', makePatch({ id: 'a' }));
      await store.applyPatch('d1', makePatch({ id: 'b', parentVersion: 1 }));
      const seen: ChangeSet[] = [];
      for await (const cs of store.getHistory('d1')) seen.push(cs);
      expect(seen.map((s) => s.id)).toEqual(['a', 'b']);
    });

    it('history honors limit', async () => {
      for (let i = 0; i < 5; i++) {
        await store.applyPatch('d1', makePatch({ id: `p${i}`, parentVersion: i }));
      }
      const seen: ChangeSet[] = [];
      for await (const cs of store.getHistory('d1', { limit: 2 })) seen.push(cs);
      expect(seen.map((s) => s.id)).toEqual(['p3', 'p4']);
    });
  });
});
