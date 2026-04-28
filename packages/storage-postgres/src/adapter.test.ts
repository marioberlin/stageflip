// packages/storage-postgres/src/adapter.test.ts
// Unit tests for `PostgresStorageAdapter` against pg-mem. Real PG-only
// behaviour (LISTEN/NOTIFY across connections, FOR UPDATE blocking
// concurrent transactions) lives in adapter.integration.test.ts.
//
// AC mapping anchored in test names. Mirrors the structure of
// packages/storage/src/in-memory.test.ts so the contract conformance is
// easy to read (AC #18).

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { newDb } from 'pg-mem';

import {
  type ChangeSet,
  type DocumentSnapshot,
  StorageVersionMismatchError,
} from '@stageflip/storage';

import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  type AdapterPool,
  type AdapterPoolClient,
  PostgresStorageAdapter,
  channelForDoc,
} from './adapter.js';
import type { ListenPool, ListenPoolClient, PgNotification } from './listen-connection.js';
import { type Migration, runMigrations } from './migration-runner.js';

const here = dirname(fileURLToPath(import.meta.url));
const INIT_SQL_PATH = join(here, 'migrations', '0001_init.sql');

const nowISO = (): string => new Date().toISOString();

interface PgMemAdapter {
  Pool: new () => unknown;
}

async function freshPool(): Promise<AdapterPool> {
  const db = newDb();
  const adapter = db.adapters.createPg() as PgMemAdapter;
  const pool = new adapter.Pool();
  const sql = await readFile(INIT_SQL_PATH, 'utf8');
  const init: Migration = { name: '0001_init.sql', sql };
  await runMigrations(pool as unknown as Parameters<typeof runMigrations>[0], [init]);
  return pool as unknown as AdapterPool;
}

/** A fake LISTEN pool — used because pg-mem's LISTEN/NOTIFY does not deliver
 * notifications across connections. We assert the wire protocol against this
 * fake; real-PG semantics are pinned in the integration suite. */
class FakeListenClient implements ListenPoolClient {
  private listeners: Array<(msg: PgNotification) => void> = [];
  released = false;
  async query(_text: string): Promise<unknown> {
    return { rows: [] };
  }
  on(_event: 'notification', cb: (msg: PgNotification) => void): void {
    this.listeners.push(cb);
  }
  off(_event: 'notification', cb: (msg: PgNotification) => void): void {
    this.listeners = this.listeners.filter((l) => l !== cb);
  }
  release(): void {
    this.released = true;
  }
  emit(channel: string, payload?: string): void {
    for (const l of this.listeners) l({ channel, payload });
  }
}
class FakeListenPool implements ListenPool {
  clients: FakeListenClient[] = [];
  async connect(): Promise<FakeListenClient> {
    const c = new FakeListenClient();
    this.clients.push(c);
    return c;
  }
}

describe('channelForDoc', () => {
  it('produces an updates_-prefixed channel for safe doc ids', () => {
    expect(channelForDoc('doc_abc')).toBe('updates_doc_abc');
    expect(channelForDoc('doc-1')).toBe('updates_doc_1');
  });
  it('rejects unsafe doc ids', () => {
    expect(() => channelForDoc("evil';DROP")).toThrow(/must match/);
    expect(() => channelForDoc('a/b')).toThrow(/must match/);
  });
  it('rejects oversized channel names', () => {
    expect(() => channelForDoc('x'.repeat(60))).toThrow(/too long/);
  });
});

