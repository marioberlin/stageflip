// packages/storage-postgres/src/adapter.ts
// `PostgresStorageAdapter` — implements the `StorageAdapter` contract from
// `@stageflip/storage` against a pg pool. Mirrors the multi-subscriber
// semantics of `InMemoryStorageAdapter` (see packages/storage/src/in-memory.ts)
// but persists to four tables: documents, snapshots, updates, changesets.
//
// See docs/tasks/T-270.md for AC mapping. Key correctness primitives:
//   - applyPatch uses a transaction with `SELECT ... FOR UPDATE` on
//     `documents` so two concurrent writers cannot both succeed against the
//     same parent_version (AC #10–11).
//   - applyUpdate INSERTs to `updates` and fires `NOTIFY updates_<docId>`
//     so per-doc subscribers wake up (AC #5).
//   - subscribeUpdates LISTENs on a per-doc channel and reads payloads as
//     update ids, then fetches the row by id (AC #6 / D-T270-2).

import {
  type ChangeSet,
  type DocumentSnapshot,
  type HistoryOptions,
  type StorageAdapter,
  StorageVersionMismatchError,
  type SubscribeOptions,
  changeSetSchema,
  documentSnapshotSchema,
} from '@stageflip/storage';

import { mapPgError } from './errors.js';
import { type ListenPool, openListen } from './listen-connection.js';

/** Subset of `pg.PoolClient` needed by adapter queries + transactions. */
export interface AdapterPoolClient {
  query<R = unknown>(
    text: string,
    values?: unknown[],
  ): Promise<{ rows: R[]; rowCount?: number | null }>;
  release(err?: Error | boolean): void;
}

/** Pool subset we depend on. Both `pg.Pool` and pg-mem's pool satisfy. */
export interface AdapterPool {
  connect(): Promise<AdapterPoolClient>;
}

/**
 * Pool used for LISTEN connections. May be the same physical pool, but the
 * shapes diverge slightly because pg's PoolClient supports event-emitter
 * methods only on the dedicated `pg.Client` interface. Callers can pass the
 * same Pool — pg satisfies both.
 */
export interface PostgresStorageAdapterOptions {
  /** Pool used for snapshot / patch / update writes. */
  pool: AdapterPool;
  /**
   * Pool used to check out dedicated LISTEN connections. Defaults to `pool`
   * when omitted — works for `pg.Pool` because its PoolClient is also an
   * EventEmitter for `notification`.
   */
  listenPool?: ListenPool;
  /**
   * Org id stamped on documents created via `putSnapshot`/`applyPatch` when
   * the row doesn't already exist. The adapter is single-tenant per
   * instance; multi-tenant deployments construct one adapter per org. This
   * mirrors the FirebaseStorageAdapter region-router pattern (T-271).
   */
  defaultOrgId: string;
}

/** Channel name for per-doc NOTIFY/LISTEN. Doc ids are sanitized to letters,
 * digits, underscore. Doc ids beyond that fail loud. */
export function channelForDoc(docId: string): string {
  if (!/^[A-Za-z0-9_-]+$/.test(docId)) {
    throw new Error(
      `storage-postgres: docId must match [A-Za-z0-9_-] for LISTEN channel safety; got "${docId}"`,
    );
  }
  // PG identifiers cap at 63 chars; channel length budget is generous since
  // we prefix with `updates_`.
  const safe = docId.replace(/-/g, '_');
  const channel = `updates_${safe}`;
  if (channel.length > 63) {
    throw new Error(`storage-postgres: channel name too long for docId "${docId}"`);
  }
  return channel;
}

/**
 * Postgres-backed StorageAdapter. Construct one per logical document family
 * (org/tenant). The pool lifecycle is the caller's: pass it in, dispose
 * externally — mirrors the auth-middleware DI pattern used elsewhere in the
 * monorepo.
 */
export class PostgresStorageAdapter implements StorageAdapter {
  private readonly pool: AdapterPool;
  private readonly listenPool: ListenPool;
  private readonly defaultOrgId: string;

