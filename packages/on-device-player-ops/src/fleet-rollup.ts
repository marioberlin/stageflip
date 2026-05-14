// packages/on-device-player-ops/src/fleet-rollup.ts
// Fleet-level rollup contract (T-401). Defines the shape downstream
// consumers (Prometheus / Grafana / Datadog ingestion) consume to
// produce per-tenant, per-device, per-clip-family fleet views. T-401
// only ships the design surface + a pure builder — no actual exporter
// is implemented (that's downstream of this workspace).

import type { HealthProbeReport } from '@stageflip/on-device-player-packaging';
import type { OnDevicePlayerRefusalReason } from '@stageflip/runtime-on-device-player';

import type { PlayerMetrics } from './metrics.js';

/** One device's rolled-up report. */
export interface FleetRollupRow {
  readonly tenantId: string;
  readonly deviceId: string;
  readonly playerVersion: string;
  readonly metrics: PlayerMetrics;
  readonly health: HealthProbeReport;
  readonly reportedAtSec: number;
}

/** A whole-fleet rollup. Built by `buildFleetRollup`. */
export interface FleetRollup {
  readonly rows: readonly FleetRollupRow[];
  readonly aggregatedAtSec: number;
  /** Aggregate metrics across every row in `rows`. */
  readonly totals: {
    readonly totalDevices: number;
    readonly healthyDevices: number;
    readonly degradedDevices: number;
    readonly failingDevices: number;
    /** Per-row weighted average; weight = row's `mountAttempts`. 0 when totalAttempts === 0. */
    readonly weightedMountSuccessRate: number;
    /** Elementwise sum of every row's `refusalsByReason`. */
    readonly aggregateRefusalsByReason: Readonly<Record<OnDevicePlayerRefusalReason, number>>;
  };
}

const REFUSAL_REASONS: readonly OnDevicePlayerRefusalReason[] = [
  'tenant-flag-disabled',
  'preview-not-ga',
  'permission-refused',
  'capability-insufficient',
  'no-factory-registered',
];

function emptyRefusalHistogram(): Record<OnDevicePlayerRefusalReason, number> {
  const out = {} as Record<OnDevicePlayerRefusalReason, number>;
  for (const reason of REFUSAL_REASONS) {
    out[reason] = 0;
  }
  return out;
}

/**
 * Build the fleet rollup. Pure transform — no I/O. Callers fetch
 * `FleetRollupRow`s from each device (via `/health` + a sibling
 * metrics endpoint the binary wires) and hand the array to this
 * builder.
 */
export function buildFleetRollup(args: {
  readonly rows: readonly FleetRollupRow[];
  readonly aggregatedAtSec: number;
}): FleetRollup {
  let healthyDevices = 0;
  let degradedDevices = 0;
  let failingDevices = 0;
  let totalAttempts = 0;
  let totalSuccesses = 0;
  const aggregateRefusalsByReason = emptyRefusalHistogram();

  for (const row of args.rows) {
    switch (row.health.status) {
      case 'healthy':
        healthyDevices += 1;
        break;
      case 'degraded':
        degradedDevices += 1;
        break;
      case 'failing':
        failingDevices += 1;
        break;
    }
    totalAttempts += row.metrics.mountAttempts;
    totalSuccesses += row.metrics.mountSuccesses;
    for (const reason of REFUSAL_REASONS) {
      aggregateRefusalsByReason[reason] += row.metrics.refusalsByReason[reason];
    }
  }

  const weightedMountSuccessRate = totalAttempts === 0 ? 0 : totalSuccesses / totalAttempts;

  return {
    rows: args.rows,
    aggregatedAtSec: args.aggregatedAtSec,
    totals: {
      totalDevices: args.rows.length,
      healthyDevices,
      degradedDevices,
      failingDevices,
      weightedMountSuccessRate,
      aggregateRefusalsByReason,
    },
  };
}
