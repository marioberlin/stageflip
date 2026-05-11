// packages/storage/src/tenant-settings.test.ts
// Unit tests for the TenantSettings Zod schema (T-411a AC #1–6).
// Asserts: round-trip on valid input; strict-key rejection at outer + nested
// object; enum validation; required-field enforcement; ISO datetime check.

import { describe, expect, it } from 'vitest';
import { type TenantSettings, tenantSettingsSchema } from './tenant-settings.js';

const valid: TenantSettings = {
  tenantId: 'tenant-1',
  features: { interactive: 'disabled' },
  updatedAt: '2026-05-11T00:00:00.000Z',
  updatedBy: 'system',
};

describe('tenantSettingsSchema', () => {
  it('round-trips a valid payload', () => {
    expect(tenantSettingsSchema.parse(valid)).toEqual(valid);
  });

  it.each(['disabled', 'preview', 'ga'] as const)('accepts features.interactive = %s', (value) => {
    const ok = tenantSettingsSchema.parse({ ...valid, features: { interactive: value } });
    expect(ok.features.interactive).toBe(value);
  });

  it('rejects unknown keys at the outer object', () => {
    expect(() => tenantSettingsSchema.parse({ ...valid, extra: 'nope' } as unknown)).toThrow(
      /unrecognized/i,
    );
  });

  it('rejects unknown keys inside features', () => {
    expect(() =>
      tenantSettingsSchema.parse({
        ...valid,
        features: { interactive: 'disabled', other: true } as unknown,
      }),
    ).toThrow(/unrecognized/i);
  });

  it('rejects an invalid features.interactive enum value', () => {
    expect(() =>
      tenantSettingsSchema.parse({
        ...valid,
        features: { interactive: 'experimental' } as unknown,
      }),
    ).toThrow(/invalid enum value/i);
  });

  it('rejects missing tenantId', () => {
    const { tenantId: _t, ...rest } = valid;
    void _t;
    expect(() => tenantSettingsSchema.parse(rest as unknown)).toThrow();
  });

  it('rejects empty tenantId', () => {
    expect(() => tenantSettingsSchema.parse({ ...valid, tenantId: '' })).toThrow();
  });

  it('rejects empty updatedBy', () => {
    expect(() => tenantSettingsSchema.parse({ ...valid, updatedBy: '' })).toThrow();
  });

  it('rejects malformed updatedAt (not ISO 8601)', () => {
    expect(() => tenantSettingsSchema.parse({ ...valid, updatedAt: 'last tuesday' })).toThrow();
  });

  it('rejects missing features', () => {
    const { features: _f, ...rest } = valid;
    void _f;
    expect(() => tenantSettingsSchema.parse(rest as unknown)).toThrow();
  });

  // T-443 — aiBudget? optional field.
  describe('aiBudget (T-443)', () => {
    const validBudget = {
      monthlyAmount: 100,
      currency: 'USD',
      periodEnd: '2026-06-01T00:00:00.000Z',
    };

    it('round-trips a payload WITH aiBudget set', () => {
      const payload = { ...valid, aiBudget: validBudget };
      expect(tenantSettingsSchema.parse(payload)).toEqual(payload);
    });

    it('round-trips a payload WITHOUT aiBudget (back-compat — field is optional)', () => {
      // The original valid payload has no aiBudget; ensure unchanged.
      expect(tenantSettingsSchema.parse(valid)).toEqual(valid);
    });

    it('rejects a negative monthlyAmount', () => {
      expect(() =>
        tenantSettingsSchema.parse({
          ...valid,
          aiBudget: { ...validBudget, monthlyAmount: -1 },
        }),
      ).toThrow();
    });

    it('accepts a zero monthlyAmount (tenant exhausted by config)', () => {
      const parsed = tenantSettingsSchema.parse({
        ...valid,
        aiBudget: { ...validBudget, monthlyAmount: 0 },
      });
      expect(parsed.aiBudget?.monthlyAmount).toBe(0);
    });

    it('rejects non-ISO-4217 currency codes', () => {
      expect(() =>
        tenantSettingsSchema.parse({
          ...valid,
          aiBudget: { ...validBudget, currency: 'dollars' },
        }),
      ).toThrow(/ISO-4217/);
      expect(() =>
        tenantSettingsSchema.parse({
          ...valid,
          aiBudget: { ...validBudget, currency: 'usd' },
        }),
      ).toThrow(/ISO-4217/);
      expect(() =>
        tenantSettingsSchema.parse({
          ...valid,
          aiBudget: { ...validBudget, currency: '$' },
        }),
      ).toThrow(/ISO-4217/);
    });

    it('rejects malformed periodEnd', () => {
      expect(() =>
        tenantSettingsSchema.parse({
          ...valid,
          aiBudget: { ...validBudget, periodEnd: 'next month' },
        }),
      ).toThrow();
    });

    it('rejects unknown keys inside aiBudget (strict)', () => {
      expect(() =>
        tenantSettingsSchema.parse({
          ...valid,
          aiBudget: { ...validBudget, surprise: 'extra' } as unknown,
        }),
      ).toThrow(/unrecognized/i);
    });

    it('rejects missing aiBudget fields', () => {
      expect(() =>
        tenantSettingsSchema.parse({
          ...valid,
          aiBudget: { monthlyAmount: 100, currency: 'USD' } as unknown,
        }),
      ).toThrow();
    });
  });

  // T-444 — adapterCredentials structural extension.
  describe('adapterCredentials (T-444)', () => {
    it('round-trips a populated map', () => {
      const settings = {
        ...valid,
        adapterCredentials: {
          'tts-kokoro': { apiKey: 'sk-a' },
          'video-runway': { baseUrl: 'https://runway.example' },
        },
      };
      expect(tenantSettingsSchema.parse(settings).adapterCredentials).toEqual(
        settings.adapterCredentials,
      );
    });

    it('accepts an empty record', () => {
      const settings = { ...valid, adapterCredentials: {} };
      expect(tenantSettingsSchema.parse(settings).adapterCredentials).toEqual({});
    });

    it('is optional', () => {
      const parsed = tenantSettingsSchema.parse(valid);
      expect(parsed.adapterCredentials).toBeUndefined();
    });

    it('rejects empty {} credential value', () => {
      expect(() =>
        tenantSettingsSchema.parse({
          ...valid,
          adapterCredentials: { kokoro: {} },
        } as unknown),
      ).toThrow();
    });

    it('rejects non-kebab-case adapterId key', () => {
      expect(() =>
        tenantSettingsSchema.parse({
          ...valid,
          adapterCredentials: { Kokoro_TTS: { apiKey: 'sk' } },
        } as unknown),
      ).toThrow();
    });
  });

  // T-453 — features.audience sub-namespace.
  describe('features.audience (T-453)', () => {
    const validAudience = {
      enabled: true,
      motionNativeEnabled: false,
      maxIngestRateHz: 100,
      maxConcurrentVotersPerSession: 1000,
      retentionDays: 90,
    };

    it('round-trips a payload WITH features.audience set', () => {
      const payload = {
        ...valid,
        features: { interactive: 'disabled' as const, audience: validAudience },
      };
      expect(tenantSettingsSchema.parse(payload)).toEqual(payload);
    });

    it('round-trips an existing valid payload WITHOUT features.audience (non-breaking)', () => {
      // The base `valid` payload omits audience entirely — must still parse.
      expect(tenantSettingsSchema.parse(valid)).toEqual(valid);
    });

    it('rejects unknown keys inside features.audience (strict)', () => {
      expect(() =>
        tenantSettingsSchema.parse({
          ...valid,
          features: {
            interactive: 'disabled',
            audience: { ...validAudience, surprise: 'extra' } as unknown,
          },
        }),
      ).toThrow(/unrecognized/i);
    });

    it('rejects negative maxIngestRateHz', () => {
      expect(() =>
        tenantSettingsSchema.parse({
          ...valid,
          features: {
            interactive: 'disabled',
            audience: { ...validAudience, maxIngestRateHz: -1 },
          },
        }),
      ).toThrow();
    });

    it('rejects zero maxIngestRateHz', () => {
      expect(() =>
        tenantSettingsSchema.parse({
          ...valid,
          features: {
            interactive: 'disabled',
            audience: { ...validAudience, maxIngestRateHz: 0 },
          },
        }),
      ).toThrow();
    });

    it('rejects non-integer maxConcurrentVotersPerSession', () => {
      expect(() =>
        tenantSettingsSchema.parse({
          ...valid,
          features: {
            interactive: 'disabled',
            audience: { ...validAudience, maxConcurrentVotersPerSession: 1000.5 },
          },
        }),
      ).toThrow();
    });

    it('rejects retentionDays ≤ 0', () => {
      expect(() =>
        tenantSettingsSchema.parse({
          ...valid,
          features: {
            interactive: 'disabled',
            audience: { ...validAudience, retentionDays: 0 },
          },
        }),
      ).toThrow();
    });

    it('rejects missing required audience fields', () => {
      expect(() =>
        tenantSettingsSchema.parse({
          ...valid,
          features: {
            interactive: 'disabled',
            audience: { enabled: true } as unknown,
          },
        }),
      ).toThrow();
    });
  });
});
