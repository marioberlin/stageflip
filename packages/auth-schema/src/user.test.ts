// packages/auth-schema/src/user.test.ts
// T-262 AC #1 — userSchema accepts the user record per architecture §Firestore.

import { describe, expect, it } from 'vitest';
import { userSchema } from './user.js';

describe('userSchema (AC #1)', () => {
  const base = {
    id: 'user-abc',
    email: 'alice@example.com',
    displayName: 'Alice',
    createdAt: 1730000000000,
  };

  it('accepts the minimal user record', () => {
    expect(() => userSchema.parse(base)).not.toThrow();
  });

  it('accepts a record with photoURL', () => {
    expect(() =>
      userSchema.parse({ ...base, photoURL: 'https://example.com/a.png' }),
    ).not.toThrow();
  });

  it('rejects when email is not a valid email', () => {
    expect(() => userSchema.parse({ ...base, email: 'not-an-email' })).toThrow();
  });

  it('rejects when id is empty', () => {
    expect(() => userSchema.parse({ ...base, id: '' })).toThrow();
  });

  it('rejects when createdAt is not a number', () => {
    expect(() => userSchema.parse({ ...base, createdAt: 'yesterday' })).toThrow();
  });
});
