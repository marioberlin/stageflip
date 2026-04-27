// packages/auth-schema/src/org.test.ts
// T-262 AC #2 — orgSchema accepts the org record per architecture §Firestore.
// T-271 AC #6, #7, #8, #13 — region enum + immutability guard + back-compat default.

import { describe, expect, it } from 'vitest';
import { orgSchema, regionSchema, validateRegionTransition } from './org.js';

describe('orgSchema (AC #2)', () => {
  const base = {
    id: 'org-acme',
    name: 'Acme Inc',
    slug: 'acme',
    createdAt: 1730000000000,
    ownerId: 'user-abc',
    plan: 'free',
  } as const;

  it('accepts the minimal org record', () => {
    expect(() => orgSchema.parse(base)).not.toThrow();
  });

  it('accepts a record with optional region (T-271 AC #6)', () => {
    expect(() => orgSchema.parse({ ...base, region: 'eu' })).not.toThrow();
    expect(() => orgSchema.parse({ ...base, region: 'us' })).not.toThrow();
  });

  it('rejects unknown plan value', () => {
    expect(() => orgSchema.parse({ ...base, plan: 'unicorn' })).toThrow();
  });

  it('rejects empty slug', () => {
    expect(() => orgSchema.parse({ ...base, slug: '' })).toThrow();
  });

  it('rejects slug with uppercase or whitespace', () => {
    expect(() => orgSchema.parse({ ...base, slug: 'Acme Inc' })).toThrow();
  });

  it('rejects unknown region value (T-271 AC #7)', () => {
    expect(() => orgSchema.parse({ ...base, region: 'invalid' })).toThrow();
    expect(() => orgSchema.parse({ ...base, region: 'eu-west' })).toThrow();
    expect(() => orgSchema.parse({ ...base, region: 'EU' })).toThrow();
  });

  it('defaults region to "us" when missing on persisted record (T-271 AC #13)', () => {
    // Existing US orgs persisted before T-271 ship without a region field.
    // Zod's `.default('us')` populates it on parse so consumers always see a
    // concrete region.
    const parsed = orgSchema.parse(base);
    expect(parsed.region).toBe('us');
  });
});

describe('regionSchema (T-271 AC #6, #7)', () => {
  it('accepts "us"', () => {
    expect(regionSchema.parse('us')).toBe('us');
  });

  it('accepts "eu"', () => {
    expect(regionSchema.parse('eu')).toBe('eu');
  });

  it('rejects anything else', () => {
    expect(() => regionSchema.parse('uk')).toThrow();
    expect(() => regionSchema.parse('')).toThrow();
    expect(() => regionSchema.parse(undefined)).toThrow();
    expect(() => regionSchema.parse(null)).toThrow();
  });
});

describe('validateRegionTransition (T-271 AC #8 — security primitive)', () => {
  const base = {
    id: 'org-acme',
    name: 'Acme Inc',
    slug: 'acme',
    createdAt: 1730000000000,
    ownerId: 'user-abc',
    plan: 'free' as const,
    region: 'us' as const,
  };

  it('returns ok when region is unchanged (us → us)', () => {
    const result = validateRegionTransition(base, base);
    expect(result.ok).toBe(true);
  });

  it('returns ok when region is unchanged (eu → eu)', () => {
    const eu = { ...base, region: 'eu' as const };
    const result = validateRegionTransition(eu, eu);
    expect(result.ok).toBe(true);
  });

  it('returns err when region changes us → eu', () => {
    const next = { ...base, region: 'eu' as const };
    const result = validateRegionTransition(base, next);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/region/i);
      expect(result.error).toMatch(/immutable/i);
      expect(result.error).toContain('us');
      expect(result.error).toContain('eu');
    }
  });

  it('returns err when region changes eu → us', () => {
    const prev = { ...base, region: 'eu' as const };
    const next = { ...base, region: 'us' as const };
    const result = validateRegionTransition(prev, next);
    expect(result.ok).toBe(false);
  });

  it('handles prev with implicit default region against explicit next', () => {
    // A persisted record may parse to `region: 'us'` via the default; mutation
    // to 'eu' must still be blocked.
    const prevParsed = orgSchema.parse({
      id: base.id,
      name: base.name,
      slug: base.slug,
      createdAt: base.createdAt,
      ownerId: base.ownerId,
      plan: base.plan,
    });
    const next = { ...base, region: 'eu' as const };
    const result = validateRegionTransition(prevParsed, next);
    expect(result.ok).toBe(false);
  });

  it('ignores changes to other fields', () => {
    const next = { ...base, name: 'Acme Renamed', plan: 'team' as const };
    const result = validateRegionTransition(base, next);
    expect(result.ok).toBe(true);
  });
});
