// packages/capability-router/src/ranking.test.ts
// Ranking comparator tests. Asserts per AC #5 + AC #10 + AC #11:
//   - cheapest / fastest / highest-quality / balanced order adapters as
//     documented
//   - ties break on ascending `id`
//   - missing cost / latency hints sort last (infinity sentinel)
//   - default scorer for highest-quality is `() => 0` (alphabetic tie-break)
//   - `comparatorFor()` dispatches exhaustively over RANKING_PREFERENCES

import type { AdapterDescriptor } from '@stageflip/adapters-core';
import { describe, expect, it } from 'vitest';

import {
  comparatorFor,
  rankBalanced,
  rankCheapest,
  rankFastest,
  rankHighestQuality,
} from './ranking.js';
import { RANKING_PREFERENCES } from './types.js';

// ──────────────────────────────────────────────────────────────────────────
// Fixtures: minimal AdapterDescriptors that exercise the comparators.
// Hand-built (no Zod parse) — the comparator is pure and accepts any
// shape that matches the type. id is the only stable identity.
// ──────────────────────────────────────────────────────────────────────────

function mkAdapter(
  over: Partial<AdapterDescriptor> & Pick<AdapterDescriptor, 'id'>,
): AdapterDescriptor {
  return {
    modality: { kind: 'tts' },
    capability: {},
    license: { kind: 'apache-2.0' },
    sandbox: { kind: 'in-process' },
    ...over,
  };
}

const ZERO_COST = mkAdapter({ id: 'zero-cost', costPerCall: { usd: 0 } });
const CHEAP = mkAdapter({ id: 'cheap', costPerCall: { usd: 0.01 } });
const MID = mkAdapter({ id: 'mid', costPerCall: { usd: 0.05 } });
const EXPENSIVE = mkAdapter({ id: 'expensive', costPerCall: { usd: 0.5 } });
const NO_COST = mkAdapter({ id: 'no-cost' }); // missing → +∞

const FAST = mkAdapter({ id: 'fast', latencyMs: { p50: 50, p95: 100 } });
const MEDIUM = mkAdapter({ id: 'medium', latencyMs: { p50: 500, p95: 1000 } });
const SLOW = mkAdapter({ id: 'slow', latencyMs: { p50: 5000, p95: 10000 } });
const NO_LATENCY = mkAdapter({ id: 'no-latency' }); // missing → +∞
const P50_ONLY = mkAdapter({ id: 'p50-only', latencyMs: { p50: 200 } }); // p95 falls back to p50

// ──────────────────────────────────────────────────────────────────────────
// rankCheapest
// ──────────────────────────────────────────────────────────────────────────

describe('rankCheapest', () => {
  it('orders adapters by ascending cost', () => {
    const sorted = [EXPENSIVE, CHEAP, MID].sort(rankCheapest());
    expect(sorted.map((a) => a.id)).toEqual(['cheap', 'mid', 'expensive']);
  });

  it('places missing cost (+∞) last', () => {
    const sorted = [NO_COST, MID, CHEAP].sort(rankCheapest());
    expect(sorted.map((a) => a.id)).toEqual(['cheap', 'mid', 'no-cost']);
  });

  it('treats usd === 0 as cheapest (free tier)', () => {
    const sorted = [CHEAP, ZERO_COST, MID].sort(rankCheapest());
    expect(sorted.map((a) => a.id)).toEqual(['zero-cost', 'cheap', 'mid']);
  });

  it('breaks ties on ascending id', () => {
    const a = mkAdapter({ id: 'beta', costPerCall: { usd: 0.05 } });
    const b = mkAdapter({ id: 'alpha', costPerCall: { usd: 0.05 } });
    const c = mkAdapter({ id: 'gamma', costPerCall: { usd: 0.05 } });
    const sorted = [a, b, c].sort(rankCheapest());
    expect(sorted.map((x) => x.id)).toEqual(['alpha', 'beta', 'gamma']);
  });
});

// ──────────────────────────────────────────────────────────────────────────
// rankFastest
// ──────────────────────────────────────────────────────────────────────────

describe('rankFastest', () => {
  it('orders adapters by ascending p95 latency', () => {
    const sorted = [SLOW, FAST, MEDIUM].sort(rankFastest());
    expect(sorted.map((a) => a.id)).toEqual(['fast', 'medium', 'slow']);
  });

  it('places missing latency (+∞) last', () => {
    const sorted = [NO_LATENCY, FAST, MEDIUM].sort(rankFastest());
    expect(sorted.map((a) => a.id)).toEqual(['fast', 'medium', 'no-latency']);
  });

  it('falls back to p50 when p95 is absent', () => {
    // p50-only adapter has p50: 200, no p95 → falls back to 200.
    // FAST has p95: 100. So order: fast (100) < p50-only (200) < medium (1000).
    const sorted = [MEDIUM, P50_ONLY, FAST].sort(rankFastest());
    expect(sorted.map((a) => a.id)).toEqual(['fast', 'p50-only', 'medium']);
  });

  it('breaks ties on ascending id', () => {
    const a = mkAdapter({ id: 'beta', latencyMs: { p95: 100 } });
    const b = mkAdapter({ id: 'alpha', latencyMs: { p95: 100 } });
    const sorted = [a, b].sort(rankFastest());
    expect(sorted.map((x) => x.id)).toEqual(['alpha', 'beta']);
  });
});

// ──────────────────────────────────────────────────────────────────────────
// rankHighestQuality
// ──────────────────────────────────────────────────────────────────────────

