// packages/pack-telemetry/src/transport.test.ts
// T-503 — Tests for NoopTransport, BufferedTransport, HttpTransport.

import { describe, expect, it } from 'vitest';

import { type PackTelemetryEvent, makeUsageEvent } from './events.js';
import {
  BufferedTransport,
  type FetchLike,
  HttpTransport,
  NoopTransport,
  type TelemetryLogger,
  type TelemetryTransport,
} from './transport.js';

const STUB_HASH = 'a'.repeat(64);

function makeEv(n = 1): PackTelemetryEvent {
  return makeUsageEvent({
    packIdHash: STUB_HASH,
    packVersion: '1.0.0',
    clipMountCount: n,
    windowSeconds: 60,
    nowMs: Date.UTC(2026, 4, 13, 0, 0, 0),
  });
}

class RecordingTransport implements TelemetryTransport {
  public batches: PackTelemetryEvent[][] = [];
  async send(events: readonly PackTelemetryEvent[]): Promise<void> {
    this.batches.push([...events]);
  }
}

function silentLogger(): { logger: TelemetryLogger; warns: string[] } {
  const warns: string[] = [];
  return {
    logger: {
      warn: (m) => warns.push(m),
      error: (m) => warns.push(m),
    },
    warns,
  };
}

describe('NoopTransport', () => {
  it('drops events silently', async () => {
    const t = new NoopTransport();
    await expect(t.send([makeEv(), makeEv(), makeEv()])).resolves.toBeUndefined();
  });
});

describe('BufferedTransport', () => {
  it('does not flush before bufferSize is reached', async () => {
    const inner = new RecordingTransport();
    const buf = new BufferedTransport({ inner, bufferSize: 4 });
    await buf.send([makeEv(), makeEv(), makeEv()]);
    expect(inner.batches).toHaveLength(0);
    expect(buf.pendingCount).toBe(3);
  });

  it('auto-flushes when bufferSize is reached', async () => {
    const inner = new RecordingTransport();
    const buf = new BufferedTransport({ inner, bufferSize: 3 });
    await buf.send([makeEv(), makeEv(), makeEv()]);
    expect(inner.batches).toHaveLength(1);
    expect(inner.batches[0]).toHaveLength(3);
    expect(buf.pendingCount).toBe(0);
  });

  it('auto-flushes when bufferSize is exceeded by a multi-event send', async () => {
    const inner = new RecordingTransport();
    const buf = new BufferedTransport({ inner, bufferSize: 2 });
    await buf.send([makeEv(), makeEv(), makeEv(), makeEv()]);
    expect(inner.batches).toHaveLength(1);
    expect(inner.batches[0]).toHaveLength(4);
  });

  it('flush() force-drains the buffer', async () => {
    const inner = new RecordingTransport();
    const buf = new BufferedTransport({ inner, bufferSize: 16 });
    await buf.send([makeEv()]);
    expect(inner.batches).toHaveLength(0);
    await buf.flush();
    expect(inner.batches).toHaveLength(1);
    expect(buf.pendingCount).toBe(0);
  });

  it('flush() on an empty buffer is a no-op', async () => {
    const inner = new RecordingTransport();
    const buf = new BufferedTransport({ inner, bufferSize: 16 });
    await buf.flush();
    expect(inner.batches).toHaveLength(0);
  });

  it('defaults bufferSize to 16', async () => {
    const inner = new RecordingTransport();
    const buf = new BufferedTransport({ inner });
    for (let i = 0; i < 15; i += 1) {
      await buf.send([makeEv()]);
    }
    expect(inner.batches).toHaveLength(0);
    await buf.send([makeEv()]);
    expect(inner.batches).toHaveLength(1);
  });
});

