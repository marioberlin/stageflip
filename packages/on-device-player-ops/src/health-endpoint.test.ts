// packages/on-device-player-ops/src/health-endpoint.test.ts
// Tests for `buildHealthHandler` (T-401).

import type { HealthProbeReport } from '@stageflip/on-device-player-packaging';

import { describe, expect, it, vi } from 'vitest';

import { buildHealthHandler } from './health-endpoint.js';

const HEALTHY: HealthProbeReport = {
  status: 'healthy',
  uptimeSec: 3600,
  mountedClipCount: 2,
  lastMountAttempt: null,
  playerVersion: '1.0.0',
};

describe('buildHealthHandler', () => {
  it('GET /health → 200 with HealthProbeReport body', () => {
    const handler = buildHealthHandler({ probe: () => HEALTHY });
    const response = handler({ method: 'GET', path: '/health' });
    expect(response.status).toBe(200);
    expect(response.body).toEqual(HEALTHY);
  });

  it('POST /health → 405 method not allowed', () => {
    const handler = buildHealthHandler({ probe: () => HEALTHY });
    const response = handler({ method: 'POST', path: '/health' });
    expect(response.status).toBe(405);
    expect(response.body).toEqual({ error: 'method not allowed' });
  });

  it('GET /nothealth → 404 not found', () => {
    const handler = buildHealthHandler({ probe: () => HEALTHY });
    const response = handler({ method: 'GET', path: '/nothealth' });
    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: 'not found' });
  });

  it('probe callback invoked exactly once per successful request', () => {
    const probe = vi.fn(() => HEALTHY);
    const handler = buildHealthHandler({ probe });
    handler({ method: 'GET', path: '/health' });
    expect(probe).toHaveBeenCalledTimes(1);
  });

  it('probe callback NOT invoked on 405', () => {
    const probe = vi.fn(() => HEALTHY);
    const handler = buildHealthHandler({ probe });
    handler({ method: 'POST', path: '/health' });
    expect(probe).not.toHaveBeenCalled();
  });

  it('probe callback NOT invoked on 404', () => {
    const probe = vi.fn(() => HEALTHY);
    const handler = buildHealthHandler({ probe });
    handler({ method: 'GET', path: '/other' });
    expect(probe).not.toHaveBeenCalled();
  });
});
