// packages/pack-discovery/src/editor/cluster-usage-tracker.test.ts

import { describe, expect, it } from 'vitest';

import { ClusterUsageTracker } from './cluster-usage-tracker.js';

describe('ClusterUsageTracker', () => {
  it('starts empty', () => {
    const t = new ClusterUsageTracker();
    expect(t.reportByCluster()).toEqual([]);
    expect(t.clustersInUse()).toEqual([]);
  });

  it('records one clip and reports a count of 1', () => {
    const t = new ClusterUsageTracker();
    t.recordClipAdded('text', 'cluster-a', 1000);
    const report = t.reportByCluster();
    expect(report).toHaveLength(1);
    expect(report[0]?.clusterId).toBe('cluster-a');
    expect(report[0]?.count).toBe(1);
    expect(report[0]?.mostRecentMs).toBe(1000);
  });

  it('reset() clears everything', () => {
    const t = new ClusterUsageTracker();
    t.recordClipAdded('text', 'cluster-a', 1000);
    t.recordClipAdded('text', 'cluster-b', 2000);
    t.reset();
    expect(t.reportByCluster()).toEqual([]);
    expect(t.clustersInUse()).toEqual([]);
  });

  it('recordClipRemoved decrements the matching cluster count', () => {
    const t = new ClusterUsageTracker();
    t.recordClipAdded('text', 'cluster-a', 1000);
    t.recordClipAdded('text', 'cluster-a', 2000);
    t.recordClipRemoved('cluster-a');
    const report = t.reportByCluster();
    expect(report).toHaveLength(1);
    expect(report[0]?.count).toBe(1);
  });

  it('recordClipRemoved is a no-op when the cluster has no rows', () => {
    const t = new ClusterUsageTracker();
    t.recordClipAdded('text', 'cluster-a', 1000);
    t.recordClipRemoved('cluster-z');
    expect(t.reportByCluster()).toHaveLength(1);
  });

  it('mostRecentMs tracks the largest addedAtMs across rows for a cluster', () => {
    const t = new ClusterUsageTracker();
    t.recordClipAdded('text', 'cluster-a', 5000);
    t.recordClipAdded('text', 'cluster-a', 1000);
    t.recordClipAdded('text', 'cluster-a', 3000);
    const report = t.reportByCluster();
    expect(report[0]?.mostRecentMs).toBe(5000);
  });

  it('reports sort by count desc then clusterId asc', () => {
    const t = new ClusterUsageTracker();
    t.recordClipAdded('text', 'cluster-b', 1000);
    t.recordClipAdded('text', 'cluster-b', 2000);
    t.recordClipAdded('text', 'cluster-a', 3000);
    t.recordClipAdded('text', 'cluster-a', 4000);
    t.recordClipAdded('text', 'cluster-c', 5000);
    const ids = t.reportByCluster().map((r) => r.clusterId);
    // a + b both have count 2 → alphabetical tiebreak; c has 1.
    expect(ids).toEqual(['cluster-a', 'cluster-b', 'cluster-c']);
  });

  it('clustersInUse() returns distinct insertion-ordered cluster IDs', () => {
    const t = new ClusterUsageTracker();
    t.recordClipAdded('text', 'cluster-b', 1000);
    t.recordClipAdded('text', 'cluster-a', 1000);
    t.recordClipAdded('text', 'cluster-b', 2000);
    t.recordClipAdded('text', 'cluster-c', 3000);
    expect(t.clustersInUse()).toEqual(['cluster-b', 'cluster-a', 'cluster-c']);
  });

  it('omitting atMs defaults to 0', () => {
    const t = new ClusterUsageTracker();
    t.recordClipAdded('text', 'cluster-a');
    expect(t.reportByCluster()[0]?.mostRecentMs).toBe(0);
  });
});
