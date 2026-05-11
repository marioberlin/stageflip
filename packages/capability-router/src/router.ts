// packages/capability-router/src/router.ts
// `routeCapability(input)` — pure decision function that filters + ranks
// `AdapterDescriptor`s for an agent-side request.
//
// Flow:
//   1. Run the 3-stage filter pipeline (filter.ts).
//   2. Rank the eligible set by `rankingPreference` (ranking.ts).
//   3. Return a discriminated `RoutingDecision` (ok: true with ranked
//      candidates, or ok: false with per-reason tally + dominant reason).
//
// This is the LAST Phase 14 α task. After T-425 lands, reference adapters
// (T-426..T-434) can register their `AdapterDescriptor`s into the shared
// `AdapterRegistry` and the routing engine selects among them per agent
// call.
//
// BROWSER-SAFE: pure function; no I/O; no Node-only imports.

import type { AdapterDescriptor } from '@stageflip/adapters-core';

import { buildFilterPipeline } from './filter.js';
import { comparatorFor } from './ranking.js';
import type { FilteredByReason, RejectionReason, RoutingDecision, RoutingInput } from './types.js';

/**
 * Identify the dominant rejection reason (highest count). Used for the
 * `ok: false` `detail` field — gives the caller a one-line "why" without
 * forcing them to scan `filteredByReason` themselves.
 *
 * Ties break by the order in which reasons are listed inside the tally
 * object; the iteration order matches `REJECTION_REASONS` (the order
 * declared in `types.ts`).
 */
function dominantReason(tally: FilteredByReason): RejectionReason | undefined {
  let best: RejectionReason | undefined;
  let bestCount = 0;
  for (const [reason, count] of Object.entries(tally) as readonly [RejectionReason, number][]) {
    if (count > bestCount) {
      best = reason;
      bestCount = count;
    }
  }
  return best;
}

/**
 * Human-readable detail string for the `ok: false` branch. Captures the
 * dominant rejection reason + the total considered, in a form suitable
 * for surfacing into agent error UX.
 */
function detailFor(totalConsidered: number, tally: FilteredByReason): string {
  if (totalConsidered === 0) {
    return 'no adapters supplied to router';
  }
  const reason = dominantReason(tally);
  if (reason === undefined) {
    return `${totalConsidered} adapters considered, none eligible (unknown reason)`;
  }
  const count = tally[reason];
  return `${totalConsidered} adapters considered, 0 eligible (dominant reason: ${reason}, ${count} rejected at that stage)`;
}

/**
 * Filter + rank `AdapterDescriptor`s for an agent-side request.
 *
 * Pure function. Deterministic. No I/O. The returned `RoutingDecision`:
 *
 * - `ok: true` — `candidates` is the eligible set, stably sorted by
 *   `rankingPreference` (default `'balanced'`). `totalConsidered` is
 *   `input.adapters.length`. `filteredByReason` is the per-stage drop-off.
 *
 * - `ok: false` — every adapter was filtered out. `detail` names the
 *   dominant rejection stage; `filteredByReason` carries the full breakdown.
 *
 * @see `RoutingInput` for the input shape.
 * @see `RoutingDecision` for the output shape.
 */
export function routeCapability(input: RoutingInput): RoutingDecision {
  const totalConsidered = input.adapters.length;

  // Build + run the 3-stage filter pipeline.
  const filterOpts: Parameters<typeof buildFilterPipeline>[0] = {
    modality: input.modality,
    tenant: input.tenant,
  };
  if (input.capabilityPredicate !== undefined) {
    Object.assign(filterOpts, { capabilityPredicate: input.capabilityPredicate });
  }
  if (input.hostSandboxKinds !== undefined) {
    Object.assign(filterOpts, { hostSandboxKinds: input.hostSandboxKinds });
  }
  if (input.licenseGate !== undefined) {
    Object.assign(filterOpts, { licenseGate: input.licenseGate });
  }
  const pipeline = buildFilterPipeline(filterOpts);
  const { passed, filteredByReason } = pipeline(input.adapters);

  if (passed.length === 0) {
    return {
      ok: false,
      reason: 'no_eligible_adapters',
      detail: detailFor(totalConsidered, filteredByReason),
      totalConsidered,
      filteredByReason,
    };
  }

  // Rank the eligible set. Sort returns the same array reference; copy
  // first to avoid mutating the caller's input even though `passed` is
  // already a fresh array.
  const preference = input.rankingPreference ?? 'balanced';
  const comparator = comparatorFor(preference, input.qualityScorer);
  const ranked: AdapterDescriptor[] = [...passed].sort(comparator);

  return {
    ok: true,
    candidates: ranked,
    totalConsidered,
    filteredByReason,
  };
}
