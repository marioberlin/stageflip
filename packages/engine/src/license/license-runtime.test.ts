// packages/engine/src/license/license-runtime.test.ts
// Unit tests for the clip-mount license gate (ADR-012 §D6 point 2).
// Each test drives canMountClip through one branch and asserts the
// returned LicenseMountResult shape.

import type { PackManifest } from '@stageflip/pack-format';
import type { TenantEntitlement, TenantEntitlementsLike } from '@stageflip/pack-loader';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { LicenseRuntime } from './license-runtime.js';

function entitlementsShim(
  map: Record<string, TenantEntitlement | null>,
): TenantEntitlementsLike & { calls: { sku: string }[] } {
  const calls: { sku: string }[] = [];
  const shim: TenantEntitlementsLike & { calls: { sku: string }[] } = {
    calls,
    async getEntitlement(sku: string) {
      calls.push({ sku });
      return map[sku] ?? null;
    },
  };
  return shim;
}

function baseManifest(overrides: Partial<PackManifest> = {}): PackManifest {
  return {
    manifestVersion: '1',
    id: 'demo-pack',
    name: 'Demo Pack',
    version: '1.0.0',
    publisher: { id: 'pub-1', displayName: 'Pub 1' },
    platformCompatibility: '^2.0.0',
    license: { kind: 'open', spdx: 'MIT' },
    integrity: { algorithm: 'sha256', hash: 'a'.repeat(64) },
    contributes: {},
    ...overrides,
  } as PackManifest;
}

function activeEntitlement(sku: string): TenantEntitlement {
  return {
    sku,
    entitlementType: 'subscription',
    status: 'active',
    issuedAt: '2026-01-01T00:00:00Z',
  };
}

