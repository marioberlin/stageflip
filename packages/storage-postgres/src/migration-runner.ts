// packages/storage-postgres/src/migration-runner.ts
// Applies SQL migration files in lexicographic order, recording successful
// runs in a `__migrations` tracking table. Idempotent (AC #14): re-running is
// a no-op for already-applied migrations. Each migration runs in a single
// transaction (AC #15) — failure rolls back cleanly.
//
// We deliberately do NOT use a third-party migration tool. The contract is
// trivial — list files, apply in order, track applied set — and adding a tool
// drags in license + lock-step concerns we don't need.

import { readFile, readdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Minimal pool/client shape this runner depends on. Both `pg.Pool` and
 * pg-mem's adapter pool satisfy it.
 */
export interface MigrationPool {
  connect(): Promise<MigrationClient>;
}

export interface MigrationClient {
  query(text: string, values?: unknown[]): Promise<{ rows: Array<Record<string, unknown>> }>;
  release(): void;
}

// Tracking DDL split into a "create-if-needed" probe + the DDL itself. We
// avoid `CREATE TABLE IF NOT EXISTS … DEFAULT now()` because that combination
// trips pg-mem's AST coverage check; instead we probe `information_schema`
// (portable across PG and pg-mem) and create the table explicitly. The DDL
// drops the `DEFAULT now()` because pg-mem's AST probe silently rejects it
// even at fresh-create — applied_at is set by the INSERT below.
const TRACKING_PROBE = `
SELECT 1 AS one FROM information_schema.tables
WHERE table_name = '__migrations'
`;
const TRACKING_DDL = `
CREATE TABLE __migrations (
  name        TEXT PRIMARY KEY,
  applied_at  TIMESTAMPTZ NOT NULL
)
`;

/** A loaded migration: its file name and SQL contents. */
export interface Migration {
  name: string;
  sql: string;
}

/** Result of `runMigrations`: which files ran, which were skipped. */
export interface MigrationReport {
  applied: string[];
  skipped: string[];
}

/**
 * Load `.sql` files from `dir` (default: this package's `migrations/`).
 * Returned in lexicographic order — the same order they will be applied.
 */
export async function loadMigrations(dir?: string): Promise<Migration[]> {
  const directory = dir ?? defaultMigrationsDir();
  const entries = await readdir(directory);
  const files = entries.filter((f) => f.endsWith('.sql')).sort();
  const out: Migration[] = [];
  for (const f of files) {
    const sql = await readFile(join(directory, f), 'utf8');
    out.push({ name: f, sql });
  }
  return out;
}

/**
 * Apply all pending migrations against `pool`. Existing entries in
 * `__migrations` are skipped. Each migration runs inside its own
 * BEGIN/COMMIT (or ROLLBACK on failure).
 *
 * Pass `migrations` to override the bundled set (used in tests).
 */
export async function runMigrations(
  pool: MigrationPool,
  migrations?: Migration[],
): Promise<MigrationReport> {
  const set = migrations ?? (await loadMigrations());
  const client = await pool.connect();
  const applied: string[] = [];
  const skipped: string[] = [];
  try {
    const probe = await client.query(TRACKING_PROBE);
    if (probe.rows.length === 0) {
      await client.query(TRACKING_DDL);
    }
    const existing = await client.query('SELECT name FROM __migrations');
    const done = new Set<string>(existing.rows.map((r) => String(r.name)));
    for (const m of set) {
      if (done.has(m.name)) {
        skipped.push(m.name);
        continue;
      }
      await client.query('BEGIN');
      try {
        await client.query(m.sql);
        await client.query('INSERT INTO __migrations(name, applied_at) VALUES ($1, now())', [
          m.name,
        ]);
        await client.query('COMMIT');
        applied.push(m.name);
      } catch (err) {
        await client.query('ROLLBACK').catch(() => undefined);
        throw err;
      }
    }
  } finally {
    client.release();
  }
  return { applied, skipped };
}

/** Path to this package's bundled migrations folder. */
function defaultMigrationsDir(): string {
  // ESM: derive directory of this module, then resolve sibling `migrations/`.
  // In dist this resolves to dist/migrations; the build copy is wired by
  // tsup's loader-publish step. In source (vitest) it resolves to
  // src/migrations.
  const here = dirname(fileURLToPath(import.meta.url));
  return join(here, 'migrations');
}
