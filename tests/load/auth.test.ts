// tests/load/auth.test.ts
// AC #10 — pin authHeaders shape against T-262 conventions
// (Authorization: Bearer + X-Org-Id).

import { describe, expect, it } from 'vitest';

import { authHeaders } from './auth.js';

describe('authHeaders()', () => {
  it('emits Authorization: Bearer + X-Org-Id (jwt kind)', () => {
    const h = authHeaders({ token: 'tok-abc', orgId: 'org-1', kind: 'jwt' });
    expect(h.Authorization).toBe('Bearer tok-abc');
    expect(h['X-Org-Id']).toBe('org-1');
    expect(h['Content-Type']).toBe('application/json');
  });

  it('emits the same wire shape for api-key kind (T-262 bearer-scheme)', () => {
    const h = authHeaders({ token: 'sk_load_0001', orgId: 'org-1', kind: 'apiKey' });
    expect(h.Authorization).toBe('Bearer sk_load_0001');
    expect(h['X-Org-Id']).toBe('org-1');
  });

  it('defaults to jwt kind when not specified', () => {
    const h = authHeaders({ token: 'tok-x', orgId: 'org-2' });
    expect(h.Authorization).toBe('Bearer tok-x');
  });
});