describe('PostgresStorageAdapter (pg-mem)', () => {
  let pool: AdapterPool;
  let store: PostgresStorageAdapter;

  beforeEach(async () => {
    pool = await freshPool();
    store = new PostgresStorageAdapter({
      pool,
      defaultOrgId: 'org_test',
    });
  });

  afterEach(async () => {
    const closer = (pool as { end?: () => Promise<void> }).end;
    if (closer) await closer.call(pool);
  });

  /* ---------------- snapshot tier — AC #1, #2, #3, #4 ---------------- */

  describe('snapshot tier', () => {
    it('returns null for an unknown doc (AC #1)', async () => {
      expect(await store.getSnapshot('missing')).toBeNull();
    });

    it('round-trips a snapshot via putSnapshot/getSnapshot (AC #2)', async () => {
      const snap: DocumentSnapshot = {
        docId: 'd1',
        version: 1,
        content: { hello: 'world', nested: { n: 7 } },
        updatedAt: nowISO(),
      };
      await store.putSnapshot('d1', snap);
      const got = await store.getSnapshot('d1');
      expect(got?.docId).toBe('d1');
      expect(got?.version).toBe(1);
      expect(got?.content).toEqual({ hello: 'world', nested: { n: 7 } });
    });

    it('rejects a mismatched docId in the snapshot body', async () => {
      await expect(
        store.putSnapshot('a', {
          docId: 'b',
          version: 0,
          content: null,
          updatedAt: nowISO(),
        }),
      ).rejects.toThrow(/does not match/);
    });

    it('updates documents.current_version on each put (AC #2)', async () => {
      await store.putSnapshot('d1', {
        docId: 'd1',
        version: 1,
        content: { v: 1 },
        updatedAt: nowISO(),
      });
      await store.putSnapshot('d1', {
        docId: 'd1',
        version: 2,
        content: { v: 2 },
        updatedAt: nowISO(),
      });
      const got = await store.getSnapshot('d1');
      expect(got?.version).toBe(2);
      expect(got?.content).toEqual({ v: 2 });
    });

    it('rejects two putSnapshot calls at the same version (AC #3)', async () => {
      const snap: DocumentSnapshot = {
        docId: 'd1',
        version: 1,
        content: { x: 1 },
        updatedAt: nowISO(),
      };
      await store.putSnapshot('d1', snap);
      await expect(store.putSnapshot('d1', snap)).rejects.toThrow();
    });

    it('JSONB content round-trip preserves structure (AC #4)', async () => {
      const content = {
        s: 'a string',
        n: 42,
        b: true,
        arr: [1, 'two', { three: 3 }],
        nul: null,
      };
      await store.putSnapshot('d1', {
        docId: 'd1',
        version: 0,
        content,
        updatedAt: nowISO(),
      });
      const got = await store.getSnapshot('d1');
      expect(got?.content).toEqual(content);
    });
  });

  /* --------- patch tier — AC #10, #11, #12 (plus version mismatch) -------- */

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

    it('applies a patch from parentVersion 0 against a fresh doc (AC #10)', async () => {
      await expect(store.applyPatch('d1', makePatch())).resolves.toBeUndefined();
    });

    it('rejects a mismatched docId in the patch body', async () => {
      await expect(store.applyPatch('a', makePatch({ docId: 'b' }))).rejects.toThrow(
        /does not match/,
      );
    });

    it('throws StorageVersionMismatchError on stale parentVersion (AC #11)', async () => {
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

    it('bumps documents.current_version after a successful patch', async () => {
      await store.putSnapshot('d1', {
        docId: 'd1',
        version: 1,
        content: null,
        updatedAt: nowISO(),
      });
      await store.applyPatch('d1', makePatch({ id: 'p1', parentVersion: 1 }));
      // Read current_version directly via a fresh client.
      const client = await pool.connect();
      try {
        const r = await client.query<{ current_version: string | number }>(
          'SELECT current_version FROM documents WHERE id = $1',
          ['d1'],
        );
        expect(Number(r.rows[0]?.current_version)).toBe(2);
      } finally {
        client.release();
      }
    });

    it('serial applyPatch calls advance the version monotonically', async () => {
      for (let i = 0; i < 5; i++) {
        await store.applyPatch('d1', makePatch({ id: `p${i}`, parentVersion: i }));
      }
      const client = await pool.connect();
      try {
        const r = await client.query<{ current_version: string | number }>(
          'SELECT current_version FROM documents WHERE id = $1',
          ['d1'],
        );
        expect(Number(r.rows[0]?.current_version)).toBe(5);
      } finally {
        client.release();
      }
    });

    it('getHistory returns changesets in chronological order (AC #12)', async () => {
      await store.applyPatch(
        'd1',
        makePatch({ id: 'a', parentVersion: 0, createdAt: '2026-01-01T00:00:00.000Z' }),
      );
      await store.applyPatch(
        'd1',
        makePatch({ id: 'b', parentVersion: 1, createdAt: '2026-02-01T00:00:00.000Z' }),
      );
      const seen: ChangeSet[] = [];
      for await (const cs of store.getHistory('d1')) seen.push(cs);
      expect(seen.map((s) => s.id)).toEqual(['a', 'b']);
    });

    it('getHistory honors limit (AC #12)', async () => {
      for (let i = 0; i < 5; i++) {
        await store.applyPatch(
          'd1',
          makePatch({
            id: `p${i}`,
            parentVersion: i,
            createdAt: new Date(Date.UTC(2026, 0, 1 + i)).toISOString(),
          }),
        );
      }
      const seen: ChangeSet[] = [];
      for await (const cs of store.getHistory('d1', { limit: 2 })) seen.push(cs);
      expect(seen.map((s) => s.id)).toEqual(['p3', 'p4']);
    });

    it('getHistory honors after by ISO timestamp (AC #12)', async () => {
      await store.applyPatch(
        'd1',
        makePatch({ id: 'early', createdAt: '2026-01-01T00:00:00.000Z' }),
      );
      await store.applyPatch(
        'd1',
        makePatch({ id: 'late', parentVersion: 1, createdAt: '2026-06-01T00:00:00.000Z' }),
      );
      const ids: string[] = [];
      for await (const cs of store.getHistory('d1', {
        after: '2026-03-01T00:00:00.000Z',
      })) {
        ids.push(cs.id);
      }
      expect(ids).toEqual(['late']);
    });
  });

  /* --------- update tier wire-up — AC #5 (NOTIFY fired), #9 isolation ------ */

  describe('update tier wire-up', () => {
    it('applyUpdate inserts a row in updates with the payload bytes (AC #5)', async () => {
      const bytes = new Uint8Array([1, 2, 3, 4, 5]);
      await store.applyUpdate('d1', bytes);
      const client = await pool.connect();
      try {
        const r = await client.query<{ payload: Buffer | Uint8Array }>(
          'SELECT payload FROM updates WHERE doc_id = $1 ORDER BY id',
          ['d1'],
        );
        expect(r.rows.length).toBe(1);
        const got = r.rows[0]?.payload;
        if (!got) throw new Error('expected a payload row');
        const arr = got instanceof Uint8Array ? Array.from(got) : Array.from(Buffer.from(got));
        expect(arr).toEqual([1, 2, 3, 4, 5]);
      } finally {
        client.release();
      }
    });

    it('applyUpdate ensures the document row exists (FK)', async () => {
      // Brand new doc with no prior putSnapshot; applyUpdate must succeed.
      await store.applyUpdate('fresh_doc', new Uint8Array([7]));
      const client = await pool.connect();
      try {
        const r = await client.query('SELECT id FROM documents WHERE id = $1', ['fresh_doc']);
        expect(r.rows.length).toBe(1);
      } finally {
        client.release();
      }
    });

    it('subscribeUpdates per-doc isolation: a NOTIFY on doc1 does not surface for doc2 (AC #9)', async () => {
      const fakeListen = new FakeListenPool();
      const adapter = new PostgresStorageAdapter({
        pool,
        listenPool: fakeListen,
        defaultOrgId: 'org_test',
      });

      // Pre-populate updates so when our fake notification arrives we can
      // resolve the row by id.
      await adapter.applyUpdate('doc1', new Uint8Array([10]));
      await adapter.applyUpdate('doc2', new Uint8Array([20]));

      const ctl = new AbortController();
      const iter1 = adapter
        .subscribeUpdates('doc1', { signal: ctl.signal })
        [Symbol.asyncIterator]();
      // Force LISTEN registration before emitting.
      const next1 = iter1.next();

      // Wait microtask so openListen runs.
      await Promise.resolve();
      await Promise.resolve();

      // Emit on doc2's channel — iter1 should not see it.
      const cli = fakeListen.clients[0];
      if (!cli) throw new Error('no listen client');
      cli.emit('updates_doc2', '2');

      // Now emit on doc1's channel — iter1 receives [10].
      // First fetch the doc1 update id.
      const c = await pool.connect();
      let doc1UpdateId: string;
      try {
        const r = await c.query<{ id: string | number }>(
          'SELECT id FROM updates WHERE doc_id = $1 ORDER BY id',
          ['doc1'],
        );
        const row0 = r.rows[0];
        doc1UpdateId = String(row0?.id);
      } finally {
        c.release();
      }
      cli.emit('updates_doc1', doc1UpdateId);
      const r = await next1;
      expect(r.done).toBe(false);
      if (!r.done) {
        const arr = Array.from(r.value);
        expect(arr).toEqual([10]);
      }

      ctl.abort();
      await Promise.resolve();
      await Promise.resolve();
    });

    it('subscribeUpdates closes on AbortSignal and releases the LISTEN connection (AC #7)', async () => {
      const fakeListen = new FakeListenPool();
      const adapter = new PostgresStorageAdapter({
        pool,
        listenPool: fakeListen,
        defaultOrgId: 'org_test',
      });
      const ctl = new AbortController();
      const iter = adapter.subscribeUpdates('d1', { signal: ctl.signal })[Symbol.asyncIterator]();
      // Trigger init.
      const _pending = iter.next();
      await Promise.resolve();
      await Promise.resolve();
      expect(fakeListen.clients.length).toBe(1);
      expect(fakeListen.clients[0]?.released).toBe(false);

      ctl.abort();
      await Promise.resolve();
      await Promise.resolve();

      expect(fakeListen.clients[0]?.released).toBe(true);
      const r = await _pending;
      expect(r.done).toBe(true);
    });

    it('subscribeUpdates iterator return() closes the LISTEN connection', async () => {
      const fakeListen = new FakeListenPool();
      const adapter = new PostgresStorageAdapter({
        pool,
        listenPool: fakeListen,
        defaultOrgId: 'org_test',
      });
      const iter = adapter.subscribeUpdates('d1')[Symbol.asyncIterator]();
      const _p = iter.next();
      await Promise.resolve();
      await Promise.resolve();
      await iter.return?.();
      expect(fakeListen.clients[0]?.released).toBe(true);
      // Drain pending so vitest doesn't leak.
      // The pending next() will be resolved by close() with done.
      const r = await _p;
      expect(r.done).toBe(true);
    });

    it('multi-subscriber: two subscribes on the same doc each open their own LISTEN connection (AC #8)', async () => {
      const fakeListen = new FakeListenPool();
      const adapter = new PostgresStorageAdapter({
        pool,
        listenPool: fakeListen,
        defaultOrgId: 'org_test',
      });
      const ctl = new AbortController();
      const iterA = adapter.subscribeUpdates('d1', { signal: ctl.signal })[Symbol.asyncIterator]();
      const iterB = adapter.subscribeUpdates('d1', { signal: ctl.signal })[Symbol.asyncIterator]();
      const _pa = iterA.next();
      const _pb = iterB.next();
      await Promise.resolve();
      await Promise.resolve();
      expect(fakeListen.clients.length).toBe(2);
      ctl.abort();
      await Promise.resolve();
      await Promise.resolve();
      const ra = await _pa;
      const rb = await _pb;
      expect(ra.done).toBe(true);
      expect(rb.done).toBe(true);
    });
  });
});