describe('rankHighestQuality', () => {
  it('orders by descending caller-supplied scorer', () => {
    const scores: Readonly<Record<string, number>> = {
      'no-cost': 5,
      cheap: 9,
      mid: 7,
    };
    const sorted = [NO_COST, CHEAP, MID].sort(rankHighestQuality((a) => scores[a.id] ?? 0));
    expect(sorted.map((a) => a.id)).toEqual(['cheap', 'mid', 'no-cost']);
  });

  it('default scorer returns 0 — tie-break = alphabetic by id', () => {
    const a = mkAdapter({ id: 'zeta' });
    const b = mkAdapter({ id: 'alpha' });
    const c = mkAdapter({ id: 'mu' });
    const sorted = [a, b, c].sort(rankHighestQuality());
    expect(sorted.map((x) => x.id)).toEqual(['alpha', 'mu', 'zeta']);
  });

  it('breaks ties on ascending id when scores match', () => {
    const a = mkAdapter({ id: 'beta' });
    const b = mkAdapter({ id: 'alpha' });
    const sorted = [a, b].sort(rankHighestQuality(() => 0.5));
    expect(sorted.map((x) => x.id)).toEqual(['alpha', 'beta']);
  });
});

// ──────────────────────────────────────────────────────────────────────────
// rankBalanced
// ──────────────────────────────────────────────────────────────────────────

describe('rankBalanced', () => {
  it('rewards adapters that are both cheaper and faster', () => {
    // cheap + fast adapter wins over expensive + slow adapter.
    const cheapFast = mkAdapter({
      id: 'cheap-fast',
      costPerCall: { usd: 0.01 },
      latencyMs: { p95: 100 },
    });
    const expensiveSlow = mkAdapter({
      id: 'expensive-slow',
      costPerCall: { usd: 0.5 },
      latencyMs: { p95: 10000 },
    });
    const sorted = [expensiveSlow, cheapFast].sort(rankBalanced());
    expect(sorted.map((a) => a.id)).toEqual(['cheap-fast', 'expensive-slow']);
  });

  it('factors the caller-supplied quality scorer into the composite', () => {
    // Both adapters have identical cost + latency; quality scorer breaks
    // the tie *before* the alphabetic tie-break.
    const a = mkAdapter({
      id: 'better-quality',
      costPerCall: { usd: 0.05 },
      latencyMs: { p95: 500 },
    });
    const b = mkAdapter({
      id: 'worse-quality',
      costPerCall: { usd: 0.05 },
      latencyMs: { p95: 500 },
    });
    const scores: Readonly<Record<string, number>> = {
      'better-quality': 1.0,
      'worse-quality': 0.1,
    };
    const sorted = [b, a].sort(rankBalanced((adapter) => scores[adapter.id] ?? 0));
    expect(sorted.map((x) => x.id)).toEqual(['better-quality', 'worse-quality']);
  });

  it('places adapters missing cost OR latency hints last (−∞ collapse)', () => {
    const complete = mkAdapter({
      id: 'complete',
      costPerCall: { usd: 0.05 },
      latencyMs: { p95: 500 },
    });
    const noCost = mkAdapter({ id: 'no-cost', latencyMs: { p95: 100 } });
    const noLatency = mkAdapter({ id: 'no-latency', costPerCall: { usd: 0.01 } });
    const sorted = [noCost, noLatency, complete].sort(rankBalanced());
    expect(sorted[0]?.id).toBe('complete');
    expect(['no-cost', 'no-latency']).toContain(sorted[1]?.id);
    expect(['no-cost', 'no-latency']).toContain(sorted[2]?.id);
  });

  it('breaks ties on ascending id when composite scores match exactly', () => {
    const a = mkAdapter({
      id: 'beta',
      costPerCall: { usd: 0.05 },
      latencyMs: { p95: 500 },
    });
    const b = mkAdapter({
      id: 'alpha',
      costPerCall: { usd: 0.05 },
      latencyMs: { p95: 500 },
    });
    const sorted = [a, b].sort(rankBalanced());
    expect(sorted.map((x) => x.id)).toEqual(['alpha', 'beta']);
  });

  it('handles zero-cost zero-latency adapters without NaN / Infinity', () => {
    const free = mkAdapter({
      id: 'free',
      costPerCall: { usd: 0 },
      latencyMs: { p95: 0 },
    });
    const paid = mkAdapter({
      id: 'paid',
      costPerCall: { usd: 0.1 },
      latencyMs: { p95: 100 },
    });
    const sorted = [paid, free].sort(rankBalanced());
    expect(sorted.map((a) => a.id)).toEqual(['free', 'paid']);
  });
});

// ──────────────────────────────────────────────────────────────────────────
// comparatorFor — exhaustive dispatch over RANKING_PREFERENCES
// ──────────────────────────────────────────────────────────────────────────

describe('comparatorFor', () => {
  it('dispatches exhaustively over every RANKING_PREFERENCES entry', () => {
    for (const pref of RANKING_PREFERENCES) {
      const cmp = comparatorFor(pref);
      // Smoke-test: returned comparator is a real function
      // and sorts a 2-element list deterministically.
      const sorted = [CHEAP, MID].sort(cmp);
      expect(sorted).toHaveLength(2);
      expect(typeof cmp).toBe('function');
    }
  });

  it('comparatorFor("cheapest") matches rankCheapest output', () => {
    const a = comparatorFor('cheapest');
    const b = rankCheapest();
    const inputA = [EXPENSIVE, CHEAP, MID].sort(a);
    const inputB = [EXPENSIVE, CHEAP, MID].sort(b);
    expect(inputA.map((x) => x.id)).toEqual(inputB.map((x) => x.id));
  });
});
