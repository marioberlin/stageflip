// packages/marketplace-npm/src/verifier/license-verifier.test.ts

import { describe, expect, it } from 'vitest';

import { InMemoryNpmTokenStore } from '../tokens/token-store.js';
import { verifyLicenseClaim } from './license-verifier.js';

describe('verifyLicenseClaim — open license', () => {
  it('open + no token + no entitlement → ok', async () => {
    const tokens = new InMemoryNpmTokenStore();
    const r = await verifyLicenseClaim(
      { license: { kind: 'open', spdx: 'MIT' }, publisherScope: '@stageflip' },
      tokens,
    );
    expect(r.ok).toBe(true);
    expect(r.reason).toBeUndefined();
  });

  it('open ignores any entitlement status', async () => {
    const tokens = new InMemoryNpmTokenStore();
    const r = await verifyLicenseClaim(
      {
        license: { kind: 'open', spdx: 'Apache-2.0' },
        publisherScope: '@stageflip',
        entitlementStatus: 'revoked',
      },
      tokens,
    );
    expect(r.ok).toBe(true);
  });
});

describe('verifyLicenseClaim — paid-per-tenant', () => {
  it('paid + token + active → ok', async () => {
    const tokens = new InMemoryNpmTokenStore();
    await tokens.store('@some-publisher', 'npm_tok');
    const r = await verifyLicenseClaim(
      {
        license: { kind: 'paid-per-tenant', sku: 'sports-networks' },
        publisherScope: '@some-publisher',
        entitlementStatus: 'active',
      },
      tokens,
    );
    expect(r.ok).toBe(true);
  });

  it('paid + no token → LF-NPM-TOKEN-MISSING', async () => {
    const tokens = new InMemoryNpmTokenStore();
    const r = await verifyLicenseClaim(
      {
        license: { kind: 'paid-per-tenant', sku: 'sports-networks' },
        publisherScope: '@some-publisher',
        entitlementStatus: 'active',
      },
      tokens,
    );
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('LF-NPM-TOKEN-MISSING');
    expect(r.detail).toContain('@some-publisher');
  });

  it('paid + token + lapsed → LF-LICENSE-PACK-DENIED', async () => {
    const tokens = new InMemoryNpmTokenStore();
    await tokens.store('@some-publisher', 'npm_tok');
    const r = await verifyLicenseClaim(
      {
        license: { kind: 'paid-per-tenant', sku: 'sports-networks' },
        publisherScope: '@some-publisher',
        entitlementStatus: 'lapsed',
      },
      tokens,
    );
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('LF-LICENSE-PACK-DENIED');
    expect(r.detail).toContain('lapsed');
  });

  it('paid + token + revoked → LF-LICENSE-CLIP-REVOKED', async () => {
    const tokens = new InMemoryNpmTokenStore();
    await tokens.store('@some-publisher', 'npm_tok');
    const r = await verifyLicenseClaim(
      {
        license: { kind: 'paid-per-tenant', sku: 'sports-networks' },
        publisherScope: '@some-publisher',
        entitlementStatus: 'revoked',
      },
      tokens,
    );
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('LF-LICENSE-CLIP-REVOKED');
  });

  it('paid + token + pending → LF-LICENSE-PACK-DENIED', async () => {
    const tokens = new InMemoryNpmTokenStore();
    await tokens.store('@some-publisher', 'npm_tok');
    const r = await verifyLicenseClaim(
      {
        license: { kind: 'paid-per-tenant', sku: 'sports-networks' },
        publisherScope: '@some-publisher',
        entitlementStatus: 'pending',
      },
      tokens,
    );
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('LF-LICENSE-PACK-DENIED');
  });

  it('paid + token + null entitlement → LF-LICENSE-PACK-DENIED', async () => {
    const tokens = new InMemoryNpmTokenStore();
    await tokens.store('@some-publisher', 'npm_tok');
    const r = await verifyLicenseClaim(
      {
        license: { kind: 'paid-per-tenant', sku: 'sports-networks' },
        publisherScope: '@some-publisher',
        entitlementStatus: null,
      },
      tokens,
    );
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('LF-LICENSE-PACK-DENIED');
    expect(r.detail).toContain('missing');
  });

  it('paid + token + omitted entitlement → LF-LICENSE-PACK-DENIED', async () => {
    const tokens = new InMemoryNpmTokenStore();
    await tokens.store('@some-publisher', 'npm_tok');
    const r = await verifyLicenseClaim(
      {
        license: { kind: 'paid-per-tenant', sku: 'sports-networks' },
        publisherScope: '@some-publisher',
      },
      tokens,
    );
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('LF-LICENSE-PACK-DENIED');
  });
});

describe('verifyLicenseClaim — enterprise', () => {
  it('enterprise + token + active → ok', async () => {
    const tokens = new InMemoryNpmTokenStore();
    await tokens.store('@ent-publisher', 'npm_tok');
    const r = await verifyLicenseClaim(
      {
        license: { kind: 'enterprise', sku: 'ent-sku' },
        publisherScope: '@ent-publisher',
        entitlementStatus: 'active',
      },
      tokens,
    );
    expect(r.ok).toBe(true);
  });

  it('enterprise + no token → LF-NPM-TOKEN-MISSING', async () => {
    const tokens = new InMemoryNpmTokenStore();
    const r = await verifyLicenseClaim(
      {
        license: { kind: 'enterprise', sku: 'ent-sku' },
        publisherScope: '@ent-publisher',
        entitlementStatus: 'active',
      },
      tokens,
    );
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('LF-NPM-TOKEN-MISSING');
  });

  it('enterprise + token + lapsed → LF-LICENSE-PACK-DENIED', async () => {
    const tokens = new InMemoryNpmTokenStore();
    await tokens.store('@ent-publisher', 'npm_tok');
    const r = await verifyLicenseClaim(
      {
        license: { kind: 'enterprise', sku: 'ent-sku' },
        publisherScope: '@ent-publisher',
        entitlementStatus: 'lapsed',
      },
      tokens,
    );
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('LF-LICENSE-PACK-DENIED');
  });
});

describe('verifyLicenseClaim — invariants', () => {
  it('throws on unknown license.kind', async () => {
    const tokens = new InMemoryNpmTokenStore();
    await expect(
      verifyLicenseClaim(
        {
          // @ts-expect-error — deliberately invalid kind for the throw test.
          license: { kind: 'mystery' },
          publisherScope: '@x',
        },
        tokens,
      ),
    ).rejects.toThrow(/unknown license.kind/);
  });
});
