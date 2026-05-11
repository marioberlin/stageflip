// packages/runtimes/audience/src/audience-client.test.ts
// T-454 — `AudienceClient` (runAudienceClient) tests:
//   - happy-path subscription delivers snapshots in order
//   - graceful close (code 4000) short-circuits, no reconnect
//   - non-graceful error triggers reconnect with backoff per ADR-009 §D6
//   - reconnect budget exhaustion emits `LF-AUDIENCE-CONNECTION-LOST`
//   - abort signal disposes mid-stream + mid-backoff
//   - backoff schedule matches `min(2^attempt × 1s, 30s)`

import type { AggregationSnapshot, AudienceBackendProvider } from '@stageflip/audience-contract';
import { describe, expect, it, vi } from 'vitest';

import {
  type AudienceClientOptions,
  GRACEFUL_CLOSE_CODE,
  RECONNECT_MAX_ATTEMPTS,
  RECONNECT_MAX_DELAY_MS,
  computeBackoffMs,
  runAudienceClient,
} from './audience-client.js';
import type { AudienceLossFlagEmission } from './contract.js';

// ---- helpers --------------------------------------------------------------

function makeSnapshot(voterCount: number): AggregationSnapshot {
  return {
    sessionId: '01JBNX...',
    frameNo: voterCount,
    serverTimestamp: '2026-05-12T00:00:00.000Z',
    voterCount,
    aggregation: {
      kind: 'live-poll-multiple-choice',
      optionCounts: [voterCount],
      totalVotes: voterCount,
    },
  };
}

function snapshotIterable(values: AggregationSnapshot[]): AsyncIterable<AggregationSnapshot> {
  return {
    [Symbol.asyncIterator](): AsyncIterator<AggregationSnapshot> {
      let i = 0;
      return {
        async next() {
          if (i >= values.length) return { value: undefined, done: true };
          const v = values[i];
          i += 1;
          if (v === undefined) return { value: undefined, done: true };
          return { value: v, done: false };
        },
      };
    },
  };
}

function throwingIterable(err: unknown): AsyncIterable<AggregationSnapshot> {
  return {
    [Symbol.asyncIterator](): AsyncIterator<AggregationSnapshot> {
      return {
        async next() {
          throw err;
        },
      };
    },
  };
}

function makeProvider(
  subscribeImpl: () => AsyncIterable<AggregationSnapshot>,
): AudienceBackendProvider {
  return {
    id: 'audience-test',
    modality: { kind: 'audience-backend' },
    capability: {
      persistenceTier: 'durable',
      maxConcurrentVoters: 1_000,
      supportedClipKinds: ['live-poll-multiple-choice'],
      supportsMotionNative: false,
      voterIdentity: 'anonymous',
      supportsStaticFallback: true,
      maxIngestRateHz: 30,
      snapshotCadenceHz: 30,
    },
    license: { kind: 'apache-2.0' },
    sandbox: { kind: 'in-process' },
    async openSession() {
      throw new Error('not used in client tests');
    },
    async submitVote() {
      throw new Error('not used in client tests');
    },
    subscribe: subscribeImpl,
    async closeSession() {
      throw new Error('not used in client tests');
    },
  } satisfies AudienceBackendProvider;
}

interface FakeTimer {
  readonly handle: number;
  readonly fn: () => void;
  readonly ms: number;
  fired: boolean;
  cancelled: boolean;
}

function makeFakeTimers(): {
  readonly setTimeoutFn: (fn: () => void, ms: number) => unknown;
  readonly clearTimeoutFn: (handle: unknown) => void;
  readonly advance: () => Promise<void>;
  readonly schedule: readonly FakeTimer[];
} {
  const schedule: FakeTimer[] = [];
  let next = 1;

  return {
    setTimeoutFn: (fn: () => void, ms: number): unknown => {
      const t: FakeTimer = { handle: next, fn, ms, fired: false, cancelled: false };
      next += 1;
      schedule.push(t);
      return t.handle;
    },
    clearTimeoutFn: (handle: unknown): void => {
      const t = schedule.find((s) => s.handle === handle);
      if (t !== undefined) t.cancelled = true;
    },
    advance: async () => {
      // fire all pending, non-cancelled timers in scheduled order
      for (const t of schedule) {
        if (!t.fired && !t.cancelled) {
          t.fired = true;
          t.fn();
        }
      }
      // let microtasks flush
      await Promise.resolve();
      await Promise.resolve();
    },
    schedule,
  };
}