/* ----------------- transactional safety: rollback on error ---------------- */

describe('PostgresStorageAdapter — transactional safety', () => {
  it('applyPatch rolls back when the version check fails — no orphan changeset', async () => {
    const pool = await freshPool();
    const store = new PostgresStorageAdapter({
      pool,
      defaultOrgId: 'org_test',
    });

    await store.applyPatch('d1', {
      id: 'p1',
      docId: 'd1',
      parentVersion: 0,
      ops: [{ op: 'replace', path: '/x', value: 1 }],
      actor: 'u',
      createdAt: nowISO(),
    });

    // Now d1's current_version = 1. Try a patch claiming parentVersion 0.
    await expect(
      store.applyPatch('d1', {
        id: 'p_stale',
        docId: 'd1',
        parentVersion: 0,
        ops: [{ op: 'replace', path: '/x', value: 2 }],
        actor: 'u',
        createdAt: nowISO(),
      }),
    ).rejects.toBeInstanceOf(StorageVersionMismatchError);

    // History should hold p1 only.
    const seen: string[] = [];
    for await (const cs of store.getHistory('d1')) seen.push(cs.id);
    expect(seen).toEqual(['p1']);
  });
});

/* ----------------- contract conformance smoke (AC #18) ---------------- */
//
// The full contract test suite from packages/storage/src/in-memory.test.ts is
// duplicated here in spirit so the same assertions hold against PG. We keep
// it terse — exhaustive concurrency tests live in the integration suite.

