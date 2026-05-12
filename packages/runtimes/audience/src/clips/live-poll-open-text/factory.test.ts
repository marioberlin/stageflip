// packages/runtimes/audience/src/clips/live-poll-open-text/factory.test.ts
// T-462 — Factory tests for `livePollOpenTextClipFactory`. Verifies:
//  - empty-live-mount route renders the empty-rows empty-state.
//  - staticFallback route renders from `provenance.aggregation`.
//  - live route opens a subscribe loop and re-renders on snapshots.
//  - `signal.abort()` disposes the React root cleanly.
//
// Uses happy-dom (configured at the package vitest level) for the React
// 19 root API.

/**
 * @vitest-environment happy-dom
 */

import type {
  AggregationSnapshot,
  AudienceBackendProvider,
  AudienceCapabilityDescriptor,
  CloseSessionCall,
  FinalSnapshot,
  OpenSessionCall,
  SubmitVoteCall,
  SubscribeCall,
} from '@stageflip/audience-contract';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { AudienceMountContext } from '../../contract.js';
import { livePollOpenTextClipFactory } from './factory.js';

/**
 * Build a stub provider whose `subscribe` yields a controlled async
 * iterable. `push(snapshot)` queues a snapshot; `close()` ends the
 * iterator gracefully.
 */
function makeStubProvider(): {
  provider: AudienceBackendProvider;
  push: (s: AggregationSnapshot) => void;
  close: () => void;
} {
  let resolveNext: ((v: IteratorResult<AggregationSnapshot>) => void) | null = null;
  const queue: AggregationSnapshot[] = [];
  let closed = false;

  const next = (): Promise<IteratorResult<AggregationSnapshot>> =>
    new Promise((resolve) => {
      if (queue.length > 0) {
        const value = queue.shift();
        if (value !== undefined) {
          resolve({ value, done: false });
          return;
        }
      }
      if (closed) {
        resolve({ value: undefined as unknown as AggregationSnapshot, done: true });
        return;
      }
      resolveNext = resolve;
    });

  const provider: AudienceBackendProvider = {
    descriptor: {
      id: 'stub',
      label: 'Stub',
      capabilities: {
        snapshotCadenceHz: 1,
        supportsVoterToken: true,
      } as unknown as AudienceCapabilityDescriptor['capabilities'],
    } as unknown as AudienceCapabilityDescriptor,
    openSession: async (_: OpenSessionCall) => ({
      sessionId: 's-1',
      presenterToken: 'p',
      adminToken: 'a',
    }),
    closeSession: async (_: CloseSessionCall): Promise<FinalSnapshot> => ({
      sessionId: 's-1',
      frameNo: 0,
      serverTimestamp: '2026-05-12T00:00:00.000Z',
      voterCount: 0,
      aggregation: {
        kind: 'live-poll-open-text',
        entries: [],
        totalVotes: 0,
      },
      closedAt: '2026-05-12T00:00:00.000Z',
      snapshotFrame: 0,
    }),
    submitVote: async (_: SubmitVoteCall) => ({ accepted: true }),
    subscribe(_: SubscribeCall): AsyncIterable<AggregationSnapshot> {
      return {
        [Symbol.asyncIterator]: () => ({ next }),
      };
    },
  };

  return {
    provider,
    push: (s) => {
      if (resolveNext !== null) {
        const cb = resolveNext;
        resolveNext = null;
        cb({ value: s, done: false });
      } else {
        queue.push(s);
      }
    },
    close: () => {
      closed = true;
      if (resolveNext !== null) {
        const cb = resolveNext;
        resolveNext = null;
        cb({ value: undefined as unknown as AggregationSnapshot, done: true });
      }
    },
  };
}

function makeRoot(): HTMLElement {
  const root = document.createElement('div');
  document.body.appendChild(root);
  return root;
}

function makeCtx(opts: {
  controller: AbortController;
  provider: AudienceBackendProvider;
  sessionId?: string;
  voterToken?: string;
  provenance?: AudienceMountContext['provenance'];
}): AudienceMountContext {
  const ctx = {
    clip: {
      props: { question: 'What did you think?', maxLength: 280 },
      transform: { width: 400, height: 200 },
    },
    root: makeRoot(),
    permissions: ['audience-network'],
    tenantPolicy: { canMount: () => true },
    emitTelemetry: () => {},
    signal: opts.controller.signal,
    provider: opts.provider,
    emitLossFlag: () => {},
  } as unknown as AudienceMountContext;
  // Mutate optional fields to honor exactOptionalPropertyTypes.
  const mut = ctx as { -readonly [K in keyof AudienceMountContext]: AudienceMountContext[K] };
  if (opts.sessionId !== undefined) mut.sessionId = opts.sessionId;
  if (opts.voterToken !== undefined) mut.voterToken = opts.voterToken;
  if (opts.provenance !== undefined) mut.provenance = opts.provenance;
  return ctx;
}

