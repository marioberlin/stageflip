// packages/marketplace-telemetry-dashboard/src/aggregations/activation-rate.test.ts
// T-541 — Coverage: empty, all-active, partial, mountedAnyClip=false ignored.

import { describe, expect, it } from 'vitest';

import type { TimeSeriesEvent } from '../storage/timeseries.js';
import { activationRate } from './activation-rate.js';

const HASH_A = 'a'.repeat(64);
const HASH_B = 'b'.repeat(64);

const install = (hash: string, version = '1.0.0'): TimeSeriesEvent => ({
  kind: 'install',
  packIdHash: hash,
  packVersion: version,
  at: '2026-05-13T00:00:00Z',
  payload: {},
});

const activation = (hash: string, mountedAnyClip: boolean, version = '1.0.0'): TimeSeriesEvent => ({
  kind: 'activation',
  packIdHash: hash,
  packVersion: version,
  at: '2026-05-13T01:00:00Z',
  payload: { mountedAnyClip },
});

describe('activationRate', () => {
  it('returns zeros for empty input', () => {
    expect(activationRate([])).toEqual({ installs: 0, activations: 0, rate: 0 });
  });

  it('returns rate 1.0 when every install produces an activation', () => {
    const out = activationRate([
      install(HASH_A),
      activation(HASH_A, true),
      install(HASH_B),
      activation(HASH_B, true),
    ]);
    expect(out).toEqual({ installs: 2, activations: 2, rate: 1 });
  });

  it('returns 0.5 for partial activation', () => {
    const out = activationRate([install(HASH_A), install(HASH_B), activation(HASH_A, true)]);
    expect(out).toEqual({ installs: 2, activations: 1, rate: 0.5 });
  });

  it('ignores activations with mountedAnyClip=false', () => {
    const out = activationRate([install(HASH_A), activation(HASH_A, false)]);
    expect(out).toEqual({ installs: 1, activations: 0, rate: 0 });
  });

  it('does not count activations with no matching install in the window', () => {
    const out = activationRate([install(HASH_A), activation(HASH_B, true)]);
    expect(out).toEqual({ installs: 1, activations: 0, rate: 0 });
  });
});
