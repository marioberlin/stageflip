// packages/pack-parity-validator/src/thresholds/cluster-thresholds.test.ts

import { describe, expect, it } from 'vitest';
import {
  DEFAULT_CLUSTER_THRESHOLDS,
  getClusterThreshold,
  resolveClusterThreshold,
} from './cluster-thresholds';

describe('DEFAULT_CLUSTER_THRESHOLDS', () => {
  it('contains 9 clusters (a–i) plus a default fallback row', () => {
    expect(DEFAULT_CLUSTER_THRESHOLDS).toHaveLength(10);
    const ids = DEFAULT_CLUSTER_THRESHOLDS.map((t) => t.clusterId);
    expect(ids).toEqual([
      'cluster-a',
      'cluster-b',
      'cluster-c',
      'cluster-d',
      'cluster-e',
      'cluster-f',
      'cluster-g',
      'cluster-h',
      'cluster-i',
      'default',
    ]);
  });

  it('cluster-d (typography-heavy) is the tightest', () => {
    const d = DEFAULT_CLUSTER_THRESHOLDS.find((t) => t.clusterId === 'cluster-d');
    expect(d).toBeDefined();
    expect(d?.minPsnr).toBe(36);
    expect(d?.minSsim).toBe(0.96);
  });

  it('motion-heavy clusters (c, i) loosen the bar', () => {
    const c = DEFAULT_CLUSTER_THRESHOLDS.find((t) => t.clusterId === 'cluster-c');
    const i = DEFAULT_CLUSTER_THRESHOLDS.find((t) => t.clusterId === 'cluster-i');
    expect(c?.minPsnr).toBe(32);
    expect(c?.minSsim).toBe(0.92);
    expect(i?.minPsnr).toBe(32);
    expect(i?.minSsim).toBe(0.92);
  });

  it('compose-heavy cluster-h sits between motion and standard', () => {
    const h = DEFAULT_CLUSTER_THRESHOLDS.find((t) => t.clusterId === 'cluster-h');
    expect(h?.minPsnr).toBe(33);
    expect(h?.minSsim).toBe(0.93);
  });

  it('every threshold has finite, in-range values', () => {
    for (const t of DEFAULT_CLUSTER_THRESHOLDS) {
      expect(Number.isFinite(t.minPsnr)).toBe(true);
      expect(t.minPsnr).toBeGreaterThan(0);
      expect(t.minSsim).toBeGreaterThan(0);
      expect(t.minSsim).toBeLessThanOrEqual(1);
    }
  });
});

describe('getClusterThreshold', () => {
  it('returns the expected threshold for cluster-a', () => {
    const a = getClusterThreshold('cluster-a');
    expect(a).toEqual({ clusterId: 'cluster-a', minPsnr: 35, minSsim: 0.95 });
  });

  it('returns null for unknown cluster ids', () => {
    expect(getClusterThreshold('cluster-finance')).toBeNull();
    expect(getClusterThreshold('')).toBeNull();
    expect(getClusterThreshold('cluster-z')).toBeNull();
  });

  it('returns the default row when asked for `default`', () => {
    const d = getClusterThreshold('default');
    expect(d).toEqual({ clusterId: 'default', minPsnr: 35, minSsim: 0.95 });
  });
});

describe('resolveClusterThreshold', () => {
  it('returns the matching threshold for a known cluster', () => {
    const e = resolveClusterThreshold('cluster-e');
    expect(e.clusterId).toBe('cluster-e');
    expect(e.minPsnr).toBe(35);
  });

  it('falls back to the default row for unknown cluster ids', () => {
    const fallback = resolveClusterThreshold('cluster-wedding-events');
    expect(fallback.clusterId).toBe('default');
    expect(fallback.minPsnr).toBe(35);
    expect(fallback.minSsim).toBe(0.95);
  });
});
