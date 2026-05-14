// packages/pack-parity-validator/src/thresholds/cluster-thresholds.ts
// T-549 — Per-cluster minimum PSNR + SSIM thresholds the marketplace
// publish-time gate (T-536, future) and the pack-loader install-time
// gate (T-495) score every pack-shipped parity fixture against.
//
// Mirrors the workspace `parity-cli` thresholds for clusters A–I plus a
// `default` fallback row used for unknown cluster ids contributed by
// launch packs (e.g. `cluster-finance`, `cluster-wedding-events`).
//
// Tighter clusters (D — typography-heavy) demand higher PSNR / SSIM;
// looser clusters (C / I — motion-heavy, H — compose-heavy) loosen the
// bar to absorb codec / blend-precision noise without false positives.

/** A single cluster's minimum PSNR (dB) + SSIM (0..1) gate. */
export interface ClusterPsnrThreshold {
  readonly clusterId: string;
  readonly minPsnr: number;
  readonly minSsim: number;
}

/**
 * Built-in defaults for clusters A–I. Order is stable so consumers can
 * iterate this list deterministically (e.g. for documentation / table
 * rendering). The trailing `default` row is the fallback used by
 * `getClusterThreshold` when an unknown cluster id is supplied.
 */
export const DEFAULT_CLUSTER_THRESHOLDS: readonly ClusterPsnrThreshold[] = [
  { clusterId: 'cluster-a', minPsnr: 35, minSsim: 0.95 },
  { clusterId: 'cluster-b', minPsnr: 35, minSsim: 0.95 },
  { clusterId: 'cluster-c', minPsnr: 32, minSsim: 0.92 },
  { clusterId: 'cluster-d', minPsnr: 36, minSsim: 0.96 },
  { clusterId: 'cluster-e', minPsnr: 35, minSsim: 0.95 },
  { clusterId: 'cluster-f', minPsnr: 35, minSsim: 0.95 },
  { clusterId: 'cluster-g', minPsnr: 35, minSsim: 0.95 },
  { clusterId: 'cluster-h', minPsnr: 33, minSsim: 0.93 },
  { clusterId: 'cluster-i', minPsnr: 32, minSsim: 0.92 },
  { clusterId: 'default', minPsnr: 35, minSsim: 0.95 },
];

const THRESHOLD_INDEX: ReadonlyMap<string, ClusterPsnrThreshold> = new Map(
  DEFAULT_CLUSTER_THRESHOLDS.map((t) => [t.clusterId, t]),
);

/**
 * Look up the threshold for a cluster id. Returns `null` for unknown
 * cluster ids — callers decide whether to fall back to `default` or
 * surface an `unknown-cluster` failure reason.
 */
export function getClusterThreshold(clusterId: string): ClusterPsnrThreshold | null {
  return THRESHOLD_INDEX.get(clusterId) ?? null;
}

/**
 * Resolve the threshold for a cluster id, falling back to the `default`
 * row on miss. Never returns `null` — guarantees a usable threshold for
 * scoring even when a pack ships a cluster id we have not enumerated.
 */
export function resolveClusterThreshold(clusterId: string): ClusterPsnrThreshold {
  const direct = THRESHOLD_INDEX.get(clusterId);
  if (direct) return direct;
  const fallback = THRESHOLD_INDEX.get('default');
  // The `default` row is always present in `DEFAULT_CLUSTER_THRESHOLDS`;
  // this branch is unreachable in practice but keeps the return type
  // non-nullable for callers.
  if (!fallback) {
    throw new Error('pack-parity-validator: missing `default` cluster threshold row');
  }
  return fallback;
}
