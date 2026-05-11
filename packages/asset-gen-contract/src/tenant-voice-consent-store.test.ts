// packages/asset-gen-contract/src/tenant-voice-consent-store.test.ts
// TenantVoiceConsentStore tests — Zod schema round-trip / reject / interface
// shape compiles against the contract.

import { describe, expect, it } from 'vitest';

import {
  type AssertActiveInput,
  type CreateTenantVoiceConsentInput,
  TENANT_VOICE_CONSENT_GRANT_BASES,
  type TenantVoiceConsentRow,
  type TenantVoiceConsentStore,
  tenantVoiceConsentRowSchema,
} from './tenant-voice-consent-store.js';

const validRow: TenantVoiceConsentRow = {
  id: '01HXYZ',
  tenantId: 'tenant-123',
  voiceProvider: 'fish-speech',
  voiceId: 'voice-mario',
  grantedBy: 'admin-1',
  grantedAt: '2026-05-11T10:00:00Z',
  grantBasis: 'self',
};

describe('tenantVoiceConsentRowSchema', () => {
  it('parses a minimal valid row', () => {
    expect(tenantVoiceConsentRowSchema.parse(validRow)).toEqual(validRow);
  });

  it('parses with optional fields set', () => {
    const row: TenantVoiceConsentRow = {
      ...validRow,
      evidenceUri: 's3://bucket/consent-form.pdf',
      revokedAt: '2026-06-01T10:00:00Z',
    };
    expect(tenantVoiceConsentRowSchema.parse(row)).toEqual(row);
  });

  it('round-trips every grantBasis literal', () => {
    expect(TENANT_VOICE_CONSENT_GRANT_BASES).toHaveLength(3);
    for (const basis of TENANT_VOICE_CONSENT_GRANT_BASES) {
      const row: TenantVoiceConsentRow = { ...validRow, grantBasis: basis };
      expect(tenantVoiceConsentRowSchema.parse(row).grantBasis).toBe(basis);
    }
  });

  it('rejects unknown grantBasis literal', () => {
    expect(() =>
      tenantVoiceConsentRowSchema.parse({ ...validRow, grantBasis: 'community-pool' }),
    ).toThrow();
  });

  it('rejects empty tenantId', () => {
    expect(() => tenantVoiceConsentRowSchema.parse({ ...validRow, tenantId: '' })).toThrow();
  });

  it('rejects empty voiceProvider', () => {
    expect(() => tenantVoiceConsentRowSchema.parse({ ...validRow, voiceProvider: '' })).toThrow();
  });

  it('rejects unknown top-level fields (strict)', () => {
    expect(() => tenantVoiceConsentRowSchema.parse({ ...validRow, extra: 'no' })).toThrow();
  });

  it('rejects missing required field', () => {
    const { grantedBy: _grantedBy, ...rest } = validRow;
    expect(() => tenantVoiceConsentRowSchema.parse(rest)).toThrow();
  });
});

describe('TenantVoiceConsentStore interface', () => {
  it('compiles a stub implementation', async () => {
    // Type-level + lightweight runtime check: a stub implementing the
    // contract type-checks and behaves per §D4 (assertActive throws on
    // missing rows).
    const rows = new Map<string, TenantVoiceConsentRow>();
    const stub: TenantVoiceConsentStore = {
      async get(id) {
        return rows.get(id);
      },
      async listForTenant(tenantId) {
        return Array.from(rows.values()).filter((r) => r.tenantId === tenantId);
      },
      async assertActive(input: AssertActiveInput): Promise<TenantVoiceConsentRow> {
        const match = Array.from(rows.values()).find(
          (r) =>
            r.tenantId === input.tenantId &&
            r.voiceProvider === input.voiceProvider &&
            r.voiceId === input.voiceId &&
            r.revokedAt === undefined,
        );
        if (match === undefined) {
          throw new Error('LF-VOICE-CONSENT-MISSING');
        }
        return match;
      },
      async create(input: CreateTenantVoiceConsentInput): Promise<TenantVoiceConsentRow> {
        const id = `id-${rows.size + 1}`;
        const row: TenantVoiceConsentRow = {
          ...input,
          id,
          grantedAt: '2026-05-11T10:00:00Z',
        };
        rows.set(id, row);
        return row;
      },
      async revoke(id, revokedAt) {
        const existing = rows.get(id);
        if (existing === undefined) return;
        rows.set(id, { ...existing, revokedAt });
      },
    };

    // Pre-create: assertActive throws (no row).
    await expect(
      stub.assertActive({
        tenantId: validRow.tenantId,
        voiceProvider: validRow.voiceProvider,
        voiceId: validRow.voiceId,
      }),
    ).rejects.toThrow('LF-VOICE-CONSENT-MISSING');

    // Create + assertActive succeeds.
    const created = await stub.create({
      tenantId: validRow.tenantId,
      voiceProvider: validRow.voiceProvider,
      voiceId: validRow.voiceId,
      grantedBy: validRow.grantedBy,
      grantBasis: 'self',
    });
    const fetched = await stub.assertActive({
      tenantId: validRow.tenantId,
      voiceProvider: validRow.voiceProvider,
      voiceId: validRow.voiceId,
    });
    expect(fetched.id).toBe(created.id);

    // listForTenant returns it.
    const list = await stub.listForTenant(validRow.tenantId);
    expect(list).toHaveLength(1);

    // get by id returns it.
    expect(await stub.get(created.id)).toEqual(created);

    // After revoke, assertActive throws again.
    await stub.revoke(created.id, '2026-06-01T10:00:00Z');
    await expect(
      stub.assertActive({
        tenantId: validRow.tenantId,
        voiceProvider: validRow.voiceProvider,
        voiceId: validRow.voiceId,
      }),
    ).rejects.toThrow('LF-VOICE-CONSENT-MISSING');

    // get for unknown id returns undefined.
    expect(await stub.get('does-not-exist')).toBeUndefined();
  });
});
