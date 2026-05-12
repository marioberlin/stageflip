// packages/runtimes/audience/src/clips/survey/factory.test.ts
// T-468 — Factory tests for `surveyClipFactory`. Verifies:
//  - empty-live-mount route renders the "Waiting…" placeholder.
//  - staticFallback route renders from `provenance.aggregation`.
//  - live route opens a subscribe loop and re-renders on snapshots.
//  - `signal.abort()` disposes the React root cleanly.

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
import { surveyClipFactory } from './factory.js';

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
        kind: 'survey',
        questionAggregations: [],
        totalResponses: 0,
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

const VALID_PROPS = {
  questions: [
    {
      id: 'q1',
      type: 'multiple-choice',
      text: 'Which framework?',
      options: ['React', 'Vue', 'Svelte'],
    },
    { id: 'q2', type: 'open-text', text: 'Any comments?' },
    { id: 'q3', type: 'rating', text: 'Rate', scaleMin: 1, scaleMax: 5 },
  ],
};

function makeCtx(opts: {
  controller: AbortController;
  provider: AudienceBackendProvider;
  sessionId?: string;
  voterToken?: string;
  provenance?: AudienceMountContext['provenance'];
}): AudienceMountContext {
  const ctx = {
    clip: {
      props: VALID_PROPS,
      transform: { width: 400, height: 300 },
    },
    root: makeRoot(),
    permissions: ['audience-network'],
    tenantPolicy: { canMount: () => true },
    emitTelemetry: () => {},
    signal: opts.controller.signal,
    provider: opts.provider,
    emitLossFlag: () => {},
  } as unknown as AudienceMountContext;
  const mut = ctx as { -readonly [K in keyof AudienceMountContext]: AudienceMountContext[K] };
  if (opts.sessionId !== undefined) mut.sessionId = opts.sessionId;
  if (opts.voterToken !== undefined) mut.voterToken = opts.voterToken;
  if (opts.provenance !== undefined) mut.provenance = opts.provenance;
  return ctx;
}

beforeEach(() => {
  while (document.body.firstChild !== null) {
    document.body.removeChild(document.body.firstChild);
  }
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('surveyClipFactory', () => {
  it('renders the "Waiting…" placeholder when no sessionId and no provenance', async () => {
    const controller = new AbortController();
    const { provider } = makeStubProvider();
    const ctx = makeCtx({ controller, provider });
    const handle = await surveyClipFactory(ctx);
    expect(handle).toBeDefined();
    await new Promise<void>((r) => setTimeout(r, 50));
    const root = document.querySelector('[data-stageflip-clip="survey"]');
    expect(root).not.toBeNull();
    expect(root?.getAttribute('data-state')).toBe('waiting');
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
        voterCountAtCapture: 15,
        capturedAt: '2026-05-12T00:00:00.000Z',
        snapshotPolicy: 'final',
        clipKind: 'survey',
        aggregation: {
          kind: 'survey',
          questionAggregations: [
            {
              questionId: 'q1',
              type: 'multiple-choice',
              aggregation: {
                kind: 'live-poll-multiple-choice',
                optionCounts: [8, 5, 2],
                totalVotes: 15,
              },
            },
          ],
          totalResponses: 15,
        },
      },
    });
    const handle = await surveyClipFactory(ctx);
    await new Promise<void>((r) => setTimeout(r, 50));
    const root = document.querySelector('[data-stageflip-clip="survey"]');
    expect(root?.getAttribute('data-state')).toBe('aggregated');
    const cards = document.querySelectorAll('[data-testid^="survey-question-card-"]');
    expect(cards.length).toBe(1);
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
    const handle = await surveyClipFactory(ctx);
    await new Promise<void>((r) => setTimeout(r, 50));
    push({
      sessionId: 's-1',
      frameNo: 1,
      serverTimestamp: '2026-05-12T00:00:01.000Z',
      voterCount: 6,
      aggregation: {
        kind: 'survey',
        questionAggregations: [
          {
            questionId: 'q2',
            type: 'open-text',
            aggregation: {
              kind: 'live-poll-open-text',
              entries: [{ text: 'hi', count: 1 }],
              totalVotes: 1,
            },
          },
        ],
        totalResponses: 1,
      },
    });
    await new Promise<void>((r) => setTimeout(r, 10));
    const root = document.querySelector('[data-stageflip-clip="survey"]');
    expect(root?.getAttribute('data-state')).toBe('aggregated');
    const cards = document.querySelectorAll('[data-testid^="survey-question-card-"]');
    expect(cards.length).toBe(1);
    handle.dispose();
    close();
    controller.abort();
  });

  it('rejects when props are malformed', async () => {
    const controller = new AbortController();
    const { provider } = makeStubProvider();
    const ctx = {
      clip: {
        props: { questions: [] },
        transform: { width: 100, height: 100 },
      },
      root: makeRoot(),
      permissions: ['audience-network'],
      tenantPolicy: { canMount: () => true },
      emitTelemetry: () => {},
      signal: controller.signal,
      provider,
      emitLossFlag: () => {},
    } as unknown as AudienceMountContext;
    await expect(surveyClipFactory(ctx)).rejects.toThrow(/invalid props/);
    controller.abort();
  });

  it('disposes cleanly on signal.abort', async () => {
    const controller = new AbortController();
    const { provider } = makeStubProvider();
    const ctx = makeCtx({ controller, provider });
    const handle = await surveyClipFactory(ctx);
    await new Promise<void>((r) => setTimeout(r, 50));
    controller.abort();
    expect(() => handle.dispose()).not.toThrow();
  });
});