describe('HttpTransport', () => {
  it('POSTs to the configured URL with JSON body', async () => {
    const calls: Array<{ url: string; init: Parameters<FetchLike>[1] }> = [];
    const fakeFetch: FetchLike = async (url, init) => {
      calls.push({ url, init });
      return {
        status: 200,
        statusText: 'OK',
        async text() {
          return '';
        },
      };
    };
    const t = new HttpTransport({
      endpointUrl: 'https://example.test/telemetry',
      fetch: fakeFetch,
    });
    await t.send([makeEv()]);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe('https://example.test/telemetry');
    expect(calls[0]?.init.method).toBe('POST');
    expect(calls[0]?.init.headers['content-type']).toBe('application/json');
    const body = JSON.parse(calls[0]?.init.body ?? '{}') as {
      events: PackTelemetryEvent[];
    };
    expect(body.events).toHaveLength(1);
    expect(body.events[0]?.kind).toBe('usage');
  });

  it('includes Authorization: Bearer <token> when configured', async () => {
    let captured: Record<string, string> = {};
    const fakeFetch: FetchLike = async (_url, init) => {
      captured = init.headers;
      return {
        status: 200,
        statusText: 'OK',
        async text() {
          return '';
        },
      };
    };
    const t = new HttpTransport({
      endpointUrl: 'https://example.test/telemetry',
      bearerToken: 'sekret',
      fetch: fakeFetch,
    });
    await t.send([makeEv()]);
    expect(captured.authorization).toBe('Bearer sekret');
  });

  it('omits Authorization when no token is configured', async () => {
    let captured: Record<string, string> = {};
    const fakeFetch: FetchLike = async (_url, init) => {
      captured = init.headers;
      return {
        status: 200,
        statusText: 'OK',
        async text() {
          return '';
        },
      };
    };
    const t = new HttpTransport({
      endpointUrl: 'https://example.test/telemetry',
      fetch: fakeFetch,
    });
    await t.send([makeEv()]);
    expect(captured.authorization).toBeUndefined();
  });

  it('drops events on 4xx without retry and without throwing', async () => {
    let calls = 0;
    const fakeFetch: FetchLike = async () => {
      calls += 1;
      return {
        status: 400,
        statusText: 'Bad Request',
        async text() {
          return '';
        },
      };
    };
    const { logger, warns } = silentLogger();
    const t = new HttpTransport({
      endpointUrl: 'https://example.test/telemetry',
      fetch: fakeFetch,
      logger,
    });
    await expect(t.send([makeEv()])).resolves.toBeUndefined();
    expect(calls).toBe(1);
    expect(warns.join('\n')).toMatch(/HTTP 400/);
  });

  it('retries once on 5xx then drops', async () => {
    let calls = 0;
    const fakeFetch: FetchLike = async () => {
      calls += 1;
      return {
        status: 503,
        statusText: 'Service Unavailable',
        async text() {
          return '';
        },
      };
    };
    const { logger, warns } = silentLogger();
    const t = new HttpTransport({
      endpointUrl: 'https://example.test/telemetry',
      fetch: fakeFetch,
      logger,
    });
    await t.send([makeEv()]);
    expect(calls).toBe(2);
    expect(warns.join('\n')).toMatch(/retry/);
  });

  it('drops events on network error after one retry', async () => {
    let calls = 0;
    const fakeFetch: FetchLike = async () => {
      calls += 1;
      throw new Error('econnreset');
    };
    const { logger, warns } = silentLogger();
    const t = new HttpTransport({
      endpointUrl: 'https://example.test/telemetry',
      fetch: fakeFetch,
      logger,
    });
    await expect(t.send([makeEv()])).resolves.toBeUndefined();
    expect(calls).toBe(2);
    expect(warns.join('\n')).toMatch(/network error/);
  });

  it('skips fetch when given an empty batch', async () => {
    let calls = 0;
    const fakeFetch: FetchLike = async () => {
      calls += 1;
      return {
        status: 200,
        statusText: 'OK',
        async text() {
          return '';
        },
      };
    };
    const t = new HttpTransport({
      endpointUrl: 'https://example.test/telemetry',
      fetch: fakeFetch,
    });
    await t.send([]);
    expect(calls).toBe(0);
  });
});
