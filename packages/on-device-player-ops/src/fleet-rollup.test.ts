// packages/on-device-player-ops/src/fleet-rollup.test.ts
// Tests for `buildFleetRollup` (T-401).

import type { HealthProbeReport } from '@stageflip/on-device-player-packaging';
import type { OnDevicePlayerRefusalReason } from '@stageflip/runtime-on-device-player';

import { describe, expect, it } from 'vitest';

import { type FleetRollupRow, buildFleetRollup } from './fleet-rollup.js';
import type { PlayerMetrics } from './metrics.js';

function makeMetrics(args: {
  readonly attempts: number;
  readonly successes: number;
  readonly refusals?: Partial<Record<OnDevicePlayerRefusalReason, number>>;
}): PlayerMetrics {
  const refusals = {
    'tenant-flag-disabled': 0,
    'preview-not-ga': 0,
    'permission-refused': 0,
    'capability-insufficient': 0,
    'no-factory-registered': 0,
    ...(args.refusals ?? {}),
  };
  return {
    windowStartedAtSec: 0,
    windowDurationSec: 600,
    bootCount: 1,
    shutdownCount: 0,
    mountAttempts: args.attempts,
    mountSuccesses: args.successes,
    mountRefusals: args.attempts - args.successes,
    mountSuccessRate: args.attempts === 0 ? 0 : args.successes / args.attempts,
    refusalsByReason: refusals,
    errorsByClipFamily: {},
    uptimePctSinceBoot: 1,
    currentlyMounted: 0,
  };
}

function makeHealth(status: 'healthy' | 'degraded' | 'failing'): HealthProbeReport {
  return {
    status,
    uptimeSec: 100,
    mountedClipCount: 0,
    lastMountAttempt: null,
    playerVersion: '1.0.0',
  };
}

function makeRow(
  overrides: Partial<FleetRollupRow> & {
    readonly metrics: PlayerMetrics;
    readonly health: HealthProbeReport;
  },
): FleetRollupRow {
  return {
    tenantId: 't1',
    deviceId: 'd1',
    playerVersion: '1.0.0',
    reportedAtSec: 100,
    ...overrides,
  };
}

describe('buildFleetRollup', () => {
  it('0 rows → totalDevices: 0; sane zeros', () => {
    const rollup = buildFleetRollup({ rows: [], aggregatedAtSec: 100 });
    expect(rollup.totals.totalDevices).toBe(0);
    expect(rollup.totals.healthyDevices).toBe(0);
    expect(rollup.totals.degradedDevices).toBe(0);
    expect(rollup.totals.failingDevices).toBe(0);
    expect(rollup.totals.weightedMountSuccessRate).toBe(0);
    expect(rollup.aggregatedAtSec).toBe(100);
  });

  it('3 healthy + 1 degraded + 1 failing → correct counts', () => {
    const rows: FleetRollupRow[] = [
      makeRow({
        metrics: makeMetrics({ attempts: 1, successes: 1 }),
        health: makeHealth('healthy'),
      }),
      makeRow({
        metrics: makeMetrics({ attempts: 1, successes: 1 }),
        health: makeHealth('healthy'),
      }),
      makeRow({
        metrics: makeMetrics({ attempts: 1, successes: 1 }),
        health: makeHealth('healthy'),
      }),
      makeRow({
        metrics: makeMetrics({ attempts: 1, successes: 0 }),
        health: makeHealth('degraded'),
      }),
      makeRow({
        metrics: makeMetrics({ attempts: 1, successes: 0 }),
        health: makeHealth('failing'),
      }),
    ];
    const rollup = buildFleetRollup({ rows, aggregatedAtSec: 100 });
    expect(rollup.totals.totalDevices).toBe(5);
    expect(rollup.totals.healthyDevices).toBe(3);
    expect(rollup.totals.degradedDevices).toBe(1);
    expect(rollup.totals.failingDevices).toBe(1);
  });

  it('weightedMountSuccessRate: 10@90% + 90@50% = 0.54', () => {
    const rows: FleetRollupRow[] = [
      makeRow({
        metrics: makeMetrics({ attempts: 10, successes: 9 }),
        health: makeHealth('healthy'),
      }),
      makeRow({
        metrics: makeMetrics({ attempts: 90, successes: 45 }),
        health: makeHealth('healthy'),
      }),
    ];
    const rollup = buildFleetRollup({ rows, aggregatedAtSec: 100 });
    expect(rollup.totals.weightedMountSuccessRate).toBeCloseTo(0.54, 10);
  });

  it('aggregateRefusalsByReason: elementwise sum', () => {
    const rows: FleetRollupRow[] = [
      makeRow({
        metrics: makeMetrics({
          attempts: 5,
          successes: 2,
          refusals: { 'permission-refused': 2, 'capability-insufficient': 1 },
        }),
        health: makeHealth('healthy'),
      }),
      makeRow({
        metrics: makeMetrics({
          attempts: 5,
          successes: 0,
          refusals: { 'permission-refused': 3, 'tenant-flag-disabled': 2 },
        }),
        health: makeHealth('degraded'),
      }),
    ];
    const rollup = buildFleetRollup({ rows, aggregatedAtSec: 100 });
    expect(rollup.totals.aggregateRefusalsByReason['permission-refused']).toBe(5);
    expect(rollup.totals.aggregateRefusalsByReason['capability-insufficient']).toBe(1);
    expect(rollup.totals.aggregateRefusalsByReason['tenant-flag-disabled']).toBe(2);
    expect(rollup.totals.aggregateRefusalsByReason['preview-not-ga']).toBe(0);
    expect(rollup.totals.aggregateRefusalsByReason['no-factory-registered']).toBe(0);
  });

  it('rows are passed through to the rollup output', () => {
    const row = makeRow({
      tenantId: 't42',
      deviceId: 'd42',
      metrics: makeMetrics({ attempts: 1, successes: 1 }),
      health: makeHealth('healthy'),
    });
    const rollup = buildFleetRollup({ rows: [row], aggregatedAtSec: 200 });
    expect(rollup.rows).toEqual([row]);
  });
});
