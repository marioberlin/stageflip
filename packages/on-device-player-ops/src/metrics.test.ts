// packages/on-device-player-ops/src/metrics.test.ts
// Tests for `MetricsAggregator` (T-401).

import type { DisplayDeviceCapability, TelemetryEvent } from '@stageflip/runtime-on-device-player';

import { describe, expect, it } from 'vitest';

import { createMetricsAggregator } from './metrics.js';

const DEVICE: DisplayDeviceCapability = {
  deviceId: 'device-1',
  hardwareClass: 'dooh',
  resolution: { width: 1920, height: 1080 },
  refreshHz: 60,
  hasGpu: true,
  hasAudio: true,
  hasNetwork: true,
  hasMicrophone: false,
  hasCamera: false,
  osPlatform: 'linux',
  playerVersion: '1.0.0',
};

function fixedClock(value: number): () => number {
  return () => value;
}

describe('createMetricsAggregator', () => {
  it('empty aggregator → all counters zero, mountSuccessRate === 0', () => {
    const agg = createMetricsAggregator();
    const snap = agg.snapshot(fixedClock(100));
    expect(snap.bootCount).toBe(0);
    expect(snap.shutdownCount).toBe(0);
    expect(snap.mountAttempts).toBe(0);
    expect(snap.mountSuccesses).toBe(0);
    expect(snap.mountRefusals).toBe(0);
    expect(snap.mountSuccessRate).toBe(0);
    expect(snap.currentlyMounted).toBe(0);
    expect(snap.uptimePctSinceBoot).toBe(0);
  });

  it('boot event ingested → bootCount === 1; currentlyMounted unchanged', () => {
    const agg = createMetricsAggregator();
    agg.ingest({ kind: 'boot', device: DEVICE }, fixedClock(10));
    const snap = agg.snapshot(fixedClock(20));
    expect(snap.bootCount).toBe(1);
    expect(snap.currentlyMounted).toBe(0);
  });

  it('mount-attempted + mount-success → mountAttempts === 1, mountSuccesses === 1, rate === 1', () => {
    const agg = createMetricsAggregator();
    agg.ingest({ kind: 'mount-attempted', clipFamily: 'shader', clipId: 'c1' }, fixedClock(10));
    agg.ingest(
      { kind: 'mount-success', clipFamily: 'shader', clipId: 'c1', elapsedMs: 50 },
      fixedClock(11),
    );
    const snap = agg.snapshot(fixedClock(20));
    expect(snap.mountAttempts).toBe(1);
    expect(snap.mountSuccesses).toBe(1);
    expect(snap.mountSuccessRate).toBe(1);
  });

  it('mount-attempted + mount-refused → rate === 0; refusal counted', () => {
    const agg = createMetricsAggregator();
    agg.ingest({ kind: 'mount-attempted', clipFamily: 'voice', clipId: 'c1' }, fixedClock(10));
    agg.ingest(
      {
        kind: 'mount-refused',
        reason: 'capability-insufficient',
        clipFamily: 'voice',
        clipId: 'c1',
      },
      fixedClock(11),
    );
    const snap = agg.snapshot(fixedClock(20));
    expect(snap.mountAttempts).toBe(1);
    expect(snap.mountRefusals).toBe(1);
    expect(snap.mountSuccessRate).toBe(0);
    expect(snap.refusalsByReason['capability-insufficient']).toBe(1);
  });

  it('mixed 9 attempts: 4 success + 5 refuse → mountSuccessRate === 4/9', () => {
    const agg = createMetricsAggregator();
    let t = 100;
    for (let i = 0; i < 9; i += 1) {
      agg.ingest({ kind: 'mount-attempted', clipFamily: 'shader', clipId: `c${i}` }, fixedClock(t));
      t += 1;
      if (i < 4) {
        agg.ingest(
          { kind: 'mount-success', clipFamily: 'shader', clipId: `c${i}`, elapsedMs: 10 },
          fixedClock(t),
        );
      } else {
        agg.ingest(
          {
            kind: 'mount-refused',
            reason: 'permission-refused',
            clipFamily: 'shader',
            clipId: `c${i}`,
          },
          fixedClock(t),
        );
      }
      t += 1;
    }
    const snap = agg.snapshot(fixedClock(1000), 10_000);
    expect(snap.mountAttempts).toBe(9);
    expect(snap.mountSuccesses).toBe(4);
    expect(snap.mountRefusals).toBe(5);
    expect(snap.mountSuccessRate).toBeCloseTo(4 / 9, 10);
  });

  it('refusalsByReason histogram: each of 5 reasons increments separately', () => {
    const agg = createMetricsAggregator();
    const reasons = [
      'tenant-flag-disabled',
      'preview-not-ga',
      'permission-refused',
      'capability-insufficient',
      'no-factory-registered',
    ] as const;
    let t = 100;
    for (const reason of reasons) {
      agg.ingest(
        { kind: 'mount-refused', reason, clipFamily: 'shader', clipId: 'c' },
        fixedClock(t),
      );
      t += 1;
    }
    const snap = agg.snapshot(fixedClock(200));
    for (const reason of reasons) {
      expect(snap.refusalsByReason[reason]).toBe(1);
    }
  });

  it('errorsByClipFamily: refusals attribute per-family', () => {
    const agg = createMetricsAggregator();
    agg.ingest(
      {
        kind: 'mount-refused',
        reason: 'capability-insufficient',
        clipFamily: 'voice',
        clipId: 'c1',
      },
      fixedClock(10),
    );
    agg.ingest(
      {
        kind: 'mount-refused',
        reason: 'capability-insufficient',
        clipFamily: 'voice',
        clipId: 'c2',
      },
      fixedClock(11),
    );
    agg.ingest(
      {
        kind: 'mount-refused',
        reason: 'no-factory-registered',
        clipFamily: 'shader',
        clipId: 'c3',
      },
      fixedClock(12),
    );
    const snap = agg.snapshot(fixedClock(100));
    expect(snap.errorsByClipFamily.voice).toBe(2);
    expect(snap.errorsByClipFamily.shader).toBe(1);
  });

  it('currentlyMounted: increments on success, decrements on unmount, clamps at 0', () => {
    const agg = createMetricsAggregator();
    agg.ingest(
      { kind: 'mount-success', clipFamily: 's', clipId: 'c1', elapsedMs: 1 },
      fixedClock(10),
    );
    agg.ingest(
      { kind: 'mount-success', clipFamily: 's', clipId: 'c2', elapsedMs: 1 },
      fixedClock(11),
    );
    expect(agg.snapshot(fixedClock(20)).currentlyMounted).toBe(2);

    agg.ingest({ kind: 'unmount', clipId: 'c1', clipFamily: 's' }, fixedClock(12));
    expect(agg.snapshot(fixedClock(20)).currentlyMounted).toBe(1);

    agg.ingest({ kind: 'unmount', clipId: 'c2', clipFamily: 's' }, fixedClock(13));
    agg.ingest({ kind: 'unmount', clipId: 'c3', clipFamily: 's' }, fixedClock(14));
    // Even with an extra unmount, currentlyMounted should clamp at 0
    expect(agg.snapshot(fixedClock(20)).currentlyMounted).toBe(0);
  });

  it('shutdown resets currentlyMounted to 0 in the window', () => {
    const agg = createMetricsAggregator();
    agg.ingest(
      { kind: 'mount-success', clipFamily: 's', clipId: 'c1', elapsedMs: 1 },
      fixedClock(10),
    );
    agg.ingest(
      { kind: 'mount-success', clipFamily: 's', clipId: 'c2', elapsedMs: 1 },
      fixedClock(11),
    );
    agg.ingest({ kind: 'shutdown', clipsUnmounted: 2 }, fixedClock(12));
    const snap = agg.snapshot(fixedClock(20));
    expect(snap.currentlyMounted).toBe(0);
    expect(snap.shutdownCount).toBe(1);
  });

  it('snapshot(clock, 60) excludes events older than 60s', () => {
    const agg = createMetricsAggregator();
    agg.ingest({ kind: 'mount-attempted', clipFamily: 's', clipId: 'old' }, fixedClock(10));
    agg.ingest({ kind: 'mount-attempted', clipFamily: 's', clipId: 'recent' }, fixedClock(90));
    const snap = agg.snapshot(fixedClock(100), 60);
    // window: [40, 100]; only 'recent' falls inside
    expect(snap.mountAttempts).toBe(1);
    expect(snap.windowStartedAtSec).toBe(40);
    expect(snap.windowDurationSec).toBe(60);
  });

  it('reset() clears all state', () => {
    const agg = createMetricsAggregator();
    agg.ingest({ kind: 'boot', device: DEVICE }, fixedClock(10));
    agg.ingest(
      { kind: 'mount-success', clipFamily: 's', clipId: 'c1', elapsedMs: 1 },
      fixedClock(11),
    );
    agg.reset();
    const snap = agg.snapshot(fixedClock(100));
    expect(snap.bootCount).toBe(0);
    expect(snap.mountSuccesses).toBe(0);
    expect(snap.currentlyMounted).toBe(0);
  });

  it('uptimePctSinceBoot: 1 boot, no shutdown → 1.0 (continuously up)', () => {
    const agg = createMetricsAggregator();
    agg.ingest({ kind: 'boot', device: DEVICE }, fixedClock(100));
    const snap = agg.snapshot(fixedClock(300));
    expect(snap.uptimePctSinceBoot).toBe(1);
  });

  it('uptimePctSinceBoot: 1 boot + 1 shutdown → 0.5 (rough mix)', () => {
    const agg = createMetricsAggregator();
    agg.ingest({ kind: 'boot', device: DEVICE }, fixedClock(100));
    agg.ingest({ kind: 'shutdown', clipsUnmounted: 0 }, fixedClock(200));
    const snap = agg.snapshot(fixedClock(300));
    expect(snap.uptimePctSinceBoot).toBe(0.5);
  });

  it('window default is 600 seconds', () => {
    const agg = createMetricsAggregator();
    agg.ingest({ kind: 'mount-attempted', clipFamily: 's', clipId: 'inside' }, fixedClock(500));
    agg.ingest({ kind: 'mount-attempted', clipFamily: 's', clipId: 'outside' }, fixedClock(100));
    // default window 600s: [now-600, now] = [400, 1000]; only 'inside' falls inside
    const snap = agg.snapshot(fixedClock(1000));
    expect(snap.mountAttempts).toBe(1);
    expect(snap.windowDurationSec).toBe(600);
  });

  it('refusalsByReason zeroes for unused reasons', () => {
    const agg = createMetricsAggregator();
    agg.ingest(
      {
        kind: 'mount-refused',
        reason: 'permission-refused',
        clipFamily: 's',
        clipId: 'c',
      },
      fixedClock(10),
    );
    const snap = agg.snapshot(fixedClock(100));
    expect(snap.refusalsByReason['permission-refused']).toBe(1);
    expect(snap.refusalsByReason['tenant-flag-disabled']).toBe(0);
    expect(snap.refusalsByReason['preview-not-ga']).toBe(0);
    expect(snap.refusalsByReason['capability-insufficient']).toBe(0);
    expect(snap.refusalsByReason['no-factory-registered']).toBe(0);
  });

  it('ingest is O(1) (smoke): 1000 events accepted without error', () => {
    const agg = createMetricsAggregator();
    for (let i = 0; i < 1000; i += 1) {
      const event: TelemetryEvent = {
        kind: 'mount-attempted',
        clipFamily: 'shader',
        clipId: `c${i}`,
      };
      agg.ingest(event, fixedClock(i));
    }
    expect(agg.snapshot(fixedClock(10_000), 10_000).mountAttempts).toBe(1000);
  });
});
