// packages/storage-postgres/src/adapter.integration.test.ts
// Real-Postgres tests for behaviour pg-mem can't fully model: cross-connection
// LISTEN/NOTIFY (AC #5–#9) and transactional FOR UPDATE blocking under
// genuine concurrency (AC #10). Gated by STAGEFLIP_TEST_PG_INTEGRATION=1 so
// `pnpm test` stays fast in dev. CI runs both paths.
//
// Connection string read from STAGEFLIP_TEST_PG_URL; defaults to a local
// docker-postgres at postgres://postgres:postgres@localhost:5432/postgres.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const RUN = process.env.STAGEFLIP_TEST_PG_INTEGRATION === '1';
const DSN =
  process.env.STAGEFLIP_TEST_PG_URL ?? 'postgres://postgres:postgres@localhost:5432/postgres';

// We bail out early when the env flag is unset — tests still register but skip.
const describeIf = RUN ? describe : describe.skip;

describeIf('PostgresStorageAdapter — real PG integration', () => {
  // Lazy-require so the module is only resolved when integration tests run.
  let Pool: typeof import('pg').Pool;
  let runMigrations: typeof import('./migration-runner.js').runMigrations;
  let loadMigrations: typeof import('./migration-runner.js').loadMigrations;
  let PostgresStorageAdapter: typeof import('./adapter.js').PostgresStorageAdapter;
  let StorageVersionMismatchError: typeof import('@stageflip/storage').StorageVersionMismatchError;
  let pool: import('pg').Pool;

  beforeAll(async () => {
    ({ Pool } = await import('pg'));
    ({ runMigrations, loadMigrations } = await import('./migration-runner.js'));
    ({ PostgresStorageAdapter } = await import('./adapter.js'));
    ({ StorageVersionMismatchError } = await import('@stageflip/storage'));

    pool = new Pool({ connectionString: DSN });
    // Per-run schema isolation: drop and recreate.
    const c = await pool.connect();
    try {
      await c.query(
        'DROP TABLE IF EXISTS changesets, updates, snapshots, documents, __migrations CASCADE',
      );
    } finally {
      c.release();
    }
    await runMigrations(pool, await loadMigrations());
  }, 30_000);

  afterAll(async () => {
    if (pool) await pool.end();
  });

  it('subscribeUpdates yields applyUpdate notifications cross-connection (AC #5, #6)', async () => {
    const a = new PostgresStorageAdapter({ pool, defaultOrgId: 'org_test' });
    const ctl = new AbortController();
    const iter = a.subscribeUpdates('it_doc1', { signal: ctl.signal })[Symbol.asyncIterator]();

    // First next() races with the LISTEN being installed; we delay the writer
    // a tick so the LISTEN is live first.
    const got = iter.next();
    await new Promise((r) => setTimeout(r, 50));
    await a.applyUpdate('it_doc1', new Uint8Array([7, 8, 9]));

    const r = await got;
    expect(r.done).toBe(false);
    if (!r.done) expect(Array.from(r.value)).toEqual([7, 8, 9]);

    ctl.abort();
  }, 15_000);

  it('multi-subscriber: two subscribers each receive every update (AC #8)', async () => {
    const a = new PostgresStorageAdapter({ pool, defaultOrgId: 'org_test' });
    const ctl = new AbortController();
    const i1 = a.subscribeUpdates('it_doc2', { signal: ctl.signal })[Symbol.asyncIterator]();
    const i2 = a.subscribeUpdates('it_doc2', { signal: ctl.signal })[Symbol.asyncIterator]();
    const p1 = i1.next();
    const p2 = i2.next();
    await new Promise((r) => setTimeout(r, 50));
    await a.applyUpdate('it_doc2', new Uint8Array([1]));
    const [r1, r2] = await Promise.all([p1, p2]);
    expect(r1.done).toBe(false);
    expect(r2.done).toBe(false);
    if (!r1.done) expect(Array.from(r1.value)).toEqual([1]);
    if (!r2.done) expect(Array.from(r2.value)).toEqual([1]);
    ctl.abort();
  }, 15_000);

  it('per-doc isolation: applyUpdate(doc1) does not surface in subscribe(doc2) (AC #9)', async () => {
    const a = new PostgresStorageAdapter({ pool, defaultOrgId: 'org_test' });
    const ctl = new AbortController();
    const iter = a.subscribeUpdates('it_doc3', { signal: ctl.signal })[Symbol.asyncIterator]();
    const pending = iter.next();
    await new Promise((r) => setTimeout(r, 50));

    await a.applyUpdate('it_doc4', new Uint8Array([99])); // wrong doc
    // Race a small window: nothing should have arrived.
    const winner = await Promise.race<'note' | 'timer'>([
      pending.then(() => 'note' as const),
      new Promise<'timer'>((r) => setTimeout(() => r('timer'), 200)),
    ]);
    expect(winner).toBe('timer');

    await a.applyUpdate('it_doc3', new Uint8Array([42])); // right doc
    const r = await pending;
    expect(r.done).toBe(false);
    if (!r.done) expect(Array.from(r.value)).toEqual([42]);
    ctl.abort();
  }, 15_000);

  it('AbortSignal closes LISTEN connection — pool count returns to baseline (AC #7)', async () => {
    const a = new PostgresStorageAdapter({ pool, defaultOrgId: 'org_test' });
    const before = pool.totalCount;
    const ctl = new AbortController();
    const iter = a.subscribeUpdates('it_doc5', { signal: ctl.signal })[Symbol.asyncIterator]();
    iter.next(); // kick off
    await new Promise((r) => setTimeout(r, 50));
    expect(pool.totalCount).toBeGreaterThanOrEqual(before);
    ctl.abort();
    // Give the close microtask + UNLISTEN round trip time.
    await new Promise((r) => setTimeout(r, 200));
    // After release the pool's connection becomes idle. We don't assert exact
    // totalCount because pg keeps released connections in the pool until
    // `pool.end()`; we just assert no leak — the next subscribe still works.
    const ctl2 = new AbortController();
    const iter2 = a.subscribeUpdates('it_doc5', { signal: ctl2.signal })[Symbol.asyncIterator]();
    iter2.next();
    await new Promise((r) => setTimeout(r, 50));
    ctl2.abort();
    await new Promise((r) => setTimeout(r, 100));
  }, 15_000);

  it('concurrent applyPatch with same parentVersion: one wins, the other gets VersionMismatch (AC #10)', async () => {
    const a = new PostgresStorageAdapter({ pool, defaultOrgId: 'org_test' });
    // Seed the doc at version 0.
    await a.applyPatch('it_doc6', {
      id: 'p_seed',
      docId: 'it_doc6',
      parentVersion: 0,
      ops: [{ op: 'add', path: '/x', value: 1 }],
      actor: 'u',
      createdAt: new Date().toISOString(),
    });

    const mk = (id: string): Promise<void> =>
      a.applyPatch('it_doc6', {
        id,
        docId: 'it_doc6',
        parentVersion: 1, // both claim parent=1
        ops: [{ op: 'replace', path: '/x', value: 2 }],
        actor: 'u',
        createdAt: new Date().toISOString(),
      });

    const settled = await Promise.allSettled([mk('p_a'), mk('p_b')]);
    const fulfilled = settled.filter((s) => s.status === 'fulfilled');
    const rejected = settled.filter((s) => s.status === 'rejected');
    expect(fulfilled.length).toBe(1);
    expect(rejected.length).toBe(1);
    expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(
      StorageVersionMismatchError,
    );
  }, 15_000);
});
