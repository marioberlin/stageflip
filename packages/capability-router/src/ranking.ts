// packages/capability-router/src/ranking.ts
// Pure-function ranking comparators for the capability-routing engine.
//
// Each `rankXxx(opts) => Comparator<AdapterDescriptor>` returns a comparator
// suitable for `Array#sort()` (which is stable in V8 / SpiderMonkey since
// 2019). Ties break on ascending `id` to keep `routeCapability()` output
// deterministic across runs regardless of the source iteration order.
//
// BROWSER-SAFE: pure function; no I/O; no Node-only imports.

import type { AdapterDescriptor } from '@stageflip/adapters-core';

import type { QualityScorer, RankingPreference } from './types.js';

/** Comparator type alias for clarity. */
export type Comparator<T> = (a: T, b: T) => number;

/**
 * Small constant added to cost / latency before `log10` to keep the
 * balanced-ranker well-defined when either is zero (free + instant
 * adapters). Choice is documented + tested: `1e-6`.
 */
const LOG_EPSILON = 1e-6;

/**
 * Extract a numeric cost in USD for ranking. Missing hint → `+Infinity`
 * (sorts last). Negative values are coerced to 0 defensively — descriptors
 * cannot reach the registry with negatives (Zod nonnegative check) but the
 * comparator stays safe under hand-built descriptors in tests.
 */
function costUsd(adapter: AdapterDescriptor): number {
  const usd = adapter.costPerCall?.usd;
  if (usd === undefined) return Number.POSITIVE_INFINITY;
  return usd < 0 ? 0 : usd;
}

/**
 * Extract a numeric latency in milliseconds for ranking. Prefers `p95`
 * (worst-case observed) and falls back to `p50` (median) when only the
 * median is declared. Missing both → `+Infinity` (sorts last).
 */
function latencyMs(adapter: AdapterDescriptor): number {
  const hint = adapter.latencyMs;
  if (hint === undefined) return Number.POSITIVE_INFINITY;
  const candidate = hint.p95 ?? hint.p50;
  if (candidate === undefined) return Number.POSITIVE_INFINITY;
  return candidate < 0 ? 0 : candidate;
}

/**
 * Stable tie-breaker for every ranker: ascending `id` (kebab-case).
 * Pure string compare — locale-independent.
 */
function compareIdAsc(a: AdapterDescriptor, b: AdapterDescriptor): number {
  if (a.id < b.id) return -1;
  if (a.id > b.id) return 1;
  return 0;
}

/**
 * `'cheapest'` comparator. Ascending cost; missing cost sorts last;
 * ties break on ascending `id`.
 */
export function rankCheapest(): Comparator<AdapterDescriptor> {
  return (a, b) => {
    const delta = costUsd(a) - costUsd(b);
    if (delta !== 0) return delta;
    return compareIdAsc(a, b);
  };
}

/**
 * `'fastest'` comparator. Ascending latency (`p95 ?? p50`); missing
 * latency sorts last; ties break on ascending `id`.
 */
export function rankFastest(): Comparator<AdapterDescriptor> {
  return (a, b) => {
    const delta = latencyMs(a) - latencyMs(b);
    if (delta !== 0) return delta;
    return compareIdAsc(a, b);
  };
}

/**
 * `'highest-quality'` comparator. Descending caller-supplied
 * `qualityScorer(adapter)`; default scorer returns `0` so tie-break
 * reduces to alphabetic by `id`.
 */
export function rankHighestQuality(scorer?: QualityScorer): Comparator<AdapterDescriptor> {
  const score = scorer ?? (() => 0);
  return (a, b) => {
    const delta = score(b) - score(a); // descending
    if (delta !== 0) return delta;
    return compareIdAsc(a, b);
  };
}

/**
 * `'balanced'` comparator. Maximizes the composite score
 *
 *     -log10(cost + ε) + -log10(latency + ε) + qualityScorer(adapter)
 *
 * The composite rewards low cost AND low latency AND high quality on a
 * roughly comparable log-scale — adapters missing cost or latency hints
 * sort last (their `+Infinity` collapses to `-log10(∞) = -∞`).
 *
 * Tie-break: ascending `id`.
 */
export function rankBalanced(scorer?: QualityScorer): Comparator<AdapterDescriptor> {
  const score = scorer ?? (() => 0);
  return (a, b) => {
    const sa =
      -Math.log10(costUsd(a) + LOG_EPSILON) - Math.log10(latencyMs(a) + LOG_EPSILON) + score(a);
    const sb =
      -Math.log10(costUsd(b) + LOG_EPSILON) - Math.log10(latencyMs(b) + LOG_EPSILON) + score(b);
    const delta = sb - sa; // descending
    if (delta !== 0) return delta;
    return compareIdAsc(a, b);
  };
}

/**
 * Dispatch to the comparator for a given preference. Single site so the
 * router consumes the union exhaustively.
 */
export function comparatorFor(
  preference: RankingPreference,
  scorer?: QualityScorer,
): Comparator<AdapterDescriptor> {
  switch (preference) {
    case 'cheapest':
      return rankCheapest();
    case 'fastest':
      return rankFastest();
    case 'highest-quality':
      return rankHighestQuality(scorer);
    case 'balanced':
      return rankBalanced(scorer);
  }
}
