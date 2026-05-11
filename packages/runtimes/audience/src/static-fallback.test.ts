// packages/runtimes/audience/src/static-fallback.test.ts
// T-454 — `StaticFallbackRenderer` tests:
//   - register / resolve round-trip
//   - duplicate-kind rejection
//   - render dispatches to the registered factory
//   - per-policy provenance (`final` / `peak` / `at-frame`) flows through
//   - missing-factory throws (programming error, not loss-flag)
//   - integrity mismatch emits LF-AUDIENCE-SNAPSHOT-MISSING + returns
//     `snapshot-missing`

import type { AudienceProvenance, AudienceSnapshotPolicy } from '@stageflip/audience-contract';
import { describe, expect, it, vi } from 'vitest';

import type { AudienceLossFlagEmission } from './contract.js';
import {
  StaticFallbackFactoryAlreadyRegisteredError,
  StaticFallbackFactoryNotRegisteredError,
  StaticFallbackRenderer,
  checkProvenanceIntegrity,
} from './static-fallback.js';

function makeProvenance(overrides: Partial<AudienceProvenance> = {}): AudienceProvenance {
  const base: AudienceProvenance = {
    provider: 'audience-native',
    sessionId: '01JBNX...',
    snapshotFrame: 42,
    voterCountAtCapture: 17,
    capturedAt: '2026-05-12T00:00:00.000Z',
    snapshotPolicy: 'final',
    clipKind: 'live-poll-multiple-choice',
    aggregation: {
      kind: 'live-poll-multiple-choice',
      optionCounts: [5, 6, 6],
      totalVotes: 17,
    },
  };
  return { ...base, ...overrides };
}

describe('StaticFallbackRenderer — registration', () => {
  it('register / resolve round-trip', () => {
    const r = new StaticFallbackRenderer();
    const f = vi.fn(() => 'out');
    r.register('survey', f);
    expect(r.resolve('survey')).toBe(f);
  });

  it('duplicate registration throws', () => {
    const r = new StaticFallbackRenderer();
    r.register('survey', () => undefined);
    expect(() => r.register('survey', () => undefined)).toThrow(
      StaticFallbackFactoryAlreadyRegisteredError,
    );
  });

  it('list returns sorted kinds', () => {
    const r = new StaticFallbackRenderer();
    r.register('survey', () => undefined);
    r.register('heatmap', () => undefined);
    r.register('live-qa', () => undefined);
    expect(r.list()).toEqual(['heatmap', 'live-qa', 'survey']);
  });

  it('unregister + clear are escape hatches', () => {
    const r = new StaticFallbackRenderer();
    r.register('survey', () => undefined);
    expect(r.unregister('survey')).toBe(true);
    expect(r.unregister('survey')).toBe(false);
    r.register('survey', () => undefined);
    r.clear();
    expect(r.resolve('survey')).toBeUndefined();
  });
});

describe('StaticFallbackRenderer — render dispatch', () => {
  it('dispatches to the registered factory and returns rendered', () => {
    const r = new StaticFallbackRenderer();
    const factory = vi.fn(() => ({ kind: 'react-element-placeholder' }));
    r.register('live-poll-multiple-choice', factory);

    const provenance = makeProvenance();
    const emitLossFlag = vi.fn();
    const result = r.render({ provenance, context: { foo: 1 }, emitLossFlag });

    expect(result.state).toBe('rendered');
    if (result.state === 'rendered') {
      expect(result.output).toEqual({ kind: 'react-element-placeholder' });
    }
    expect(factory).toHaveBeenCalledWith({ provenance, context: { foo: 1 } });
    expect(emitLossFlag).not.toHaveBeenCalled();
  });

  it('throws StaticFallbackFactoryNotRegisteredError when factory absent', () => {
    const r = new StaticFallbackRenderer();
    const provenance = makeProvenance();
    expect(() => r.render({ provenance, context: undefined, emitLossFlag: vi.fn() })).toThrow(
      StaticFallbackFactoryNotRegisteredError,
    );
  });

  it.each<AudienceSnapshotPolicy>(['final', 'peak', 'at-frame'])(
    'forwards snapshotPolicy=%s to the factory',
    (policy) => {
      const r = new StaticFallbackRenderer();
      const factory = vi.fn(({ provenance }) => provenance.snapshotPolicy);
      r.register('live-poll-multiple-choice', factory);
      const result = r.render({
        provenance: makeProvenance({ snapshotPolicy: policy }),
        context: undefined,
        emitLossFlag: vi.fn(),
      });
      expect(result.state).toBe('rendered');
      if (result.state === 'rendered') expect(result.output).toBe(policy);
    },
  );
});

describe('StaticFallbackRenderer — integrity check', () => {
  it('mismatched aggregation.kind emits LF-AUDIENCE-SNAPSHOT-MISSING', () => {
    const r = new StaticFallbackRenderer();
    r.register('live-poll-multiple-choice', () => 'never-reached');
    const provenance = makeProvenance({
      clipKind: 'live-poll-multiple-choice',
      aggregation: {
        kind: 'survey',
        questionAggregations: [],
        totalResponses: 0,
      },
    });
    const emissions: AudienceLossFlagEmission[] = [];
    const result = r.render({
      provenance,
      context: undefined,
      emitLossFlag: (e) => emissions.push(e),
    });

    expect(result.state).toBe('snapshot-missing');
    expect(emissions).toHaveLength(1);
    expect(emissions[0]?.code).toBe('LF-AUDIENCE-SNAPSHOT-MISSING');
  });

  it('checkProvenanceIntegrity catches mismatched discriminants', () => {
    const ok = checkProvenanceIntegrity(makeProvenance());
    expect(ok.ok).toBe(true);

    const bad = checkProvenanceIntegrity(
      makeProvenance({
        clipKind: 'heatmap',
      }),
    );
    expect(bad.ok).toBe(false);
    expect(bad.reason).toMatch(/heatmap/);
  });
});
