// packages/auth-client/src/use-role.test.tsx
// T-262 AC #16 — useRole(need) returns checkRoleAtLeast against the
// current user's active-org role.

import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { FakeAuthUser, createFakeAuth } from './test-helpers.js';
import { useRole } from './use-role.js';

describe('useRole (AC #16)', () => {
  it('returns false when no org is active', async () => {
    const fake = createFakeAuth(null);
    const { result } = renderHook(() => useRole(fake.client, 'viewer'));
    await waitFor(() => expect(result.current).toBe(false));
  });

  it('returns true when role >= need', async () => {
    const fake = createFakeAuth(new FakeAuthUser('a', { org: 'o', role: 'admin' }));
    const { result } = renderHook(() => useRole(fake.client, 'editor'));
    await waitFor(() => expect(result.current).toBe(true));
  });

  it('returns false when role < need', async () => {
    const fake = createFakeAuth(new FakeAuthUser('a', { org: 'o', role: 'viewer' }));
    const { result } = renderHook(() => useRole(fake.client, 'admin'));
    await waitFor(() => expect(result.current).toBe(false));
  });
});
