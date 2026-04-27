// packages/auth-schema/src/api-key.test.ts
// T-262 AC #4 — apiKeySchema accepts the api-key record.

import { describe, expect, it } from 'vitest';
import { apiKeySchema } from './api-key.js';

describe('apiKeySchema (AC #4)', () => {
  const base = {
    id: 'key-1',
    name: 'CI bot',
    hashedKey: '$2b$12$abcdefghijklmnopqrstuv',
    prefix: 'sf_dev_abc123',
    role: 'editor',
    createdAt: 1730000000000,
    createdBy: 'user-admin',
  } as const;

  it('accepts the minimal api-key record', () => {
    expect(() => apiKeySchema.parse(base)).not.toThrow();
  });

  it('accepts optional lastUsedAt and revokedAt', () => {
    expect(() =>
      apiKeySchema.parse({ ...base, lastUsedAt: 1730000100000, revokedAt: 1730000200000 }),
    ).not.toThrow();
  });

  it('rejects when prefix does not start with sf_', () => {
    expect(() => apiKeySchema.parse({ ...base, prefix: 'wrong_prefix' })).toThrow();
  });

  it('rejects unknown role', () => {
    expect(() => apiKeySchema.parse({ ...base, role: 'superuser' })).toThrow();
  });

  it('rejects empty hashedKey', () => {
    expect(() => apiKeySchema.parse({ ...base, hashedKey: '' })).toThrow();
  });
});