  constructor(opts: PostgresStorageAdapterOptions) {
    this.pool = opts.pool;
    // The default cast is safe: pg's PoolClient implements both shapes, and
    // pg-mem's createPg.Pool likewise. Tests pass an explicit listenPool when
    // they need to exercise the LISTEN path with a fake.
    this.listenPool = opts.listenPool ?? (opts.pool as unknown as ListenPool);
    this.defaultOrgId = opts.defaultOrgId;
  }

  /* --------------------------- snapshot tier --------------------------- */

  async getSnapshot(docId: string): Promise<DocumentSnapshot | null> {
    const client = await this.pool.connect();
    try {
      // Latest snapshot = the row whose version equals documents.current_version.
      const docRow = await client.query<{ current_version: string | number }>(
        'SELECT current_version FROM documents WHERE id = $1',
        [docId],
      );
      if (docRow.rows.length === 0) return null;
      const row = docRow.rows[0];
      if (!row) return null;
      const currentVersion = Number(row.current_version);
      const snap = await client.query<{
        version: string | number;
        content: unknown;
        updated_at: Date | string;
      }>('SELECT version, content, updated_at FROM snapshots WHERE doc_id = $1 AND version = $2', [
        docId,
        currentVersion,
      ]);
      if (snap.rows.length === 0) return null;
      const s = snap.rows[0];
      if (!s) return null;
      return {
        docId,
        version: Number(s.version),
        content: s.content,
        updatedAt: toIso(s.updated_at),
      };
    } catch (err) {
      throw mapPgError(err, { docId, op: 'getSnapshot' });
    } finally {
      client.release();
    }
  }

