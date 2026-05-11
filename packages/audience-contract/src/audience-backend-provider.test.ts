// packages/audience-contract/src/audience-backend-provider.test.ts
// AudienceBackendProvider tests — interface compiles against AdapterDescriptor,
// per-method call shapes round-trip, AsyncIterable subscribe surface returns.

import { describe, expect, it } from 'vitest';

import type { AdapterDescriptor } from '@stageflip/adapters-core';

import type { AggregationSnapshot, FinalSnapshot } from './aggregation-snapshot.js';
import type {
  AudienceBackendProvider,
  CloseSessionCall,
  OpenSessionCall,
  SessionHandle,
  SubmitVoteCall,
  SubscribeCall,
  VoteAck,
} from './audience-backend-provider.js';
import type { AudienceCapabilityDescriptor } from './capability.js';

const capability: AudienceCapabilityDescriptor = {
  persistenceTier: 'durable',
  maxConcurrentVoters: 1000,
  supportedClipKinds: ['live-poll-multiple-choice', 'live-qa'],
  supportsMotionNative: false,
  voterIdentity: 'anonymous',
  supportsStaticFallback: true,
  maxIngestRateHz: 100,
  snapshotCadenceHz: 30,
};

function buildStubProvider(): AudienceBackendProvider {
  return {
    id: 'audience-stub',
    modality: { kind: 'audience-backend' },
    capability,
    license: { kind: 'apache-2.0' },
    sandbox: { kind: 'in-process' },

    async openSession(call: OpenSessionCall): Promise<SessionHandle> {
      return {
        sessionId: call.sessionId,
        joinUrl: `https://join.example/${call.sessionId}`,
        joinCode: 'ABCDEF',
      };
    },

    async submitVote(call: SubmitVoteCall): Promise<VoteAck> {
      return {
        eventId: `evt-${call.sessionId}-1`,
        serverTimestamp: '2026-05-11T00:00:00Z',
        accepted: true,
      };
    },

    async *subscribe(_call: SubscribeCall): AsyncIterable<AggregationSnapshot> {
      yield {
        sessionId: _call.sessionId,
        frameNo: 0,
        serverTimestamp: '2026-05-11T00:00:00Z',
        voterCount: 0,
        aggregation: {
          kind: 'live-poll-multiple-choice',
          optionCounts: [0, 0],
          totalVotes: 0,
        },
      };
    },

    async closeSession(call: CloseSessionCall): Promise<FinalSnapshot> {
      return {
        sessionId: call.sessionId,
        frameNo: 99,
        serverTimestamp: '2026-05-11T00:00:00Z',
        voterCount: 42,
        aggregation: {
          kind: 'live-poll-multiple-choice',
          optionCounts: [20, 22],
          totalVotes: 42,
        },
        closedAt: '2026-05-11T00:00:00Z',
        snapshotFrame: 99,
      };
    },
  };
}

describe('AudienceBackendProvider type', () => {
  it('compiles against AdapterDescriptor (modality + capability narrowed)', () => {
    const provider = buildStubProvider();
    const asBase = provider as unknown as AdapterDescriptor;
    expect(asBase.id).toBe('audience-stub');
    expect(provider.modality.kind).toBe('audience-backend');
    expect(provider.capability.snapshotCadenceHz).toBe(30);
  });

  it('openSession echoes the session id', async () => {
    const provider = buildStubProvider();
    const handle = await provider.openSession({
      tenantId: 't-1',
      projectId: 'p-1',
      sessionId: 's-1',
      clipKind: 'live-poll-multiple-choice',
    });
    expect(handle.sessionId).toBe('s-1');
    expect(handle.joinCode).toBe('ABCDEF');
  });

  it('submitVote returns a VoteAck', async () => {
    const provider = buildStubProvider();
    const ack = await provider.submitVote({
      sessionId: 's-1',
      voterToken: 'v-1',
      payload: { kind: 'live-poll-multiple-choice', optionIndex: 0 },
      clientTimestamp: '2026-05-11T00:00:00Z',
    });
    expect(ack.accepted).toBe(true);
    expect(ack.eventId).toMatch(/^evt-/);
  });

  it('subscribe yields AggregationSnapshot entries', async () => {
    const provider = buildStubProvider();
    const out: AggregationSnapshot[] = [];
    for await (const snap of provider.subscribe({ sessionId: 's-1', authToken: 'admin' })) {
      out.push(snap);
    }
    expect(out).toHaveLength(1);
    expect(out[0]?.aggregation.kind).toBe('live-poll-multiple-choice');
  });

  it('closeSession returns a FinalSnapshot', async () => {
    const provider = buildStubProvider();
    const final = await provider.closeSession({ sessionId: 's-1', authToken: 'admin' });
    expect(final.closedAt).toBeTruthy();
    expect(final.snapshotFrame).toBe(99);
    expect(final.voterCount).toBe(42);
  });

  it('OpenSessionCall accepts opaque options', () => {
    const call: OpenSessionCall = {
      tenantId: 't',
      projectId: 'p',
      sessionId: 's',
      clipKind: 'live-qa',
      options: { vendorPollId: 'p-x' },
    };
    expect(call.options?.vendorPollId).toBe('p-x');
  });
});
