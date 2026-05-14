// packages/on-device-player-packaging/src/health-probe.test.ts
// Tests for `buildHealthProbe` status decisioning.

import { describe, expect, it } from 'vitest';

import { buildHealthProbe } from './health-probe.js';

const BASE = {
  bootedAtSec: 1_000,
  nowSec: 1_120,
  mountedClipCount: 3,
  lastMountAttempt: null,
  playerVersion: '1.2.3',
  recentMountFailureThreshold: 5,
};

describe('buildHealthProbe', () => {
  it('reports healthy when failure count is below threshold', () => {
    const report = buildHealthProbe({ ...BASE, recentMountFailureCount: 0 });
    expect(report.status).toBe('healthy');
    expect(report.uptimeSec).toBe(120);
    expect(report.mountedClipCount).toBe(3);
    expect(report.playerVersion).toBe('1.2.3');
  });

  it('reports degraded when failure count reaches threshold', () => {
    const report = buildHealthProbe({ ...BASE, recentMountFailureCount: 5 });
    expect(report.status).toBe('degraded');
  });

  it('reports degraded when failures are between threshold and 2× threshold', () => {
    const report = buildHealthProbe({ ...BASE, recentMountFailureCount: 7 });
    expect(report.status).toBe('degraded');
  });

  it('reports failing when failure count reaches 2× threshold', () => {
    const report = buildHealthProbe({ ...BASE, recentMountFailureCount: 10 });
    expect(report.status).toBe('failing');
  });

  it('reports failing when failure count is well above 2× threshold', () => {
    const report = buildHealthProbe({ ...BASE, recentMountFailureCount: 99 });
    expect(report.status).toBe('failing');
  });

  it('clamps uptime to 0 if now < boot (clock skew safety)', () => {
    const report = buildHealthProbe({
      ...BASE,
      bootedAtSec: 1_500,
      nowSec: 1_000,
      recentMountFailureCount: 0,
    });
    expect(report.uptimeSec).toBe(0);
  });

  it('passes lastMountAttempt through verbatim', () => {
    const lastMountAttempt = {
      clipFamily: 'shader',
      outcome: 'mounted' as const,
      atSec: 1_100,
    };
    const report = buildHealthProbe({
      ...BASE,
      lastMountAttempt,
      recentMountFailureCount: 0,
    });
    expect(report.lastMountAttempt).toEqual(lastMountAttempt);
  });
});
