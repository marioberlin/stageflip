// packages/pack-telemetry/src/events.test.ts
// T-503 — Unit tests for event factories + discriminator typing.

import { describe, expect, it } from 'vitest';

import {
  type PackTelemetryEvent,
  makeActivationEvent,
  makeInstallEvent,
  makeUsageEvent,
} from './events.js';

// A 64-char lowercase hex string standing in for a real SHA-256.
const STUB_HASH = 'a'.repeat(64);
const FIXED_MS = Date.UTC(2026, 4, 13, 12, 34, 56);

describe('events factories', () => {
  it('makeInstallEvent stamps kind="install" and preserves fields', () => {
    const ev = makeInstallEvent({
      packIdHash: STUB_HASH,
      packVersion: '1.2.3',
      licenseKind: 'paid-per-tenant',
      engineVersion: '0.42.0',
      platform: 'darwin',
      nowMs: FIXED_MS,
    });
    expect(ev.kind).toBe('install');
    expect(ev.packIdHash).toBe(STUB_HASH);
    expect(ev.packVersion).toBe('1.2.3');
    expect(ev.licenseKind).toBe('paid-per-tenant');
    expect(ev.engineVersion).toBe('0.42.0');
    expect(ev.platform).toBe('darwin');
  });

  it('makeActivationEvent stamps kind="activation"', () => {
    const ev = makeActivationEvent({
      packIdHash: STUB_HASH,
      packVersion: '1.0.0',
      mountedAnyClip: true,
      nowMs: FIXED_MS,
    });
    expect(ev.kind).toBe('activation');
    expect(ev.mountedAnyClip).toBe(true);
  });

  it('makeUsageEvent stamps kind="usage"', () => {
    const ev = makeUsageEvent({
      packIdHash: STUB_HASH,
      packVersion: '1.0.0',
      clipMountCount: 7,
      windowSeconds: 300,
      nowMs: FIXED_MS,
    });
    expect(ev.kind).toBe('usage');
    expect(ev.clipMountCount).toBe(7);
    expect(ev.windowSeconds).toBe(300);
  });

  it('produces ISO 8601 timestamps with second resolution (no millis)', () => {
    const evs: PackTelemetryEvent[] = [
      makeInstallEvent({
        packIdHash: STUB_HASH,
        packVersion: '1.0.0',
        licenseKind: 'open',
        engineVersion: '0.0.0',
        platform: 'linux',
        nowMs: FIXED_MS + 789,
      }),
      makeActivationEvent({
        packIdHash: STUB_HASH,
        packVersion: '1.0.0',
        mountedAnyClip: false,
        nowMs: FIXED_MS + 789,
      }),
      makeUsageEvent({
        packIdHash: STUB_HASH,
        packVersion: '1.0.0',
        clipMountCount: 0,
        windowSeconds: 60,
        nowMs: FIXED_MS + 789,
      }),
    ];
    for (const ev of evs) {
      expect(ev.at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
      expect(ev.at).not.toMatch(/\./);
    }
  });

  it('discriminator narrows the union by kind', () => {
    const ev: PackTelemetryEvent = makeUsageEvent({
      packIdHash: STUB_HASH,
      packVersion: '1.0.0',
      clipMountCount: 1,
      windowSeconds: 60,
      nowMs: FIXED_MS,
    });
    if (ev.kind === 'usage') {
      // Type narrowed — compile-time access works.
      expect(typeof ev.clipMountCount).toBe('number');
    } else {
      throw new Error('expected usage');
    }
  });

  it('rejects empty packIdHash', () => {
    expect(() =>
      makeInstallEvent({
        packIdHash: '',
        packVersion: '1.0.0',
        licenseKind: 'open',
        engineVersion: '0.0.0',
        platform: 'linux',
        nowMs: FIXED_MS,
      }),
    ).toThrow(/packIdHash/);
    expect(() =>
      makeActivationEvent({
        packIdHash: '',
        packVersion: '1.0.0',
        mountedAnyClip: false,
        nowMs: FIXED_MS,
      }),
    ).toThrow(/packIdHash/);
    expect(() =>
      makeUsageEvent({
        packIdHash: '',
        packVersion: '1.0.0',
        clipMountCount: 0,
        windowSeconds: 60,
        nowMs: FIXED_MS,
      }),
    ).toThrow(/packIdHash/);
  });

  it('rejects negative clipMountCount', () => {
    expect(() =>
      makeUsageEvent({
        packIdHash: STUB_HASH,
        packVersion: '1.0.0',
        clipMountCount: -1,
        windowSeconds: 60,
        nowMs: FIXED_MS,
      }),
    ).toThrow(/clipMountCount/);
  });

  it('rejects negative windowSeconds', () => {
    expect(() =>
      makeUsageEvent({
        packIdHash: STUB_HASH,
        packVersion: '1.0.0',
        clipMountCount: 0,
        windowSeconds: -5,
        nowMs: FIXED_MS,
      }),
    ).toThrow(/windowSeconds/);
  });

  it('rejects non-integer clipMountCount or windowSeconds', () => {
    expect(() =>
      makeUsageEvent({
        packIdHash: STUB_HASH,
        packVersion: '1.0.0',
        clipMountCount: 1.5,
        windowSeconds: 60,
        nowMs: FIXED_MS,
      }),
    ).toThrow(/clipMountCount/);
    expect(() =>
      makeUsageEvent({
        packIdHash: STUB_HASH,
        packVersion: '1.0.0',
        clipMountCount: 1,
        windowSeconds: 60.25,
        nowMs: FIXED_MS,
      }),
    ).toThrow(/windowSeconds/);
  });
});