function baseOptions(
  override: Partial<AudienceClientOptions> & {
    readonly provider: AudienceBackendProvider;
    readonly emitLossFlag?: (e: AudienceLossFlagEmission) => void;
    readonly onSnapshot?: (s: AggregationSnapshot) => void;
  },
): AudienceClientOptions {
  const controller = new AbortController();
  return {
    provider: override.provider,
    subscribeCall: { sessionId: '01JBNX...', authToken: 'tok' },
    onSnapshot: override.onSnapshot ?? ((_: AggregationSnapshot) => undefined),
    emitLossFlag: override.emitLossFlag ?? ((_: AudienceLossFlagEmission) => undefined),
    signal: override.signal ?? controller.signal,
    ...(override.onReconnectAttempt !== undefined
      ? { onReconnectAttempt: override.onReconnectAttempt }
      : {}),
    ...(override.setTimeoutFn !== undefined ? { setTimeoutFn: override.setTimeoutFn } : {}),
    ...(override.clearTimeoutFn !== undefined ? { clearTimeoutFn: override.clearTimeoutFn } : {}),
  };
}

// ---- tests ----------------------------------------------------------------

describe('runAudienceClient — happy path', () => {
  it('delivers snapshots in order then completes on iterator-end', async () => {
    const snaps = [makeSnapshot(1), makeSnapshot(2), makeSnapshot(3)];
    const provider = makeProvider(() => snapshotIterable(snaps));
    const onSnapshot = vi.fn();
    const emitLossFlag = vi.fn();

    // iterator-end without graceful-close is reconnect-worthy in
    // production. To assert the happy-path-with-natural-end we use the
    // abort signal to stop the loop after the third snapshot arrives.
    const controller = new AbortController();
    let i = 0;
    const result = await runAudienceClient(
      baseOptions({
        provider,
        onSnapshot: (s) => {
          onSnapshot(s);
          i += 1;
          if (i === snaps.length) controller.abort();
        },
        emitLossFlag,
        signal: controller.signal,
      }),
    );

    expect(onSnapshot).toHaveBeenCalledTimes(3);
    expect(onSnapshot).toHaveBeenNthCalledWith(1, snaps[0]);
    expect(onSnapshot).toHaveBeenNthCalledWith(2, snaps[1]);
    expect(onSnapshot).toHaveBeenNthCalledWith(3, snaps[2]);
    expect(result).toBe('completed');
    expect(emitLossFlag).not.toHaveBeenCalled();
  });
});

describe('runAudienceClient — graceful close (code 4000)', () => {
  it('treats close code 4000 as completed; no reconnect', async () => {
    const provider = makeProvider(() => throwingIterable({ code: GRACEFUL_CLOSE_CODE }));
    const emitLossFlag = vi.fn();
    const onReconnectAttempt = vi.fn();

    const result = await runAudienceClient(
      baseOptions({
        provider,
        emitLossFlag,
        onReconnectAttempt,
      }),
    );

    expect(result).toBe('completed');
    expect(emitLossFlag).not.toHaveBeenCalled();
    expect(onReconnectAttempt).not.toHaveBeenCalled();
  });

  it('treats GracefulCloseError name as completed too', async () => {
    class GracefulCloseError extends Error {
      override name = 'GracefulCloseError';
    }
    const provider = makeProvider(() => throwingIterable(new GracefulCloseError('bye')));
    const result = await runAudienceClient(baseOptions({ provider }));
    expect(result).toBe('completed');
  });
});

