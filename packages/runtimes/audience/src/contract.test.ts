// packages/runtimes/audience/src/contract.test.ts
// T-454 — `AudienceMountContext` / `AudienceMountHandle` contract tests.
// Type-level: `AudienceMountContext` is assignable to T-306's `MountContext`.
// Runtime-level: `routeMountState` dispatches per ADR-010 §D8.

import type { MountContext, MountHandle } from '@stageflip/runtimes-interactive';
import { describe, expect, expectTypeOf, it } from 'vitest';

import type { AudienceClipFactory, AudienceMountContext, AudienceMountHandle } from './contract.js';
import { routeMountState } from './contract.js';

describe('AudienceMountContext type extension', () => {
  it('is assignable to MountContext (audience extends interactive)', () => {
    expectTypeOf<AudienceMountContext>().toMatchTypeOf<MountContext>();
  });

  it('AudienceMountHandle === MountHandle (no audience-specific imperative surface)', () => {
    expectTypeOf<AudienceMountHandle>().toEqualTypeOf<MountHandle>();
  });

  it('AudienceClipFactory returns Promise<AudienceMountHandle>', () => {
    expectTypeOf<AudienceClipFactory>().returns.toEqualTypeOf<Promise<AudienceMountHandle>>();
  });
});

describe('routeMountState — ADR-010 §D8 three-state router', () => {
  it('sessionId present → live', () => {
    expect(routeMountState({ sessionId: '01JBNX...' })).toBe('live');
  });

  it('sessionId present + provenance present → live (session wins)', () => {
    expect(
      routeMountState({
        sessionId: '01JBNX...',
        provenance: {
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
        },
      }),
    ).toBe('live');
  });

  it('provenance present, sessionId absent → staticFallback', () => {
    expect(
      routeMountState({
        provenance: {
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
        },
      }),
    ).toBe('staticFallback');
  });

  it('neither sessionId nor provenance → empty-live-mount', () => {
    expect(routeMountState({})).toBe('empty-live-mount');
  });
});