beforeEach(() => {
  // Remove every child from <body> without touching innerHTML.
  while (document.body.firstChild !== null) {
    document.body.removeChild(document.body.firstChild);
  }
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('livePollOpenTextClipFactory', () => {
  it('renders the empty-state when no sessionId and no provenance', async () => {
    const controller = new AbortController();
    const { provider } = makeStubProvider();
    const ctx = makeCtx({ controller, provider });
    const handle = await livePollOpenTextClipFactory(ctx);
    expect(handle).toBeDefined();
    await new Promise<void>((r) => setTimeout(r, 50));
    const root = document.querySelector('[data-stageflip-clip="live-poll-open-text"]');
    expect(root).not.toBeNull();
    handle.dispose();
    controller.abort();
  });

  it('renders staticFallback from provenance.aggregation when sessionId is absent', async () => {
    const controller = new AbortController();
    const { provider } = makeStubProvider();
    const ctx = makeCtx({
      controller,
      provider,
      provenance: {
        provider: 'stub',
        sessionId: 's-1',
        snapshotFrame: 0,
        voterCountAtCapture: 10,
        capturedAt: '2026-05-12T00:00:00.000Z',
        snapshotPolicy: 'final',
        clipKind: 'live-poll-open-text',
        aggregation: {
          kind: 'live-poll-open-text',
          entries: [
            { text: 'great', count: 6 },
            { text: 'meh', count: 4 },
          ],
          totalVotes: 10,
        },
      },
    });
    const handle = await livePollOpenTextClipFactory(ctx);
    await new Promise<void>((r) => setTimeout(r, 50));
    const total = document.querySelector('[data-testid="live-poll-ot-total"]');
    expect(total?.textContent).toBe('10 responses');
    handle.dispose();
    controller.abort();
  });

  it('opens a subscribe loop on the live route and re-renders on snapshots', async () => {
    const controller = new AbortController();
    const { provider, push, close } = makeStubProvider();
    const ctx = makeCtx({
      controller,
      provider,
      sessionId: 's-1',
      voterToken: 'v-tok',
    });
    const handle = await livePollOpenTextClipFactory(ctx);
    await new Promise<void>((r) => setTimeout(r, 50));
    push({
      sessionId: 's-1',
      frameNo: 1,
      serverTimestamp: '2026-05-12T00:00:01.000Z',
      voterCount: 7,
      aggregation: {
        kind: 'live-poll-open-text',
        entries: [
          { text: 'thumbs up', count: 4 },
          { text: 'thumbs down', count: 3 },
        ],
        totalVotes: 7,
      },
    });
    // Allow promise-microtask propagation for the subscribe iterator.
    await new Promise<void>((r) => setTimeout(r, 10));
    const total = document.querySelector('[data-testid="live-poll-ot-total"]');
    expect(total?.textContent).toBe('7 responses');
    handle.dispose();
    close();
    controller.abort();
  });

  it('rejects when props are malformed', async () => {
    const controller = new AbortController();
    const { provider } = makeStubProvider();
    const ctx = {
      clip: { props: { question: '', maxLength: 0 }, transform: { width: 100, height: 100 } },
      root: makeRoot(),
      permissions: ['audience-network'],
      tenantPolicy: { canMount: () => true },
      emitTelemetry: () => {},
      signal: controller.signal,
      provider,
      emitLossFlag: () => {},
    } as unknown as AudienceMountContext;
    await expect(livePollOpenTextClipFactory(ctx)).rejects.toThrow(/invalid props/);
    controller.abort();
  });

  it('disposes cleanly on signal.abort', async () => {
    const controller = new AbortController();
    const { provider } = makeStubProvider();
    const ctx = makeCtx({ controller, provider });
    const handle = await livePollOpenTextClipFactory(ctx);
    await new Promise<void>((r) => setTimeout(r, 50));
    controller.abort();
    expect(() => handle.dispose()).not.toThrow();
  });
});
