// packages/auth-schema/src/org.test.ts
// T-262 AC #2 — orgSchema accepts the org record per architecture §Firestore.

import { describe, expect, it } from 'vitest';
import { orgSchema } from './org.js';

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

  it('accepts a record with optional region', () => {
    expect(() => orgSchema.parse({ ...base, region: 'eu-west' })).not.toThrow();
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
});
