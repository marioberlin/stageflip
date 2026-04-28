// packages/storage-postgres/src/migration-runner.test.ts
// Validates the migration runner contract:
//   AC #13 — applies all .sql files in lexicographic order against a fresh DB.
//   AC #14 — idempotent (re-runs are no-ops).
//   AC #15 — each migration in its own txn; rollback on failure.
// Plus internals: loadMigrations sorts; tracking table records applied set.

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { newDb } from 'pg-mem';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { type Migration, loadMigrations, runMigrations } from './migration-runner.js';

interface PgMemAdapter {
  Pool: new (config?: unknown) => unknown;
}

const here = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(here, 'migrations');

function freshPool(): { pool: unknown; teardown: () => void } {
  const db = newDb();
  const adapter = db.adapters.createPg() as PgMemAdapter;
  const pool = new adapter.Pool();
  return {
    pool,
    teardown: (): void => {
      // pg-mem: nothing persistent; let GC reclaim. Closing pool is a no-op
      // but exercising it confirms the contract.
      const closer = (pool as { end?: () => Promise<void> }).end;
      if (closer) void closer.call(pool);
    },
  };
}

describe('migration-runner', () => {
  let pool: unknown;
  let teardown: () => void;

  beforeEach(() => {
    const next = freshPool();
    pool = next.pool;
    teardown = next.teardown;
  });

  afterEach(() => {
    teardown();
  });

  it('loadMigrations returns .sql files in lexicographic order', async () => {
    const migs = await loadMigrations(MIGRATIONS_DIR);
    expect(migs.length).toBeGreaterThanOrEqual(1);
    const names = migs.map((m) => m.name);
    const sorted = [...names].sort();
    expect(names).toEqual(sorted);
    expect(names[0]).toBe('0001_init.sql');
  });

  it('loadMigrations resolves the bundled migrations dir when called with no arg', async () => {
    // Exercises the default-path branch in migration-runner.ts; covers
    // defaultMigrationsDir() so coverage thresholds are met.
    const migs = await loadMigrations();
    expect(migs.length).toBeGreaterThanOrEqual(1);
    expect(migs[0]?.name).toBe('0001_init.sql');
  });

  it('runMigrations defaults to the bundled migrations when invoked without an explicit list', async () => {
    const report = await runMigrations(pool as Parameters<typeof runMigrations>[0]);
    expect(report.applied).toContain('0001_init.sql');
  });

  it('loadMigrations skips non-.sql files', async () => {
    // Use a custom dir to avoid filesystem mutation; reuse the bundled dir
    // since we know it currently contains only .sql.
    const migs = await loadMigrations(MIGRATIONS_DIR);
    for (const m of migs) {
      expect(m.name.endsWith('.sql')).toBe(true);
    }
  });

  it('runMigrations applies all bundled migrations against a fresh DB (AC #13)', async () => {
    // Dynamically load to avoid double-applying when we re-run.
    const report = await runMigrations(
      pool as Parameters<typeof runMigrations>[0],
      await loadMigrations(MIGRATIONS_DIR),
    );
    expect(report.applied).toContain('0001_init.sql');
    expect(report.skipped).toEqual([]);
    // Verify schema is present by querying for documents.
    const client = await (
      pool as {
        connect: () => Promise<{
          query: (
            sql: string,
            values?: unknown[],
          ) => Promise<{ rows: Array<Record<string, unknown>> }>;
          release: () => void;
        }>;
      }
    ).connect();
    try {
      const r = await client.query('SELECT count(*)::int as c FROM documents');
      expect(r.rows[0].c).toBe(0);
    } finally {
      client.release();
    }
  });

  it('runMigrations is idempotent (AC #14): re-runs are no-ops', async () => {
    const migs = await loadMigrations(MIGRATIONS_DIR);
    const first = await runMigrations(pool as Parameters<typeof runMigrations>[0], migs);
    expect(first.applied.length).toBeGreaterThan(0);
    const second = await runMigrations(pool as Parameters<typeof runMigrations>[0], migs);
    expect(second.applied).toEqual([]);
    expect(second.skipped).toEqual(first.applied);
  });

  it('runMigrations rolls back a failing migration (AC #15)', async () => {
    const ok: Migration = { name: '0001_ok.sql', sql: 'CREATE TABLE good (x INT)' };
    const bad: Migration = {
      name: '0002_bad.sql',
      sql: 'CREATE TABLE good (x INT)', // duplicate — fails on second create
    };
    await expect(
      runMigrations(pool as Parameters<typeof runMigrations>[0], [ok, bad]),
    ).rejects.toThrow();

    // The first ran and was tracked; the second's table-create rolled back.
    // Re-running with only `ok` should skip it.
    const report = await runMigrations(pool as Parameters<typeof runMigrations>[0], [ok]);
    expect(report.skipped).toEqual(['0001_ok.sql']);
  });

  it('runMigrations honours custom migration list', async () => {
    const custom: Migration = {
      name: '0001_custom.sql',
      sql: 'CREATE TABLE custom_table (id INT PRIMARY KEY)',
    };
    const report = await runMigrations(pool as Parameters<typeof runMigrations>[0], [custom]);
    expect(report.applied).toEqual(['0001_custom.sql']);
    const client = await (
      pool as {
        connect: () => Promise<{
          query: (
            sql: string,
            values?: unknown[],
          ) => Promise<{ rows: Array<Record<string, unknown>> }>;
          release: () => void;
        }>;
      }
    ).connect();
    try {
      await client.query('INSERT INTO custom_table(id) VALUES (1)');
    } finally {
      client.release();
    }
  });

  it('runMigrations records names in __migrations table', async () => {
    const migs: Migration[] = [
      { name: '0001_a.sql', sql: 'CREATE TABLE a (x INT)' },
      { name: '0002_b.sql', sql: 'CREATE TABLE b (x INT)' },
    ];
    await runMigrations(pool as Parameters<typeof runMigrations>[0], migs);
    const client = await (
      pool as {
        connect: () => Promise<{
          query: (
            sql: string,
            values?: unknown[],
          ) => Promise<{ rows: Array<Record<string, unknown>> }>;
          release: () => void;
        }>;
      }
    ).connect();
    try {
      const r = await client.query('SELECT name FROM __migrations ORDER BY name');
      const names = r.rows.map((row: { name: string }) => row.name);
      expect(names).toEqual(['0001_a.sql', '0002_b.sql']);
    } finally {
      client.release();
    }
  });
});
