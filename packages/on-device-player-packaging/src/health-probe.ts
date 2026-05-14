// packages/on-device-player-packaging/src/health-probe.ts
// Health-check probe (T-400). The on-device player binary exposes a
// local HTTP / IPC endpoint that returns a `HealthProbeReport` for the
// operator's NMS / OpsRamp / fleet-monitor to scrape. T-401 will wire
// the actual scrape pipeline; this module is the pure builder.
//
// Status decision rule:
//   - failures >= 2 × threshold → `'failing'`
//   - failures >= threshold      → `'degraded'`
//   - otherwise                  → `'healthy'`

/** Returned by the health-probe endpoint. */
export interface HealthProbeReport {
  readonly status: 'healthy' | 'degraded' | 'failing';
  readonly uptimeSec: number;
  readonly mountedClipCount: number;
  readonly lastMountAttempt: {
    readonly clipFamily: string;
    readonly outcome: 'mounted' | 'fallback';
    readonly atSec: number;
  } | null;
  readonly playerVersion: string;
}

/** Arguments to `buildHealthProbe`. */
export interface BuildHealthProbeArgs {
  readonly bootedAtSec: number;
  readonly nowSec: number;
  readonly mountedClipCount: number;
  readonly lastMountAttempt: {
    readonly clipFamily: string;
    readonly outcome: 'mounted' | 'fallback';
    readonly atSec: number;
  } | null;
  readonly playerVersion: string;
  readonly recentMountFailureCount: number;
  /**
   * Failure-count threshold. Reaching this count escalates the report
   * from `'healthy'` to `'degraded'`; reaching twice this count
   * escalates to `'failing'`. Default at the call site is 5 failures
   * within the last 10 minutes.
   */
  readonly recentMountFailureThreshold: number;
}

/**
 * Pure builder: turns the caller's snapshot of binary state into a
 * `HealthProbeReport`. No I/O.
 */
export function buildHealthProbe(args: BuildHealthProbeArgs): HealthProbeReport {
  const uptimeSec = Math.max(0, args.nowSec - args.bootedAtSec);
  const status: HealthProbeReport['status'] =
    args.recentMountFailureCount >= args.recentMountFailureThreshold * 2
      ? 'failing'
      : args.recentMountFailureCount >= args.recentMountFailureThreshold
        ? 'degraded'
        : 'healthy';
  return {
    status,
    uptimeSec,
    mountedClipCount: args.mountedClipCount,
    lastMountAttempt: args.lastMountAttempt,
    playerVersion: args.playerVersion,
  };
}
