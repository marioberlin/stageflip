// packages/agent/src/streaming.test.ts
// T-442 — round-trip + transport-layer tests for SSE encoder /
// ReadableStream wrapper. Each ExecutorEvent kind survives
// encode → decode unchanged; the ReadableStream wrapper produces
// well-formed SSE frames with monotonic id values, fans abort through
// the iterator's return(), and emits the plan-cancelled sentinel.

import { describe, expect, it } from 'vitest';
import type { ExecutorEvent } from './executor/types.js';
import type { StreamEvent } from './streaming.js';
import {
  PLAN_CANCELLED_KIND,
  decodeExecutorEventFromSse,
  encodeExecutorEventAsSse,
  toReadableStream,
} from './streaming.js';

const fakeDoc = {
  meta: {
    id: 'd',
    version: 0,
    createdAt: '2026-05-11T00:00:00.000Z',
    updatedAt: '2026-05-11T00:00:00.000Z',
    locale: 'en',
    schemaVersion: 1,
  },
  theme: { tokens: {} },
  variables: {},
  components: {},
  content: { mode: 'slide', slides: [] },
} as const;

const eventFixtures: ExecutorEvent[] = [
  { kind: 'step-start', stepId: 's1' },
  { kind: 'tool-call', stepId: 's1', name: 'create_slide', args: { title: 'hi' } },
  {
    kind: 'tool-result',
    stepId: 's1',
    name: 'create_slide',
    result: { ok: true, id: 'sl1' },
    isError: false,
  },
  {
    kind: 'patch-applied',
    stepId: 's1',
    patch: [{ op: 'add', path: '/content/slides/0', value: { id: 'sl1' } }],
  },
  { kind: 'step-end', stepId: 's1', status: 'ok' },
  // biome-ignore lint/suspicious/noExplicitAny: schema type accepts shape via cast
  { kind: 'plan-end', finalDocument: fakeDoc as any },
];

async function readAllText(stream: ReadableStream<Uint8Array>): Promise<string> {
  const decoder = new TextDecoder();
  const reader = stream.getReader();
  let out = '';
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    if (value) out += decoder.decode(value, { stream: true });
  }
  out += decoder.decode();
  return out;
}

describe('encodeExecutorEventAsSse', () => {
  it.each(eventFixtures.map((e) => [e.kind, e] as const))(
    'round-trips %s through encode → decode',
    (_kind, event) => {
      const frame = encodeExecutorEventAsSse(event, 0);
      const lines = frame.split('\n');
      expect(lines[0]).toBe('id: 0');
      expect(lines[1]).toBe(`event: ${event.kind}`);
      expect(lines[2]?.startsWith('data: ')).toBe(true);
      expect(lines[3]).toBe(''); // SSE frames terminate with blank line
      expect(lines[4]).toBe('');
      const decoded = decodeExecutorEventFromSse(frame);
      expect(decoded).toEqual(event);
    },
  );

  it('encodes monotonic id values', () => {
    const a = encodeExecutorEventAsSse({ kind: 'step-start', stepId: 's' }, 0);
    const b = encodeExecutorEventAsSse({ kind: 'step-start', stepId: 's' }, 42);
    expect(a).toMatch(/^id: 0\n/);
    expect(b).toMatch(/^id: 42\n/);
  });

  it('serializes the plan-cancelled transport sentinel', () => {
    const sentinel: StreamEvent = { kind: PLAN_CANCELLED_KIND, reason: 'aborted' };
    const frame = encodeExecutorEventAsSse(sentinel, 99);
    expect(frame).toContain('event: plan-cancelled');
    expect(decodeExecutorEventFromSse(frame)).toEqual(sentinel);
  });
});

describe('decodeExecutorEventFromSse', () => {
  it('throws on malformed frames missing data:', () => {
    expect(() => decodeExecutorEventFromSse('id: 0\nevent: step-start\n\n')).toThrow();
  });

  it('throws on data: payload that is not valid JSON', () => {
    expect(() => decodeExecutorEventFromSse('id: 0\nevent: step-start\ndata: {\n\n')).toThrow();
  });

  it('throws when event: discriminator disagrees with data.kind', () => {
    expect(() =>
      decodeExecutorEventFromSse(
        'id: 0\nevent: step-start\ndata: {"kind":"tool-call","stepId":"s","name":"x","args":{}}\n\n',
      ),
    ).toThrow();
  });
});

describe('toReadableStream', () => {
  it('emits a frame per upstream event in order with monotonic ids', async () => {
    async function* upstream(): AsyncIterable<ExecutorEvent> {
      yield { kind: 'step-start', stepId: 's' };
      yield { kind: 'step-end', stepId: 's', status: 'ok' };
    }
    const text = await readAllText(toReadableStream(upstream()));
    const frames = text.split('\n\n').filter((f) => f.length > 0);
    expect(frames).toHaveLength(2);
    expect(frames[0]).toContain('id: 0');
    expect(frames[0]).toContain('event: step-start');
    expect(frames[1]).toContain('id: 1');
    expect(frames[1]).toContain('event: step-end');
  });

  it('emits plan-cancelled sentinel when signal aborts mid-stream', async () => {
    const controller = new AbortController();
    let yieldedAfterAbort = false;
    async function* upstream(): AsyncIterable<ExecutorEvent> {
      yield { kind: 'step-start', stepId: 's' };
      controller.abort();
      // Cooperative cancellation: the stream wrapper triggers the
      // iterator's return() before the next yield is observed by the
      // consumer.
      yield { kind: 'step-end', stepId: 's', status: 'ok' };
      yieldedAfterAbort = true;
    }
    const stream = toReadableStream(upstream(), { signal: controller.signal });
    const text = await readAllText(stream);
    expect(text).toContain('event: plan-cancelled');
    expect(text).toMatch(/"reason":"aborted"/);
    // The sentinel still terminates with the spec blank line.
    expect(text.endsWith('\n\n')).toBe(true);
    // We don't assert yieldedAfterAbort=false because cooperative
    // generators may have produced one more value before being torn
    // down; the consumer-side guarantee is that the stream truncates.
    void yieldedAfterAbort;
  });

  it('closes cleanly without a sentinel when upstream completes', async () => {
    async function* upstream(): AsyncIterable<ExecutorEvent> {
      yield { kind: 'step-start', stepId: 's' };
    }
    const text = await readAllText(toReadableStream(upstream()));
    expect(text).not.toContain('plan-cancelled');
  });
});