describe('runAudienceClient — reconnect budget', () => {
  it('emits LF-AUDIENCE-CONNECTION-LOST after RECONNECT_MAX_ATTEMPTS', async () => {
    const provider = makeProvider(() => throwingIterable(new Error('boom')));
    const emissions: AudienceLossFlagEmission[] = [];
    const observed: { attempt: number; delayMs: number }[] = [];
    const timers = makeFakeTimers();

    const promise = runAudienceClient(
      baseOptions({
        provider,
        emitLossFlag: (e) => emissions.push(e),
        onReconnectAttempt: ({ attempt, delayMs }) => {
          observed.push({ attempt, delayMs });
        },
        setTimeoutFn: timers.setTimeoutFn,
        clearTimeoutFn: timers.clearTimeoutFn,
      }),
    );

    // The loop schedules a backoff after each error; advance until done.
    for (let i = 0; i < RECONNECT_MAX_ATTEMPTS + 2; i += 1) {
      await timers.advance();
    }
    const result = await promise;

    expect(result).toBe('budget-exhausted');
    expect(emissions).toHaveLength(1);
    expect(emissions[0]?.code).toBe('LF-AUDIENCE-CONNECTION-LOST');
    expect(observed).toHaveLength(RECONNECT_MAX_ATTEMPTS);
    // Backoff schedule per ADR-009 §D6: 2 / 4 / 8 / 16 / 30 / 30 s
    expect(observed.map((o) => o.delayMs)).toEqual([2000, 4000, 8000, 16000, 30000, 30000]);
  });

  it('successful reconnect resets the loop and re-subscribes', async () => {
    let calls = 0;
    const provider = makeProvider(() => {
      calls += 1;
      if (calls === 1) return throwingIterable(new Error('boom'));
      return snapshotIterable([makeSnapshot(7)]);
    });
    const onSnapshot = vi.fn();
    const emitLossFlag = vi.fn();
    const timers = makeFakeTimers();

    const controller = new AbortController();
    const promise = runAudienceClient(
      baseOptions({
        provider,
        onSnapshot: (s) => {
          onSnapshot(s);
          controller.abort();
        },
        emitLossFlag,
        signal: controller.signal,
        setTimeoutFn: timers.setTimeoutFn,
        clearTimeoutFn: timers.clearTimeoutFn,
      }),
    );
    await timers.advance();
    await timers.advance();
    const result = await promise;

    expect(result).toBe('completed');
    expect(onSnapshot).toHaveBeenCalledTimes(1);
    expect(onSnapshot).toHaveBeenCalledWith(makeSnapshot(7));
    expect(emitLossFlag).not.toHaveBeenCalled();
  });
});

describe('runAudienceClient — abort handling', () => {
  it('abort mid-stream resolves to completed', async () => {
    const provider = makeProvider(() => snapshotIterable([makeSnapshot(1)]));
    const controller = new AbortController();
    const onSnapshot = vi.fn((_: AggregationSnapshot) => {
      controller.abort();
    });
    const result = await runAudienceClient(
      baseOptions({ provider, onSnapshot, signal: controller.signal }),
    );
    expect(result).toBe('completed');
    expect(onSnapshot).toHaveBeenCalledTimes(1);
  });

  it('abort during backoff cancels the timer and resolves to completed', async () => {
    const provider = makeProvider(() => throwingIterable(new Error('boom')));
    const controller = new AbortController();
    const timers = makeFakeTimers();
    const emitLossFlag = vi.fn();

    const promise = runAudienceClient(
      baseOptions({
        provider,
        emitLossFlag,
        signal: controller.signal,
        setTimeoutFn: timers.setTimeoutFn,
        clearTimeoutFn: timers.clearTimeoutFn,
      }),
    );

    // let the first error happen + schedule the first backoff
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    controller.abort();
    const result = await promise;

    expect(result).toBe('completed');
    expect(emitLossFlag).not.toHaveBeenCalled();
    // the scheduled timer should be cancelled
    const firstTimer = timers.schedule[0];
    expect(firstTimer?.cancelled).toBe(true);
  });

  it('pre-aborted signal completes without invoking the iterator', async () => {
    const subscribeSpy = vi.fn(() => snapshotIterable([]));
    const provider = makeProvider(subscribeSpy);
    const controller = new AbortController();
    controller.abort();

    const result = await runAudienceClient(baseOptions({ provider, signal: controller.signal }));

    expect(result).toBe('completed');
    expect(subscribeSpy).not.toHaveBeenCalled();
  });
});

describe('computeBackoffMs (ADR-009 §D6)', () => {
  it('matches min(2^attempt × 1s, 30s)', () => {
    expect(computeBackoffMs(1)).toBe(2000);
    expect(computeBackoffMs(2)).toBe(4000);
    expect(computeBackoffMs(3)).toBe(8000);
    expect(computeBackoffMs(4)).toBe(16000);
    expect(computeBackoffMs(5)).toBe(RECONNECT_MAX_DELAY_MS);
    expect(computeBackoffMs(6)).toBe(RECONNECT_MAX_DELAY_MS);
    expect(computeBackoffMs(10)).toBe(RECONNECT_MAX_DELAY_MS);
  });

  it('rejects attempt < 1', () => {
    expect(() => computeBackoffMs(0)).toThrow(RangeError);
  });
});
