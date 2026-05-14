// packages/runtime-on-device-player/src/tenant-gate.ts
// Pure decision function — does the tenant's `features.interactive` value
// permit a live-mount on the on-device-player target? Per ADR-005 §D5,
// on-device-player live-mount requires `'ga'`; `'preview'` keeps it on
// `staticFallback` (preview mode is for HTML / browser live-preview only).

import type { OnDevicePlayerRefusalReason, TenantFlagValue } from './contract.js';

/**
 * Outcome of the tenant-flag gate. `'mount-live'` instructs the shim to
 * proceed through the capability + permission + factory chain;
 * `'mount-static-fallback'` instructs the shim to return the binary's
 * `staticFallback` payload without invoking the harness.
 */
export interface TenantGateDecision {
  readonly outcome: 'mount-live' | 'mount-static-fallback';
  readonly reason: OnDevicePlayerRefusalReason | 'live-permitted';
}

/**
 * Decide whether on-device live-mount is permitted for the supplied
 * tenant flag value. Pure function: no I/O, no side effects, safe for
 * any caller including determinism-gated code paths.
 *
 * Decisions per ADR-005 §D5:
 *   - `'disabled'` → refused with `'tenant-flag-disabled'`.
 *   - `'preview'` → refused with `'preview-not-ga'` (on-device requires GA).
 *   - `'ga'` → permitted.
 */
export function evaluateTenantGate(args: {
  readonly featuresInteractive: TenantFlagValue;
}): TenantGateDecision {
  switch (args.featuresInteractive) {
    case 'disabled':
      return { outcome: 'mount-static-fallback', reason: 'tenant-flag-disabled' };
    case 'preview':
      return { outcome: 'mount-static-fallback', reason: 'preview-not-ga' };
    case 'ga':
      return { outcome: 'mount-live', reason: 'live-permitted' };
  }
}
