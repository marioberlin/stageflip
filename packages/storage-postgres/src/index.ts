// packages/storage-postgres/src/index.ts
// @stageflip/storage-postgres — Postgres-backed StorageAdapter (T-270).
// Implements the same contract as `@stageflip/storage`'s InMemory adapter and
// the future Firestore document adapter, against a `pg` connection pool.
// Target dev-grade deployment: Supabase. Same code runs against Cloud SQL,
// Neon, or self-hosted PG.

export {
  PostgresStorageAdapter,
  channelForDoc,
  type AdapterPool,
  type AdapterPoolClient,
  type PostgresStorageAdapterOptions,
} from './adapter.js';

export {
  loadMigrations,
  runMigrations,
  type Migration,
  type MigrationClient,
  type MigrationPool,
  type MigrationReport,
} from './migration-runner.js';

export {
  openListen,
  type ListenHandle,
  type ListenPool,
  type ListenPoolClient,
  type PgNotification,
} from './listen-connection.js';

export {
  StorageConnectionError,
  StorageContentionError,
  isPgError,
  mapPgError,
  type PgErrorLike,
} from './errors.js';
