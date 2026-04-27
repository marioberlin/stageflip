// packages/auth-schema/src/membership.test.ts
// T-262 AC #3 — membershipSchema accepts the membership record.

import { describe, expect, it } from 'vitest';
import { membershipSchema } from './membership.js';

describe('membershipSchema (AC #3)', () => {
  const base = {
    role: 'editor',
    joinedAt: 1730000000000,
    invitedBy: 'user-admin',
    lastModifiedBy: 'user-admin',
  } as const;

  it('accepts the minimal membership record', () => {
    expect(() => membershipSchema.parse(base)).not.toThrow();
  });

  it('rejects an unknown role', () => {
    expect(() => membershipSchema.parse({ ...base, role: 'superuser' })).toThrow();
  });

  it('rejects when joinedAt is missing', () => {
    const { joinedAt: _omitted, ...without } = base;
    expect(() => membershipSchema.parse(without)).toThrow();
  });
});