describe('LicenseRuntime', () => {
  let entitlements: ReturnType<typeof entitlementsShim>;

  beforeEach(() => {
    entitlements = entitlementsShim({});
  });

  it('returns ok for an unknown clipKind (core / built-in clips are implicitly licensed)', async () => {
    const runtime = new LicenseRuntime({ entitlements });
    const result = await runtime.canMountClip('never-registered-kind');
    expect(result).toEqual({ ok: true });
    expect(entitlements.calls).toHaveLength(0);
  });

  it('returns ok for an open-licensed clip without consulting entitlements', async () => {
    const runtime = new LicenseRuntime({ entitlements });
    runtime.registerPack(
      baseManifest({
        contributes: { clipKinds: [{ kind: 'open.weather', module: './weather.js' }] },
      }),
    );

    const result = await runtime.canMountClip('open.weather');
    expect(result).toEqual({ ok: true });
    expect(entitlements.calls).toHaveLength(0);
  });

  it('returns ok for a paid clip with an active entitlement', async () => {
    entitlements = entitlementsShim({ 'sku-1': activeEntitlement('sku-1') });
    const runtime = new LicenseRuntime({ entitlements });
    runtime.registerPack(
      baseManifest({
        license: { kind: 'paid-per-tenant', sku: 'sku-1', entitlementType: 'subscription' },
        contributes: { clipKinds: [{ kind: 'paid.bar', module: './bar.js' }] },
      }),
    );

    const result = await runtime.canMountClip('paid.bar');
    expect(result.ok).toBe(true);
    expect(entitlements.calls).toHaveLength(1);
  });

  it('returns LF-LICENSE-CLIP-REVOKED for a paid clip whose entitlement is lapsed', async () => {
    entitlements = entitlementsShim({
      'sku-1': {
        sku: 'sku-1',
        entitlementType: 'subscription',
        status: 'lapsed',
        issuedAt: '2026-01-01T00:00:00Z',
      },
    });
    const runtime = new LicenseRuntime({ entitlements });
    runtime.registerPack(
      baseManifest({
        license: { kind: 'paid-per-tenant', sku: 'sku-1', entitlementType: 'subscription' },
        contributes: { clipKinds: [{ kind: 'paid.bar', module: './bar.js' }] },
      }),
    );

    const result = await runtime.canMountClip('paid.bar');
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('LF-LICENSE-CLIP-REVOKED');
    expect(result.detail).toMatch(/lapsed/);
  });

  it('returns LF-LICENSE-CLIP-REVOKED for a paid clip whose entitlement is revoked', async () => {
    entitlements = entitlementsShim({
      'sku-1': {
        sku: 'sku-1',
        entitlementType: 'subscription',
        status: 'revoked',
        issuedAt: '2026-01-01T00:00:00Z',
      },
    });
    const runtime = new LicenseRuntime({ entitlements });
    runtime.registerPack(
      baseManifest({
        license: { kind: 'paid-per-tenant', sku: 'sku-1', entitlementType: 'subscription' },
        contributes: { clipKinds: [{ kind: 'paid.bar', module: './bar.js' }] },
      }),
    );

    const result = await runtime.canMountClip('paid.bar');
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('LF-LICENSE-CLIP-REVOKED');
    expect(result.detail).toMatch(/revoked/);
  });

  it('returns LF-LICENSE-CLIP-REVOKED for a paid clip whose entitlement is pending', async () => {
    entitlements = entitlementsShim({
      'sku-1': {
        sku: 'sku-1',
        entitlementType: 'subscription',
        status: 'pending',
        issuedAt: '2026-01-01T00:00:00Z',
      },
    });
    const runtime = new LicenseRuntime({ entitlements });
    runtime.registerPack(
      baseManifest({
        license: { kind: 'paid-per-tenant', sku: 'sku-1', entitlementType: 'subscription' },
        contributes: { clipKinds: [{ kind: 'paid.bar', module: './bar.js' }] },
      }),
    );

    const result = await runtime.canMountClip('paid.bar');
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('LF-LICENSE-CLIP-REVOKED');
    expect(result.detail).toMatch(/pending/);
  });

  it('returns LF-LICENSE-CLIP-REVOKED for a paid clip with no entitlement at all', async () => {
    const runtime = new LicenseRuntime({ entitlements });
    runtime.registerPack(
      baseManifest({
        license: { kind: 'paid-per-tenant', sku: 'sku-1', entitlementType: 'subscription' },
        contributes: { clipKinds: [{ kind: 'paid.bar', module: './bar.js' }] },
      }),
    );

    const result = await runtime.canMountClip('paid.bar');
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('LF-LICENSE-CLIP-REVOKED');
    expect(result.detail).toMatch(/no entitlement/i);
  });

  it('treats enterprise clips identically to paid (active passes)', async () => {
    entitlements = entitlementsShim({ 'ent-1': activeEntitlement('ent-1') });
    const runtime = new LicenseRuntime({ entitlements });
    runtime.registerPack(
      baseManifest({
        license: { kind: 'enterprise', sku: 'ent-1', contractRef: 'C-001' },
        contributes: { clipKinds: [{ kind: 'ent.thing', module: './thing.js' }] },
      }),
    );

    const result = await runtime.canMountClip('ent.thing');
    expect(result.ok).toBe(true);
  });

  it('treats enterprise clips identically to paid (revoked emits LF-LICENSE-CLIP-REVOKED)', async () => {
    entitlements = entitlementsShim({
      'ent-1': {
        sku: 'ent-1',
        entitlementType: 'one-time',
        status: 'revoked',
        issuedAt: '2026-01-01T00:00:00Z',
        contractRef: 'C-001',
      },
    });
    const runtime = new LicenseRuntime({ entitlements });
    runtime.registerPack(
      baseManifest({
        license: { kind: 'enterprise', sku: 'ent-1', contractRef: 'C-001' },
        contributes: { clipKinds: [{ kind: 'ent.thing', module: './thing.js' }] },
      }),
    );

    const result = await runtime.canMountClip('ent.thing');
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('LF-LICENSE-CLIP-REVOKED');
  });

  it('caches entitlement lookups within the TTL — two mount calls = one fetch', async () => {
    entitlements = entitlementsShim({ 'sku-1': activeEntitlement('sku-1') });
    const runtime = new LicenseRuntime({ entitlements });
    runtime.registerPack(
      baseManifest({
        license: { kind: 'paid-per-tenant', sku: 'sku-1', entitlementType: 'subscription' },
        contributes: { clipKinds: [{ kind: 'paid.bar', module: './bar.js' }] },
      }),
    );

    await runtime.canMountClip('paid.bar');
    await runtime.canMountClip('paid.bar');
    expect(entitlements.calls).toHaveLength(1);
  });

  it('clearCache() forces re-fetch on the next mount', async () => {
    entitlements = entitlementsShim({ 'sku-1': activeEntitlement('sku-1') });
    const runtime = new LicenseRuntime({ entitlements });
    runtime.registerPack(
      baseManifest({
        license: { kind: 'paid-per-tenant', sku: 'sku-1', entitlementType: 'subscription' },
        contributes: { clipKinds: [{ kind: 'paid.bar', module: './bar.js' }] },
      }),
    );

    await runtime.canMountClip('paid.bar');
    runtime.clearCache();
    await runtime.canMountClip('paid.bar');
    expect(entitlements.calls).toHaveLength(2);
  });

  it('re-fetches after TTL expires', async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
      entitlements = entitlementsShim({ 'sku-1': activeEntitlement('sku-1') });
      const runtime = new LicenseRuntime({ entitlements, cacheTtlMs: 1000 });
      runtime.registerPack(
        baseManifest({
          license: { kind: 'paid-per-tenant', sku: 'sku-1', entitlementType: 'subscription' },
          contributes: { clipKinds: [{ kind: 'paid.bar', module: './bar.js' }] },
        }),
      );

      await runtime.canMountClip('paid.bar');
      vi.setSystemTime(new Date('2026-01-01T00:00:02Z')); // +2s past 1s TTL
      await runtime.canMountClip('paid.bar');
      expect(entitlements.calls).toHaveLength(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it("routes multiple packs with disjoint clipKinds to each pack's own license", async () => {
    entitlements = entitlementsShim({ 'sku-a': activeEntitlement('sku-a') });
    const runtime = new LicenseRuntime({ entitlements });
    runtime.registerPack(
      baseManifest({
        id: 'pack-a',
        license: { kind: 'paid-per-tenant', sku: 'sku-a', entitlementType: 'subscription' },
        contributes: { clipKinds: [{ kind: 'a.thing', module: './a.js' }] },
      }),
    );
    runtime.registerPack(
      baseManifest({
        id: 'pack-b',
        license: { kind: 'open', spdx: 'MIT' },
        contributes: { clipKinds: [{ kind: 'b.thing', module: './b.js' }] },
      }),
    );

    const a = await runtime.canMountClip('a.thing');
    const b = await runtime.canMountClip('b.thing');
    expect(a.ok).toBe(true);
    expect(b.ok).toBe(true);
    // Only the paid pack consulted entitlements.
    expect(entitlements.calls).toEqual([{ sku: 'sku-a' }]);
  });

  it('shares a single license record across multiple clipKinds in one pack', async () => {
    entitlements = entitlementsShim({ 'sku-shared': activeEntitlement('sku-shared') });
    const runtime = new LicenseRuntime({ entitlements });
    runtime.registerPack(
      baseManifest({
        license: { kind: 'paid-per-tenant', sku: 'sku-shared', entitlementType: 'subscription' },
        contributes: {
          clipKinds: [
            { kind: 'multi.a', module: './a.js' },
            { kind: 'multi.b', module: './b.js' },
          ],
        },
      }),
    );

    const a = await runtime.canMountClip('multi.a');
    const b = await runtime.canMountClip('multi.b');
    expect(a.ok).toBe(true);
    expect(b.ok).toBe(true);
    // Cache shares the sku across both clipKinds → single fetch.
    expect(entitlements.calls).toHaveLength(1);
  });

  it('handles a pack with no clipKind contributions (e.g. fonts-only pack) without throwing', () => {
    const runtime = new LicenseRuntime({ entitlements });
    expect(() =>
      runtime.registerPack(
        baseManifest({ contributes: { fonts: [{ family: 'X', license: 'OFL' }] } }),
      ),
    ).not.toThrow();
  });

  // T-505 — trial-mode behaviour

  it('T-505: trial entitlement → ok:true + LF-LICENSE-TRIAL-ACTIVE warning', async () => {
    entitlements = entitlementsShim({
      'sku-1': {
        sku: 'sku-1',
        entitlementType: 'subscription',
        status: 'trial',
        issuedAt: '2026-01-01T00:00:00Z',
        expiresAt: '2099-01-01T00:00:00Z',
      },
    });
    const runtime = new LicenseRuntime({ entitlements });
    runtime.registerPack(
      baseManifest({
        id: 'trial-pack',
        license: { kind: 'paid-per-tenant', sku: 'sku-1', entitlementType: 'subscription' },
        contributes: { clipKinds: [{ kind: 'trial.bar', module: './bar.js' }] },
      }),
    );

    const result = await runtime.canMountClip('trial.bar');
    expect(result.ok).toBe(true);
    expect(result.warning?.code).toBe('LF-LICENSE-TRIAL-ACTIVE');
    expect(result.warning?.detail).toContain('trial-pack');
  });

  it('T-505: trial entitlement with no expiresAt → ok:true + warning (perpetual trial)', async () => {
    entitlements = entitlementsShim({
      'sku-1': {
        sku: 'sku-1',
        entitlementType: 'subscription',
        status: 'trial',
        issuedAt: '2026-01-01T00:00:00Z',
      },
    });
    const runtime = new LicenseRuntime({ entitlements });
    runtime.registerPack(
      baseManifest({
        license: { kind: 'paid-per-tenant', sku: 'sku-1', entitlementType: 'subscription' },
        contributes: { clipKinds: [{ kind: 'trial.perp', module: './perp.js' }] },
      }),
    );

    const result = await runtime.canMountClip('trial.perp');
    expect(result.ok).toBe(true);
    expect(result.warning?.code).toBe('LF-LICENSE-TRIAL-ACTIVE');
  });

  it('T-505: expired trial entitlement → ok:false + LF-LICENSE-TRIAL-EXPIRED', async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date('2026-05-13T12:00:00Z'));
      entitlements = entitlementsShim({
        'sku-1': {
          sku: 'sku-1',
          entitlementType: 'subscription',
          status: 'trial',
          issuedAt: '2024-01-01T00:00:00Z',
          expiresAt: '2024-02-01T00:00:00Z',
        },
      });
      const runtime = new LicenseRuntime({ entitlements });
      runtime.registerPack(
        baseManifest({
          id: 'expired-pack',
          license: { kind: 'paid-per-tenant', sku: 'sku-1', entitlementType: 'subscription' },
          contributes: { clipKinds: [{ kind: 'expired.bar', module: './bar.js' }] },
        }),
      );

      const result = await runtime.canMountClip('expired.bar');
      expect(result.ok).toBe(false);
      expect(result.reason).toBe('LF-LICENSE-TRIAL-EXPIRED');
      expect(result.detail).toContain('expired-pack');
      expect(result.detail).toContain('2024-02-01');
    } finally {
      vi.useRealTimers();
    }
  });

  it('T-505: active (non-trial) entitlement still returns plain {ok:true} with no warning', async () => {
    entitlements = entitlementsShim({ 'sku-1': activeEntitlement('sku-1') });
    const runtime = new LicenseRuntime({ entitlements });
    runtime.registerPack(
      baseManifest({
        license: { kind: 'paid-per-tenant', sku: 'sku-1', entitlementType: 'subscription' },
        contributes: { clipKinds: [{ kind: 'paid.bar', module: './bar.js' }] },
      }),
    );

    const result = await runtime.canMountClip('paid.bar');
    expect(result.ok).toBe(true);
    expect(result.warning).toBeUndefined();
  });
});
