// packages/runtimes/audience/src/three-state-router.test.ts
// T-454 — `dispatchMount` tests:
//   - sessionId-only → mountLive fires
//   - provenance-only → mountStaticFallback fires
//   - neither → mountEmpty fires
//   - sessionId + provenance → mountLive fires (session wins per ADR-010 §D8)

import type { AudienceBackendProvider, AudienceProvenance } from '@stageflip/audience-contract';
import type { InteractiveClip } from '@stageflip/schema';
import { describe, expect, it, vi } from 'vitest';

import type { AudienceMountContext, AudienceMountHandle } from './contract.js';
import { dispatchMount } from './three-state-router.js';

function makeHandle(label: string): AudienceMountHandle {
  return {
    updateProps: vi.fn(),
    dispose: vi.fn(() => {
      void label;
    }),
  };
}

const noopProvider: AudienceBackendProvider = {
  id: 'audience-test',
  modality: { kind: 'audience-backend' },
  capability: {
    persistenceTier: 'durable',
    maxConcurrentVoters: 1,
    supportedClipKinds: ['live-poll-multiple-choice'],
    supportsMotionNative: false,
    voterIdentity: 'anonymous',
    supportsStaticFallback: true,
    maxIngestRateHz: 1,
    snapshotCadenceHz: 1,
  },
  license: { kind: 'apache-2.0' },
  sandbox: { kind: 'in-process' },
  async openSession() {
    throw new Error('not used');
  },
  async submitVote() {
    throw new Error('not used');
  },
  subscribe() {
    return {
      [Symbol.asyncIterator]() {
        return {
          async next() {
            return { value: undefined, done: true };
          },
        };
      },
    };
  },
  async closeSession() {
    throw new Error('not used');
  },
};

function makeCtx(overrides: Partial<AudienceMountContext> = {}): AudienceMountContext {
  // T-454 router tests don't need a real InteractiveClip — cast a minimal
  // shape so the type lines up without depending on `@stageflip/schema`'s
  // full clip-factory matrix.
  const clipStub = { kind: 'placeholder' } as unknown as InteractiveClip;
  const base: AudienceMountContext = {
    clip: clipStub,
    root: { tagName: 'DIV' } as unknown as HTMLElement,
    permissions: [],
    tenantPolicy: { canMount: () => true },
    emitTelemetry: () => undefined,
    signal: new AbortController().signal,
    provider: noopProvider,
    emitLossFlag: () => undefined,
  };
  return { ...base, ...overrides };
}

const provenance: AudienceProvenance = {
  provider: 'audience-native',
  sessionId: '01JBNX...',
  snapshotFrame: 0,
  voterCountAtCapture: 0,
  capturedAt: '2026-05-12T00:00:00.000Z',
  snapshotPolicy: 'final',
  clipKind: 'live-poll-multiple-choice',
  aggregation: {
    kind: 'live-poll-multiple-choice',
    optionCounts: [],
    totalVotes: 0,
  },
};

describe('dispatchMount — three-state routing', () => {
  it('sessionId present → mountLive fires', async () => {
    const mountLive = vi.fn(async () => makeHandle('live'));
    const mountStaticFallback = vi.fn(async () => makeHandle('fb'));
    const mountEmpty = vi.fn(async () => makeHandle('empty'));

    const result = await dispatchMount(makeCtx({ sessionId: '01JBNX...' }), {
      mountLive,
      mountStaticFallback,
      mountEmpty,
    });

    expect(result.route).toBe('live');
    expect(mountLive).toHaveBeenCalledTimes(1);
    expect(mountStaticFallback).not.toHaveBeenCalled();
    expect(mountEmpty).not.toHaveBeenCalled();
  });

  it('provenance present, no sessionId → mountStaticFallback fires', async () => {
    const mountLive = vi.fn(async () => makeHandle('live'));
    const mountStaticFallback = vi.fn(async () => makeHandle('fb'));
    const mountEmpty = vi.fn(async () => makeHandle('empty'));

    const result = await dispatchMount(makeCtx({ provenance }), {
      mountLive,
      mountStaticFallback,
      mountEmpty,
    });

    expect(result.route).toBe('staticFallback');
    expect(mountStaticFallback).toHaveBeenCalledTimes(1);
    expect(mountLive).not.toHaveBeenCalled();
    expect(mountEmpty).not.toHaveBeenCalled();
  });

  it('neither sessionId nor provenance → mountEmpty fires', async () => {
    const mountLive = vi.fn(async () => makeHandle('live'));
    const mountStaticFallback = vi.fn(async () => makeHandle('fb'));
    const mountEmpty = vi.fn(async () => makeHandle('empty'));

    const result = await dispatchMount(makeCtx(), {
      mountLive,
      mountStaticFallback,
      mountEmpty,
    });

    expect(result.route).toBe('empty-live-mount');
    expect(mountEmpty).toHaveBeenCalledTimes(1);
    expect(mountLive).not.toHaveBeenCalled();
    expect(mountStaticFallback).not.toHaveBeenCalled();
  });

  it('sessionId + provenance → mountLive wins (ADR-010 §D8)', async () => {
    const mountLive = vi.fn(async () => makeHandle('live'));
    const mountStaticFallback = vi.fn(async () => makeHandle('fb'));
    const mountEmpty = vi.fn(async () => makeHandle('empty'));

    const result = await dispatchMount(makeCtx({ sessionId: '01JBNX...', provenance }), {
      mountLive,
      mountStaticFallback,
      mountEmpty,
    });

    expect(result.route).toBe('live');
    expect(mountLive).toHaveBeenCalledTimes(1);
  });
});
