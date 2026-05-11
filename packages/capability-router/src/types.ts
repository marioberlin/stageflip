// packages/capability-router/src/types.ts
// Public types for `@stageflip/capability-router`. The `RoutingDecision`
// is a discriminated union; consumers branch on `ok` to handle either the
// ranked-eligible-list path or the empty-eligible-set rejection path.
//
// BROWSER-SAFE: types only; no I/O, no Node-only imports.

import type {
  AdapterDescriptor,
  AdapterModalityKind,
  LicenseGate,
  SandboxKind,
  TenantContext,
} from '@stageflip/adapters-core';

// ----------------------------------------------------------------------------
// Ranking preferences
// ----------------------------------------------------------------------------

/**
 * Ranking preference applied to the eligible adapter set.
 *
 * - `'cheapest'`         — minimize `costPerCall.usd`; missing cost sorts last.
 * - `'fastest'`          — minimize `latencyMs.p95 ?? latencyMs.p50`; missing latency sorts last.
 * - `'highest-quality'`  — maximize caller-supplied `qualityScorer(descriptor)`; default scorer returns 0 (tie-break = alphabetic by `id`).
 * - `'balanced'`         — maximize composite `-log10(cost+ε) + -log10(latency+ε) + qualityScorer`. The default.
 *
 * Every comparator is stable; ties break on ascending `id` to keep
 * `routeCapability()` deterministic across runs.
 */
export type RankingPreference = 'cheapest' | 'fastest' | 'highest-quality' | 'balanced';

/** Every ranking preference, frozen. Useful for exhaustive iteration in tests. */
export const RANKING_PREFERENCES = [
  'cheapest',
  'fastest',
  'highest-quality',
  'balanced',
] as const satisfies readonly RankingPreference[];

// ----------------------------------------------------------------------------
// Rejection reasons (per-stage filter telemetry)
// ----------------------------------------------------------------------------

/**
 * One typed rejection reason emitted by the 3-stage filter pipeline.
 *
 * The pipeline applies stages in order; an adapter rejected at stage N is
 * NOT re-considered at stages N+1..K. The counts in
 * `RoutingDecision.filteredByReason` reflect first-failure attribution.
 *
 * - `'modality-mismatch'`     — stage 1: `descriptor.modality.kind !== input.modality`.
 * - `'capability-mismatch'`   — stage 2: caller-supplied `capabilityPredicate` returned `false`.
 * - `'license-denied'`        — stage 3: `LicenseGate.evaluate()` returned `'deny'`.
 * - `'credential-missing'`    — stage 3: `LicenseGate.evaluate()` returned `'requires-consent'`.
 * - `'sandbox-unavailable'`   — stage 3: `descriptor.sandbox.kind` is not in `hostSandboxKinds`.
 */
export type RejectionReason =
  | 'modality-mismatch'
  | 'capability-mismatch'
  | 'license-denied'
  | 'credential-missing'
  | 'sandbox-unavailable';

/** Every rejection reason, frozen. */
export const REJECTION_REASONS = [
  'modality-mismatch',
  'capability-mismatch',
  'license-denied',
  'credential-missing',
  'sandbox-unavailable',
] as const satisfies readonly RejectionReason[];

// ----------------------------------------------------------------------------
// Routing input
// ----------------------------------------------------------------------------

/**
 * Caller-supplied capability predicate. Receives the adapter's opaque
 * `capability` envelope + the full descriptor (so the predicate may inspect
 * cross-field constraints like "voice-clone adapter AND emits word
 * timestamps"). Returns `true` if the adapter satisfies the caller's
 * constraints; `false` otherwise.
 *
 * The predicate MUST be pure — `routeCapability()`'s determinism depends on
 * it.
 */
export type CapabilityPredicate = (
  capability: AdapterDescriptor['capability'],
  descriptor: AdapterDescriptor,
) => boolean;

/**
 * Caller-supplied quality scorer for the `'highest-quality'` and
 * `'balanced'` preferences. Higher score → better. Default = `() => 0`
 * (so tie-break reduces to alphabetic by `id`).
 *
 * MUST be pure.
 */
export type QualityScorer = (descriptor: AdapterDescriptor) => number;

/**
 * Input to `routeCapability(input)`. All fields except `modality` and
 * `tenant` have defaults; the function is callable with the minimal pair.
 */
export interface RoutingInput {
  /**
   * Snapshot of registered adapters. The router does NOT mutate this; a
   * plain readonly array is sufficient (callers typically pass
   * `registry.list(modality)` from `@stageflip/adapters-core`).
   */
  readonly adapters: readonly AdapterDescriptor[];
  /** Modality the caller needs. */
  readonly modality: AdapterModalityKind;
  /** Tenant context the license-gate consults. */
  readonly tenant: TenantContext;
  /** Caller-supplied capability predicate (optional). Stage-2 filter. */
  readonly capabilityPredicate?: CapabilityPredicate;
  /**
   * Sandbox kinds the host shell supports. Adapters whose declared
   * sandbox kind is NOT in this set are rejected. Defaults to every
   * sandbox kind (no filtering) if omitted — callers wire the
   * host-shell-specific set in production.
   */
  readonly hostSandboxKinds?: ReadonlySet<SandboxKind>;
  /**
   * License-gate implementation. Defaults to `defaultLicenseGate` from
   * `@stageflip/adapters-core` (ADR-007 §D3 matrix).
   */
  readonly licenseGate?: LicenseGate;
  /** Ranking preference applied to the eligible set. Defaults to `'balanced'`. */
  readonly rankingPreference?: RankingPreference;
  /**
   * Caller-supplied quality scorer for `'highest-quality'` /
   * `'balanced'` preferences. Defaults to `() => 0`.
   */
  readonly qualityScorer?: QualityScorer;
}

// ----------------------------------------------------------------------------
// Routing decision (discriminated union)
// ----------------------------------------------------------------------------

/**
 * Dense per-reason rejection tally. Every `RejectionReason` is present
 * with the count of adapters rejected at that stage (0 when none).
 */
export type FilteredByReason = Readonly<Record<RejectionReason, number>>;

/**
 * Result returned by `routeCapability()`.
 *
 * - `ok: true`  — at least one adapter passed all filters. `candidates`
 *                 is the ranked eligible set.
 * - `ok: false` — every adapter was filtered out. `detail` names the
 *                 dominant rejection reason (the one with the highest
 *                 count); `filteredByReason` carries the full breakdown.
 *
 * `totalConsidered` is `input.adapters.length` — i.e., every adapter the
 * caller supplied, including those rejected at stage 1.
 */
export type RoutingDecision =
  | {
      readonly ok: true;
      readonly candidates: readonly AdapterDescriptor[];
      readonly totalConsidered: number;
      readonly filteredByReason: FilteredByReason;
    }
  | {
      readonly ok: false;
      readonly reason: 'no_eligible_adapters';
      readonly detail: string;
      readonly totalConsidered: number;
      readonly filteredByReason: FilteredByReason;
    };
