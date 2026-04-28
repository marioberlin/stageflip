// packages/storage-postgres/src/errors.ts
// Maps Postgres-driver error codes (SQLSTATE) to clear application-level
// errors. Per AC #16: unique_violation on snapshots surfaces as a
// version-mismatch-shaped error; connection failures propagate.
//
// SQLSTATE references:
//   - 23505 unique_violation
//   - 23503 foreign_key_violation
//   - 23514 check_violation
//   - 40001 serialization_failure
//   - 40P01 deadlock_detected
//   - 08000 connection_exception (and 08* family)

import { StorageVersionMismatchError } from '@stageflip/storage';

/** A subset of `pg`'s error shape we can rely on. */
export interface PgErrorLike {
  code?: string;
  constraint?: string;
  detail?: string;
  message: string;
}

/** Narrow type guard for shapes carrying a SQLSTATE-ish `code`. */
export function isPgError(err: unknown): err is PgErrorLike {
  return (
    typeof err === 'object' &&
    err !== null &&
    'message' in err &&
    typeof (err as { message: unknown }).message === 'string'
  );
}

/** Thrown when a deadlock or serialization conflict prevents the txn from
 * completing. Callers may retry. */
export class StorageContentionError extends Error {
  constructor(
    public readonly docId: string,
    public override readonly cause: PgErrorLike,
  ) {
    super(`storage-postgres: contention on ${docId}: ${cause.message}`);
    this.name = 'StorageContentionError';
  }
}

/** Thrown when the underlying connection drops mid-operation. */
export class StorageConnectionError extends Error {
  constructor(
    public override readonly cause: PgErrorLike,
    op: string,
  ) {
    super(`storage-postgres: connection failure during ${op}: ${cause.message}`);
    this.name = 'StorageConnectionError';
  }
}

/**
 * Map a thrown PG driver error into an application-level error. The caller
 * supplies `expectedVersion` and `actualVersion` for snapshot conflicts so a
 * `unique_violation` on (doc_id, version) becomes a version-mismatch error.
 *
 * Returns the mapped error to throw; callers must `throw mapPgError(...)`.
 */
export function mapPgError(
  err: unknown,
  ctx: {
    docId: string;
    op: string;
    expectedVersion?: number;
    actualVersion?: number;
  },
): Error {
  if (!isPgError(err)) {
    return err instanceof Error ? err : new Error(String(err));
  }
  const code = err.code;

  // unique_violation on snapshots is the "another writer landed first" case.
  if (code === '23505') {
    if (ctx.expectedVersion !== undefined && ctx.actualVersion !== undefined) {
      return new StorageVersionMismatchError(ctx.docId, ctx.expectedVersion, ctx.actualVersion);
    }
    // Caller didn't pass expected/actual; keep PG semantics readable.
    return new Error(
      `storage-postgres: unique violation on ${ctx.docId} during ${ctx.op}: ${err.detail ?? err.message}`,
    );
  }

  // serialization_failure / deadlock_detected: contention. Caller may retry.
  if (code === '40001' || code === '40P01') {
    return new StorageContentionError(ctx.docId, err);
  }

  // 08* family: connection exceptions.
  if (typeof code === 'string' && code.startsWith('08')) {
    return new StorageConnectionError(err, ctx.op);
  }

  // Unmapped: re-throw the original (preserve stack via Error).
  return err instanceof Error
    ? err
    : Object.assign(new Error(err.message), { code, detail: err.detail });
}
