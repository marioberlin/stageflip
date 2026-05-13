// packages/marketplace-telemetry-dashboard/src/dashboard/shape.ts
// T-541 — Dashboard data shaper. Pulls events for a single packIdHash
// over a time window from a `TimeSeriesStore`, runs every aggregation,
// and returns the JSON the frontend consumes. T-538 (marketplace UI)
// renders this; the UI work is deferred to a future task.
//
// Determinism perimeter: outside (server-side).

import { type ActivationRateResult, activationRate } from '../aggregations/activation-rate.js';
import {
  type InstallCountByDayPoint,
  type InstallCountByWeekPoint,
  installCountByDay,
  installCountByWeek,
} from '../aggregations/install-count.js';
import { type RetentionPoint, retentionCurve } from '../aggregations/retention.js';
import { averageClipMountCount } from '../aggregations/usage-stats.js';
import type { TimeSeriesStore } from '../storage/timeseries.js';

/** Shape consumed by the frontend dashboard. */
export interface DashboardData {
  readonly packIdHash: string;
  readonly windowFromIso: string;
  readonly windowToIso: string;
  readonly installCountByDay: readonly InstallCountByDayPoint[];
  readonly installCountByWeek: readonly InstallCountByWeekPoint[];
  readonly activationRate: ActivationRateResult;
  readonly averageClipMountCount: number;
  readonly retentionCurve: readonly RetentionPoint[];
}

/** Options for `buildDashboardData`. */
export interface BuildDashboardDataOptions {
  readonly fromIso: string;
  readonly toIso: string;
}

/**
 * Build a complete `DashboardData` blob for the supplied pack hash.
 * Pulls install + activation + usage events from the store for the
 * supplied window, then runs every aggregation in parallel
 * (`Promise.all`) since they don't depend on each other.
 */
export async function buildDashboardData(
  packIdHash: string,
  store: TimeSeriesStore,
  opts: BuildDashboardDataOptions,
): Promise<DashboardData> {
  const [installs, activations, usages] = await Promise.all([
    store.query({ packIdHash, kind: 'install', fromIso: opts.fromIso, toIso: opts.toIso }),
    store.query({ packIdHash, kind: 'activation', fromIso: opts.fromIso, toIso: opts.toIso }),
    store.query({ packIdHash, kind: 'usage', fromIso: opts.fromIso, toIso: opts.toIso }),
  ]);

  // Pure aggregations are deterministic; concat the three streams for
  // those that consume multiple kinds.
  const installAndActivation = [...installs, ...activations];

  return {
    packIdHash,
    windowFromIso: opts.fromIso,
    windowToIso: opts.toIso,
    installCountByDay: installCountByDay(installs),
    installCountByWeek: installCountByWeek(installs),
    activationRate: activationRate(installAndActivation),
    averageClipMountCount: averageClipMountCount(usages),
    retentionCurve: retentionCurve(installAndActivation),
  };
}
