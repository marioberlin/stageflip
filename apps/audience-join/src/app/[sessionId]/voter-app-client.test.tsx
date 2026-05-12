// apps/audience-join/src/app/[sessionId]/voter-app-client.test.tsx
// T-456 — Verifies the voter-app client's join → subscribe → render
// lifecycle plus the LF-AUDIENCE-CONNECTION-LOST surface.

import type { AggregationSnapshot, AudienceBackendProvider } from '@stageflip/audience-contract';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { VoterAppClient } from './voter-app-client.js';

afterEach(() => {
  cleanup();
});

function makeSnapshot(): AggregationSnapshot {
  return {
    sessionId: 'sess-1',
    frameNo: 0,
    serverTimestamp: '2026-05-12T00:00:00.000Z',
    voterCount: 1,
    aggregation: {
      kind: 'live-poll-multiple-choice',
      optionCounts: [1, 0, 0],
      totalVotes: 1,
    },
  };
}

function makeProvider(
  iterableFactory: () => AsyncIterable<AggregationSnapshot>,
): AudienceBackendProvider {
  return {
    id: 'audience-test',
    modality: { kind: 'audience-backend' },
    capability: {
      persistenceTier: 'durable',
      maxConcurrentVoters: 100,
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
      throw new Error('not used in voter-app tests');
    },
    async submitVote() {
      throw new Error('not used in voter-app tests');
    },
    subscribe: () => iterableFactory(),
    async closeSession() {
      throw new Error('not used in voter-app tests');
    },
  } satisfies AudienceBackendProvider;
}

function snapshotsThenStall(
  values: AggregationSnapshot[],
): () => AsyncIterable<AggregationSnapshot> {
  return () => ({
    [Symbol.asyncIterator](): AsyncIterator<AggregationSnapshot> {
      let i = 0;
      return {
        async next() {
          if (i < values.length) {
            const v = values[i];
            i += 1;
            if (v === undefined) return { value: undefined, done: true };
            return { value: v, done: false };
          }
          // Stall forever — the test aborts via React unmount in cleanup.
          await new Promise(() => {});
          return { value: undefined, done: true };
        },
      };
    },
  });
}

function gracefulClose(): () => AsyncIterable<AggregationSnapshot> {
  return () => ({
    [Symbol.asyncIterator](): AsyncIterator<AggregationSnapshot> {
      return {
        async next() {
          // Throw a graceful-close-shaped error so runAudienceClient
          // resolves 'completed' immediately.
          throw { code: 4000, wasClean: true };
        },
      };
    },
  });
}

describe('<VoterAppClient>', () => {
  it('shows joining → connecting → connected on a successful flow', async () => {
    const fetchFn = vi.fn<typeof fetch>(
      async () =>
        new Response(JSON.stringify({ voterToken: 'tok', sessionId: 'sess-1' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
    );
    const provider = makeProvider(snapshotsThenStall([makeSnapshot()]));

    render(
      <VoterAppClient
        sessionId="sess-1"
        apiBaseUrl="http://localhost:3001"
        provider={provider}
        fetchFn={fetchFn as unknown as typeof fetch}
      />,
    );

    await waitFor(() => {
      const banner = screen.getByTestId('connection-status-banner');
      expect(banner.getAttribute('data-state')).toBe('connected');
    });

    // Once connected with a snapshot, the dispatcher should pick the
    // clip kind from the aggregation and render the unregistered fallback.
    expect(screen.getByTestId('voter-input-unregistered')).toBeDefined();
  });

  it('shows error banner when join fetch fails', async () => {
    const fetchFn = vi.fn<typeof fetch>(async () => new Response('nope', { status: 500 }));
    const provider = makeProvider(gracefulClose());

    render(
      <VoterAppClient
        sessionId="sess-1"
        apiBaseUrl="http://localhost:3001"
        provider={provider}
        fetchFn={fetchFn as unknown as typeof fetch}
      />,
    );

    await waitFor(() => {
      const banner = screen.getByTestId('connection-status-banner');
      expect(banner.getAttribute('data-state')).toBe('error');
    });
  });

  it('hits the /v1/audience/sessions/:id/join endpoint with POST', async () => {
    const fetchFn = vi.fn<typeof fetch>(
      async () =>
        new Response(JSON.stringify({ voterToken: 'tok', sessionId: 'x' }), { status: 200 }),
    );
    const provider = makeProvider(gracefulClose());

    render(
      <VoterAppClient
        sessionId="abc"
        apiBaseUrl="http://localhost:3001/"
        provider={provider}
        fetchFn={fetchFn as unknown as typeof fetch}
      />,
    );

    await waitFor(() => {
      expect(fetchFn).toHaveBeenCalled();
    });
    const firstCall = fetchFn.mock.calls[0];
    expect(firstCall).toBeDefined();
    if (!firstCall) throw new Error('unreachable');
    const [calledUrl, calledInit] = firstCall;
    expect(calledUrl).toBe('http://localhost:3001/v1/audience/sessions/abc/join');
    expect(calledInit).toBeDefined();
    expect((calledInit as RequestInit | undefined)?.method).toBe('POST');
  });
});
