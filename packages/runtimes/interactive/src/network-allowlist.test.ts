// packages/runtimes/interactive/src/network-allowlist.test.ts
// T-403 R-5 — closure tests for the global URL allowlist + warn-then-
// enforce rollout. Covers the allowlist module's pure surface
// (`extendNetworkAllowedHosts`, `isNetworkHostAllowed`,
// `evaluateNetworkGate`, `__resetNetworkAllowlistForTests`) without
// touching the PermissionShim — that integration lives in
// `permission-shim.test.ts`.

import { beforeEach, describe, expect, it } from 'vitest';

import {
  ENFORCEMENT_STARTS_AT,
  NETWORK_ALLOWED_HOST_PATTERNS,
  __resetNetworkAllowlistForTests,
  evaluateNetworkGate,
  extendNetworkAllowedHosts,
  isNetworkHostAllowed,
} from './network-allowlist.js';

const BEFORE_CUTOVER = '2026-05-20T00:00:00.000Z'; // warn window
const AT_CUTOVER = '2026-06-13T00:00:00.000Z'; // boundary (inclusive enforce)
const AFTER_CUTOVER = '2026-07-01T00:00:00.000Z'; // post-enforcement

describe('network-allowlist (T-403 R-5)', () => {
  beforeEach(() => {
    __resetNetworkAllowlistForTests();
  });

  it('ENFORCEMENT_STARTS_AT is 2026-06-13 (30 days from PO decision 2026-05-14)', () => {
    expect(ENFORCEMENT_STARTS_AT).toBe('2026-06-13');
  });

  it('empty allowlist: isNetworkHostAllowed returns false for any host', () => {
    expect(isNetworkHostAllowed('any-host')).toBe(false);
    expect(isNetworkHostAllowed('api.stageflip.com')).toBe(false);
  });

  it('extendNetworkAllowedHosts adds a pattern and isNetworkHostAllowed matches', () => {
    extendNetworkAllowedHosts([/^api\.stageflip\.com$/]);
    expect(isNetworkHostAllowed('api.stageflip.com')).toBe(true);
    expect(isNetworkHostAllowed('evil.example.com')).toBe(false);
  });

  it('extendNetworkAllowedHosts merges (does not replace) on a second call', () => {
    extendNetworkAllowedHosts([/^api\.stageflip\.com$/]);
    extendNetworkAllowedHosts([/^cdn\.stageflip\.com$/]);
    expect(isNetworkHostAllowed('api.stageflip.com')).toBe(true);
    expect(isNetworkHostAllowed('cdn.stageflip.com')).toBe(true);
  });

  it('extendNetworkAllowedHosts dedups by source+flags', () => {
    extendNetworkAllowedHosts([/^api\.stageflip\.com$/]);
    extendNetworkAllowedHosts([/^api\.stageflip\.com$/]);
    extendNetworkAllowedHosts([/^api\.stageflip\.com$/i]); // different flags → kept
    const snapshot = NETWORK_ALLOWED_HOST_PATTERNS();
    expect(snapshot).toHaveLength(2);
  });

  it('NETWORK_ALLOWED_HOST_PATTERNS returns a fresh snapshot (mutation does not leak)', () => {
    extendNetworkAllowedHosts([/^api\.stageflip\.com$/]);
    const snapshot = NETWORK_ALLOWED_HOST_PATTERNS();
    (snapshot as RegExp[]).push(/^evil\.example\.com$/);
    expect(isNetworkHostAllowed('evil.example.com')).toBe(false);
  });

  it('__resetNetworkAllowlistForTests clears state', () => {
    extendNetworkAllowedHosts([/^api\.stageflip\.com$/]);
    expect(isNetworkHostAllowed('api.stageflip.com')).toBe(true);
    __resetNetworkAllowlistForTests();
    expect(isNetworkHostAllowed('api.stageflip.com')).toBe(false);
    expect(NETWORK_ALLOWED_HOST_PATTERNS()).toHaveLength(0);
  });

  it('evaluateNetworkGate during warn window with no destinationHost → permit / warn', () => {
    const decision = evaluateNetworkGate({ nowIso: BEFORE_CUTOVER });
    expect(decision.outcome).toBe('permit');
    expect(decision.mode).toBe('warn');
    expect(decision.reason).toBe('enforcement-pending');
  });

  it('evaluateNetworkGate during warn window with non-allowlisted destinationHost → warn-only / warn', () => {
    const decision = evaluateNetworkGate({
      nowIso: BEFORE_CUTOVER,
      destinationHost: 'evil.example.com',
    });
    expect(decision.outcome).toBe('warn-only');
    expect(decision.mode).toBe('warn');
    expect(decision.reason).toBe('host-not-allowlisted-warn');
  });

  it('evaluateNetworkGate during warn window with allowlisted destinationHost → permit / warn', () => {
    extendNetworkAllowedHosts([/^api\.stageflip\.com$/]);
    const decision = evaluateNetworkGate({
      nowIso: BEFORE_CUTOVER,
      destinationHost: 'api.stageflip.com',
    });
    expect(decision.outcome).toBe('permit');
    expect(decision.mode).toBe('warn');
    expect(decision.reason).toBe('host-allowlisted');
  });

  it('evaluateNetworkGate after enforcement with no destinationHost → permit (coarse-only)', () => {
    const decision = evaluateNetworkGate({ nowIso: AFTER_CUTOVER });
    expect(decision.outcome).toBe('permit');
    expect(decision.mode).toBe('enforce');
    expect(decision.reason).toBe('enforcement-pending');
  });

  it('evaluateNetworkGate after enforcement with non-allowlisted destinationHost → block / enforce', () => {
    const decision = evaluateNetworkGate({
      nowIso: AFTER_CUTOVER,
      destinationHost: 'evil.example.com',
    });
    expect(decision.outcome).toBe('block');
    expect(decision.mode).toBe('enforce');
    expect(decision.reason).toBe('host-not-allowlisted-block');
  });

  it('evaluateNetworkGate after enforcement with allowlisted destinationHost → permit / enforce', () => {
    extendNetworkAllowedHosts([/^api\.stageflip\.com$/]);
    const decision = evaluateNetworkGate({
      nowIso: AFTER_CUTOVER,
      destinationHost: 'api.stageflip.com',
    });
    expect(decision.outcome).toBe('permit');
    expect(decision.mode).toBe('enforce');
    expect(decision.reason).toBe('host-allowlisted');
  });

  it('evaluateNetworkGate at exactly ENFORCEMENT_STARTS_AT → enforce (inclusive boundary)', () => {
    const decision = evaluateNetworkGate({
      nowIso: AT_CUTOVER,
      destinationHost: 'evil.example.com',
    });
    expect(decision.mode).toBe('enforce');
    expect(decision.outcome).toBe('block');
  });

  it('evaluateNetworkGate honours custom enforcementStartsAt override', () => {
    // Custom cutover way in the future: even AFTER_CUTOVER stays in warn-mode.
    const decision = evaluateNetworkGate({
      nowIso: AFTER_CUTOVER,
      destinationHost: 'evil.example.com',
      enforcementStartsAt: '2099-01-01T00:00:00.000Z',
    });
    expect(decision.mode).toBe('warn');
    expect(decision.outcome).toBe('warn-only');
  });
});