describe('contract conformance vs InMemoryStorageAdapter (AC #18)', () => {
  let pool: AdapterPool;
  let store: PostgresStorageAdapter;

  beforeEach(async () => {
    pool = await freshPool();
    store = new PostgresStorageAdapter({ pool, defaultOrgId: 'org_test' });
  });

  it('snapshot null -> put -> get round-trip', async () => {
    expect(await store.getSnapshot('m')).toBeNull();
    await store.putSnapshot('m', {
      docId: 'm',
      version: 0,
      content: { a: 1 },
      updatedAt: nowISO(),
    });
    const got = await store.getSnapshot('m');
    expect(got?.version).toBe(0);
    expect(got?.content).toEqual({ a: 1 });
  });

  it('patch on fresh doc + history reflects it', async () => {
    await store.applyPatch('m', {
      id: 'p1',
      docId: 'm',
      parentVersion: 0,
      ops: [{ op: 'add', path: '/x', value: 1 }],
      actor: 'u',
      createdAt: '2026-01-01T00:00:00.000Z',
    });
    const seen: string[] = [];
    for await (const cs of store.getHistory('m')) seen.push(cs.id);
    expect(seen).toEqual(['p1']);
  });

  it('version mismatch surfaces the same error class as InMemory', async () => {
    await store.applyPatch('m', {
      id: 'p1',
      docId: 'm',
      parentVersion: 0,
      ops: [{ op: 'add', path: '/x', value: 1 }],
      actor: 'u',
      createdAt: nowISO(),
    });
    await expect(
      store.applyPatch('m', {
        id: 'p2',
        docId: 'm',
        parentVersion: 0, // stale
        ops: [{ op: 'add', path: '/y', value: 2 }],
        actor: 'u',
        createdAt: nowISO(),
      }),
    ).rejects.toBeInstanceOf(StorageVersionMismatchError);
  });
});

/* ----------------- AdapterPoolClient release contract ---------------- */

describe('AdapterPoolClient release contract (no leaks under errors)', () => {
  it('a query failure inside putSnapshot still releases the client', async () => {
    let releaseCount = 0;
    const client: AdapterPoolClient = {
      async query(): Promise<{ rows: never[]; rowCount: number }> {
        throw Object.assign(new Error('boom'), { code: '23505' });
      },
      release(): void {
        releaseCount += 1;
      },
    };
    const pool: AdapterPool = {
      async connect(): Promise<AdapterPoolClient> {
        return client;
      },
    };
    const store = new PostgresStorageAdapter({ pool, defaultOrgId: 'org_test' });
    await expect(
      store.putSnapshot('d1', {
        docId: 'd1',
        version: 0,
        content: null,
        updatedAt: nowISO(),
      }),
    ).rejects.toThrow();
    expect(releaseCount).toBe(1);
  });
});
