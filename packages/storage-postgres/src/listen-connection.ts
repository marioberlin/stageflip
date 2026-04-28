// packages/storage-postgres/src/listen-connection.ts
// Helper that opens a dedicated `LISTEN` connection from a pg pool, fans the
// notification stream into an async iterator, and releases the connection on
// abort. Per D-T270-2: a LISTEN connection cannot service other queries while
// it's holding the listener, so we check it out long-lived from the pool.
//
// Public-spec reference: https://www.postgresql.org/docs/current/sql-listen.html

/**
 * Minimal `pg.Notification` shape. Channel is the LISTEN target; payload is
 * the (string-coerced) NOTIFY argument. Both are guaranteed by pg.
 */
export interface PgNotification {
  channel: string;
  payload?: string;
}

/**
 * Subset of `pg.PoolClient` we use. Real pg, pg-mem, and our own fakes all
 * satisfy this shape.
 */
export interface ListenPoolClient {
  query(text: string, values?: unknown[]): Promise<unknown>;
  on(event: 'notification', cb: (msg: PgNotification) => void): void;
  off(event: 'notification', cb: (msg: PgNotification) => void): void;
  release(): void;
}

/** Pool subset we use to check out a dedicated client. */
export interface ListenPool {
  connect(): Promise<ListenPoolClient>;
}

/** A live LISTEN subscription. Disposable via `close()` or AbortSignal. */
export interface ListenHandle {
  /** Channel currently listened on. */
  readonly channel: string;
  /** Async iterator yielding payloads (empty string when NOTIFY had none). */
  payloads(): AsyncIterable<string>;
  /** Release the connection back to the pool. Idempotent. */
  close(): Promise<void>;
  /** Whether `close()` has run. Useful for tests. */
  isClosed(): boolean;
}

/**
 * Open a LISTEN connection on `channel`, returning a handle. The signal, if
 * provided, closes the handle on abort (AC #7).
 *
 * Channel names are quoted with `pg_quote_ident`-equivalent rules: we accept
 * only `[A-Za-z0-9_]` so callers needn't worry about injection. Unsafe names
 * throw before any DB call.
 */
export async function openListen(
  pool: ListenPool,
  channel: string,
  opts: { signal?: AbortSignal } = {},
): Promise<ListenHandle> {
  if (!/^[A-Za-z0-9_]+$/.test(channel)) {
    throw new Error(`storage-postgres: unsafe LISTEN channel name: ${channel}`);
  }
  const client = await pool.connect();
  let closed = false;

  const queue: string[] = [];
  const waiters: Array<(value: IteratorResult<string>) => void> = [];

  const onNotification = (msg: PgNotification): void => {
    if (msg.channel !== channel) return;
    const payload = msg.payload ?? '';
    const w = waiters.shift();
    if (w) {
      w({ value: payload, done: false });
      return;
    }
    queue.push(payload);
  };

  client.on('notification', onNotification);
  // Quote-and-double-quote the channel name so PG accepts mixed-case if
  // present (we already validated charset above).
  await client.query(`LISTEN "${channel}"`);

  const close = async (): Promise<void> => {
    if (closed) return;
    closed = true;
    try {
      client.off('notification', onNotification);
    } catch {
      /* event-emitter may not support off cleanly in pg-mem */
    }
    try {
      await client.query(`UNLISTEN "${channel}"`);
    } catch {
      /* connection may already be closed; release anyway */
    }
    try {
      client.release();
    } catch {
      /* idempotent best-effort */
    }
    for (const w of waiters) w({ value: undefined, done: true });
    waiters.length = 0;
  };

  if (opts.signal) {
    if (opts.signal.aborted) {
      // Microtask: close after returning, so the caller's iterator sees done.
      queueMicrotask(() => {
        void close();
      });
    } else {
      opts.signal.addEventListener('abort', () => void close(), { once: true });
    }
  }

  return {
    channel,
    payloads(): AsyncIterable<string> {
      return {
        [Symbol.asyncIterator]: () => ({
          next: (): Promise<IteratorResult<string>> => {
            const buffered = queue.shift();
            if (buffered !== undefined) {
              return Promise.resolve({ value: buffered, done: false });
            }
            if (closed) {
              return Promise.resolve({ value: undefined, done: true });
            }
            return new Promise<IteratorResult<string>>((resolve) => waiters.push(resolve));
          },
          return: async (): Promise<IteratorResult<string>> => {
            await close();
            return { value: undefined, done: true };
          },
        }),
      };
    },
    close,
    isClosed: () => closed,
  };
}
