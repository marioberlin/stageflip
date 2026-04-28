// tests/load/thresholds.test.ts
// AC #4 — pin thresholds.js: smoke values must be within 50% of full-load
// targets. Catches future drift where someone slacks the smoke budget without
// reviewer scrutiny.

import { describe, expect, it } from 'vitest';

import { SMOKE_VS_FULL_PINS } from './thresholds.js';

describe('thresholds.js — smoke vs full-load drift', () => {
  it('collab-sync smoke is within 50% headroom over full-load', () => {
    const { smokeMs, fullMs } = SMOKE_VS_FULL_PINS.collabSync;
    expect(smokeMs).toBeGreaterThanOrEqual(fullMs);
    expect(smokeMs).toBeLessThanOrEqual(fullMs * 1.5);
  });

  it('render-submit smoke is within 50% headroom over full-load', () => {
    const { smokeMs, fullMs } = SMOKE_VS_FULL_PINS.renderSubmit;
    expect(smokeMs).toBeGreaterThanOrEqual(fullMs);
    expect(smokeMs).toBeLessThanOrEqual(fullMs * 1.5);
  });

  it('render-submit smoke error rate is at most 2x full-load target', () => {
    const { smokeErrRate, fullErrRate } = SMOKE_VS_FULL_PINS.renderSubmit;
    if (smokeErrRate === undefined || fullErrRate === undefined) {
      throw new Error('render-submit pins must include smoke + full error-rate budgets');
    }
    expect(smokeErrRate).toBeGreaterThanOrEqual(fullErrRate);
    expect(smokeErrRate).toBeLessThanOrEqual(fullErrRate * 2);
  });

  it('api-mixed smoke is within 50% headroom over full-load', () => {
    const { smokeMs, fullMs } = SMOKE_VS_FULL_PINS.apiMixed;
    expect(smokeMs).toBeGreaterThanOrEqual(fullMs);
    expect(smokeMs).toBeLessThanOrEqual(fullMs * 1.5);
  });
});
