// packages/runtime-on-device-player/src/tenant-gate.test.ts
// Pure decision-function tests for `evaluateTenantGate`. The gate is the
// ADR-005 §D5 GA-only enforcement layer; these tests pin all three
// enum values + their (outcome, reason) tuples.

import { describe, expect, it } from 'vitest';

import { evaluateTenantGate } from './tenant-gate.js';

describe('evaluateTenantGate', () => {
  it('refuses with `tenant-flag-disabled` when featuresInteractive is `disabled`', () => {
    expect(evaluateTenantGate({ featuresInteractive: 'disabled' })).toEqual({
      outcome: 'mount-static-fallback',
      reason: 'tenant-flag-disabled',
    });
  });

  it('refuses with `preview-not-ga` when featuresInteractive is `preview`', () => {
    // Per ADR-005 §D5, on-device-player live-mount requires GA — the
    // `preview` posture is for HTML / browser-live-preview targets only.
    expect(evaluateTenantGate({ featuresInteractive: 'preview' })).toEqual({
      outcome: 'mount-static-fallback',
      reason: 'preview-not-ga',
    });
  });

  it('permits live-mount when featuresInteractive is `ga`', () => {
    expect(evaluateTenantGate({ featuresInteractive: 'ga' })).toEqual({
      outcome: 'mount-live',
      reason: 'live-permitted',
    });
  });
});
