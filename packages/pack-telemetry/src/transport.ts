// packages/pack-telemetry/src/transport.ts
// T-503 — Transport implementations: NoopTransport (default when
// telemetry is off), BufferedTransport (wraps another transport
// with a fixed-size buffer), and HttpTransport (wire-format-only;
// the receiving endpoint lands in T-541).

import type { PackTelemetryEvent } from './events.js';

/** Transport contract — receives event batches and ships them. */
export interface TelemetryTransport {
  /** Send one batch of events. Implementations MUST NOT throw on
   *  network errors; they should log + drop. */
  send(events: readonly PackTelemetryEvent[]): Promise<void>;
}

/** No-op transport — silently drops every event. The default when
 *  the recorder is constructed with `enabled: false`. */
export class NoopTransport implements TelemetryTransport {
  async send(_events: readonly PackTelemetryEvent[]): Promise<void> {
    // Intentionally empty — telemetry is disabled.
  }
}

/** A fetch-shaped function. Decoupled from the global `fetch` so
 *  tests can inject an in-memory shim. */
export type FetchLike = (
  url: string,
  init: {
    method: 'POST';
    headers: Record<string, string>;
    body: string;
  },
) => Promise<{ status: number; statusText: string; text(): Promise<string> }>;

/** Adapter from the platform's global `fetch` to `FetchLike`. */
const defaultFetch: FetchLike = async (url, init) => {
  const res = await fetch(url, init);
  return {
    status: res.status,
    statusText: res.statusText,
    text: () => res.text(),
  };
};

/** Minimal logger surface — recorder + transports use this for
 *  observability without depending on `console`. */
export interface TelemetryLogger {
  warn(msg: string): void;
  error(msg: string): void;
}

/** Default logger — writes to `process.stderr`. */
export const defaultTelemetryLogger: TelemetryLogger = {
  warn: (msg) => {
    process.stderr.write(`${msg}\n`);
  },
  error: (msg) => {
    process.stderr.write(`${msg}\n`);
  },
};

/** Options for `BufferedTransport`. */
export interface BufferedTransportOptions {
  readonly inner: TelemetryTransport;
  /** Buffer threshold — auto-flush when the buffered count meets
   *  this number. Defaults to 16. */
  readonly bufferSize?: number;
}

/** Buffers events in memory; auto-flushes when the buffer fills, or
 *  on explicit `flush()`. Errors from the inner transport are
 *  swallowed (the recorder layer logs them). */
export class BufferedTransport implements TelemetryTransport {
  private buffer: PackTelemetryEvent[] = [];
  private readonly inner: TelemetryTransport;
  private readonly bufferSize: number;

  constructor(opts: BufferedTransportOptions) {
    this.inner = opts.inner;
    this.bufferSize = Math.max(1, opts.bufferSize ?? 16);
  }

  /** Append events; auto-flush if the buffer reaches `bufferSize`. */
  async send(events: readonly PackTelemetryEvent[]): Promise<void> {
    for (const ev of events) {
      this.buffer.push(ev);
    }
    if (this.buffer.length >= this.bufferSize) {
      await this.flush();
    }
  }

  /** Force-drain the buffer to the inner transport. */
  async flush(): Promise<void> {
    if (this.buffer.length === 0) return;
    const batch = this.buffer;
    this.buffer = [];
    await this.inner.send(batch);
  }

  /** Test-only — current buffer length. */
  get pendingCount(): number {
    return this.buffer.length;
  }
}

/** Options for `HttpTransport`. */
export interface HttpTransportOptions {
  /** Endpoint URL — POSTs JSON `{ events: PackTelemetryEvent[] }`. */
  readonly endpointUrl: string;
  /** Optional bearer token; if set, added as
   *  `Authorization: Bearer <token>`. */
  readonly bearerToken?: string;
  /** Injected for tests; defaults to the global `fetch`. */
  readonly fetch?: FetchLike;
  /** Injected logger. */
  readonly logger?: TelemetryLogger;
}

/** POSTs telemetry batches to a configured endpoint URL. The
 *  receiver does not exist yet (lands in T-541 — pack telemetry
 *  dashboard); this transport is wire-format-only and tested
 *  against an injected `fetch` shim. */
export class HttpTransport implements TelemetryTransport {
  private readonly endpointUrl: string;
  private readonly bearerToken: string | undefined;
  private readonly fetchImpl: FetchLike;
  private readonly logger: TelemetryLogger;

  constructor(opts: HttpTransportOptions) {
    this.endpointUrl = opts.endpointUrl;
    this.bearerToken = opts.bearerToken;
    this.fetchImpl = opts.fetch ?? defaultFetch;
    this.logger = opts.logger ?? defaultTelemetryLogger;
  }

  /** Send a single batch. 4xx → log + drop. 5xx → one retry, then
   *  log + drop. Network errors → log + drop. Never throws. */
  async send(events: readonly PackTelemetryEvent[]): Promise<void> {
    if (events.length === 0) return;

    const headers: Record<string, string> = {
      'content-type': 'application/json',
    };
    if (this.bearerToken !== undefined) {
      headers.authorization = `Bearer ${this.bearerToken}`;
    }
    const body = JSON.stringify({ events });

    const attempt = async (): Promise<{
      ok: boolean;
      retryable: boolean;
      detail: string;
    }> => {
      try {
        const res = await this.fetchImpl(this.endpointUrl, {
          method: 'POST',
          headers,
          body,
        });
        if (res.status >= 200 && res.status < 300) {
          return { ok: true, retryable: false, detail: '' };
        }
        const retryable = res.status >= 500 && res.status < 600;
        return {
          ok: false,
          retryable,
          detail: `HTTP ${res.status} ${res.statusText}`,
        };
      } catch (err) {
        return {
          ok: false,
          retryable: true,
          detail: `network error: ${(err as Error).message}`,
        };
      }
    };

    const first = await attempt();
    if (first.ok) return;
    if (!first.retryable) {
      this.logger.warn(
        `[pack-telemetry] HttpTransport drop ${events.length} events: ${first.detail}`,
      );
      return;
    }
    const second = await attempt();
    if (second.ok) return;
    this.logger.warn(
      `[pack-telemetry] HttpTransport drop ${events.length} events after retry: ${second.detail}`,
    );
  }
}