  async putSnapshot(docId: string, snapshot: DocumentSnapshot): Promise<void> {
    if (snapshot.docId !== docId) {
      throw new Error(
        `storage-postgres: snapshot.docId "${snapshot.docId}" does not match docId "${docId}"`,
      );
    }
    documentSnapshotSchema.parse(snapshot);
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      // Ensure the document row exists. ON CONFLICT means concurrent
      // putSnapshot calls for the same doc race here harmlessly. Timestamps
      // come from the adapter (server clock) rather than DDL DEFAULT now() so
      // the migration parses identically under pg-mem and real PG.
      await client.query(
        `INSERT INTO documents(id, org_id, current_version, created_at, updated_at)
         VALUES ($1, $2, $3, now(), now())
         ON CONFLICT (id) DO UPDATE
           SET current_version = EXCLUDED.current_version,
               updated_at      = now()`,
        [docId, this.defaultOrgId, snapshot.version],
      );
      // Insert the snapshot row. PRIMARY KEY (doc_id, version) means a
      // concurrent putSnapshot at the same version raises 23505.
      await client.query(
        `INSERT INTO snapshots(doc_id, version, content, updated_at)
         VALUES ($1, $2, $3::jsonb, $4)`,
        [docId, snapshot.version, JSON.stringify(snapshot.content), snapshot.updatedAt],
      );
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw mapPgError(err, { docId, op: 'putSnapshot' });
    } finally {
      client.release();
    }
  }

  /* ---------------------------- update tier ---------------------------- */

  async applyUpdate(docId: string, update: Uint8Array): Promise<void> {
    const channel = channelForDoc(docId);
    const client = await this.pool.connect();
    try {
      // Ensure the document row exists so the FK on `updates` succeeds even
      // for a doc that was never snapshotted (matches in-memory adapter
      // behaviour: applyUpdate is allowed without a prior putSnapshot).
      await client.query(
        `INSERT INTO documents(id, org_id, current_version, created_at, updated_at)
         VALUES ($1, $2, 0, now(), now())
         ON CONFLICT (id) DO NOTHING`,
        [docId, this.defaultOrgId],
      );
      const inserted = await client.query<{ id: string | number }>(
        'INSERT INTO updates(doc_id, payload, created_at) VALUES ($1, $2, now()) RETURNING id',
        [docId, Buffer.from(update)],
      );
      const idRow = inserted.rows[0];
      const updateId = idRow ? String(idRow.id) : '';
      // NOTIFY's payload is limited to 8000 bytes; we pass the row id only.
      // pg-mem does not implement NOTIFY (it parses but does not deliver
      // across connections); we issue the statement anyway because real PG
      // is the production target. Failures are logged-via-throw under real
      // PG but swallowed if the statement is unrecognised — pg-mem raises
      // a parse-coverage warning, not a SQLSTATE error.
      try {
        await client.query(`NOTIFY "${channel}", '${escapeNotifyPayload(updateId)}'`);
      } catch (err) {
        // Re-throw real PG errors (have a SQLSTATE code); silence pg-mem
        // "not supported" warnings (no code).
        const e = err as { code?: string };
        if (e?.code) throw err;
      }
    } catch (err) {
      throw mapPgError(err, { docId, op: 'applyUpdate' });
    } finally {
      client.release();
    }
  }

  subscribeUpdates(docId: string, opts: SubscribeOptions = {}): AsyncIterable<Uint8Array> {
    const channel = channelForDoc(docId);
    const pool = this.pool;
    const listenPool = this.listenPool;
    return {
      [Symbol.asyncIterator]: () => {
        let inner: AsyncIterator<string> | null = null;
        let closed = false;
        let handle: Awaited<ReturnType<typeof openListen>> | null = null;
        let initPromise: Promise<AsyncIterator<string>> | null = null;

        const init = (): Promise<AsyncIterator<string>> => {
          if (initPromise) return initPromise;
          initPromise = openListen(listenPool, channel, opts).then((h) => {
            handle = h;
            // If close was requested while init was in flight, close the
            // newly-opened handle immediately.
            if (closed) {
              void h.close();
            }
            inner = h.payloads()[Symbol.asyncIterator]();
            return inner;
          });
          return initPromise;
        };

        const next = async (): Promise<IteratorResult<Uint8Array>> => {
          if (closed) return { value: undefined, done: true };
          const it = await init();
          const r = await it.next();
          if (r.done) {
            closed = true;
            return { value: undefined, done: true };
          }
          // Payload is the update id; fetch the row.
          const updateId = r.value;
          const c = await pool.connect();
          try {
            const row = await c.query<{ payload: Buffer | Uint8Array }>(
              'SELECT payload FROM updates WHERE id = $1',
              [updateId],
            );
            const r0 = row.rows[0];
            if (!r0) {
              // Notification arrived but the row vanished (rollback?); skip
              // and recurse for the next payload.
              c.release();
              return await next();
            }
            const buf = r0.payload;
            const bytes = buf instanceof Uint8Array ? new Uint8Array(buf) : new Uint8Array(buf);
            c.release();
            return { value: bytes, done: false };
          } catch (err) {
            c.release();
            throw mapPgError(err, { docId, op: 'subscribeUpdates' });
          }
        };

        return {
          next,
          return: async (): Promise<IteratorResult<Uint8Array>> => {
            closed = true;
            // If init has resolved, close the handle directly. If it's in
            // flight, the .then() above will close on completion.
            if (handle) await handle.close();
            else if (initPromise) {
              // Wait for init then close.
              try {
                await initPromise;
              } catch {
                /* init failure is non-fatal during shutdown */
              }
              if (handle) {
                const h = handle as { close: () => Promise<void> };
                await h.close();
              }
            }
            return { value: undefined, done: true };
          },
        };
      },
    };
  }

  /* ---------------------------- patch tier ----------------------------- */

  async applyPatch(docId: string, patch: ChangeSet): Promise<void> {
    if (patch.docId !== docId) {
      throw new Error(
        `storage-postgres: patch.docId "${patch.docId}" does not match docId "${docId}"`,
      );
    }
    changeSetSchema.parse(patch);
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // Lock the document row so no other writer can advance current_version
      // beneath us. If the row doesn't exist, treat current_version as 0
      // (matches InMemoryStorageAdapter "fresh doc" semantics).
      const sel = await client.query<{ current_version: string | number }>(
        'SELECT current_version FROM documents WHERE id = $1 FOR UPDATE',
        [docId],
      );

      let actualVersion: number;
      if (sel.rows.length === 0) {
        actualVersion = 0;
      } else {
        const row0 = sel.rows[0];
        actualVersion = row0 ? Number(row0.current_version) : 0;
      }

      if (patch.parentVersion !== actualVersion) {
        await client.query('ROLLBACK');
        throw new StorageVersionMismatchError(docId, patch.parentVersion, actualVersion);
      }

      // Upsert the document row (no-op on conflict, which can't happen here
      // since we just selected; INSERT covers the fresh-doc path).
      if (sel.rows.length === 0) {
        await client.query(
          `INSERT INTO documents(id, org_id, current_version, created_at, updated_at)
           VALUES ($1, $2, $3, now(), now())
           ON CONFLICT (id) DO NOTHING`,
          [docId, this.defaultOrgId, 0],
        );
      }

      await client.query(
        `INSERT INTO changesets(id, doc_id, parent_version, ops, actor, created_at)
         VALUES ($1, $2, $3, $4::jsonb, $5, $6)`,
        [
          patch.id,
          docId,
          patch.parentVersion,
          JSON.stringify(patch.ops),
          patch.actor,
          patch.createdAt,
        ],
      );

      await client.query(
        'UPDATE documents SET current_version = current_version + 1, updated_at = now() WHERE id = $1',
        [docId],
      );

      await client.query('COMMIT');
    } catch (err) {
      if (err instanceof StorageVersionMismatchError) throw err;
      await client.query('ROLLBACK').catch(() => undefined);
      throw mapPgError(err, { docId, op: 'applyPatch' });
    } finally {
      client.release();
    }
  }

  async *getHistory(docId: string, opts: HistoryOptions = {}): AsyncIterable<ChangeSet> {
    const client = await this.pool.connect();
    try {
      // We over-fetch then slice client-side for `limit` because PG's
      // ORDER + LIMIT semantics for "most recent N" require a sub-query;
      // the contract returns the latest N entries in chronological order
      // (matches the InMemoryStorageAdapter slice(-limit) behaviour).
      const params: unknown[] = [docId];
      let where = 'WHERE doc_id = $1';
      if (opts.after !== undefined) {
        params.push(opts.after);
        where += ` AND created_at > $${params.length}::timestamptz`;
      }
      const rows = await client.query<{
        id: string;
        doc_id: string;
        parent_version: string | number;
        ops: unknown;
        actor: string;
        created_at: Date | string;
      }>(
        `SELECT id, doc_id, parent_version, ops, actor, created_at
         FROM changesets
         ${where}
         ORDER BY created_at ASC, id ASC`,
        params,
      );
      let list: ChangeSet[] = rows.rows.map((r) => ({
        id: r.id,
        docId: r.doc_id,
        parentVersion: Number(r.parent_version),
        ops: r.ops as ChangeSet['ops'],
        actor: r.actor,
        createdAt: toIso(r.created_at),
      }));
      if (opts.limit !== undefined) list = list.slice(-opts.limit);
      for (const cs of list) yield cs;
    } finally {
      client.release();
    }
  }
}

/** Coerce a PG TIMESTAMPTZ result (Date | string) to ISO 8601. */
function toIso(value: Date | string): string {
  if (value instanceof Date) return value.toISOString();
  // pg-mem returns ISO strings already; preserve. Otherwise normalise via Date.
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toISOString();
}

/** Escape a NOTIFY payload string. PG accepts a single-quoted literal; we
 * double-up embedded single quotes per PG SQL string-literal rules. */
function escapeNotifyPayload(s: string): string {
  return s.replace(/'/g, "''");
}
