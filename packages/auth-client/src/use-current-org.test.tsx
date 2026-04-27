// packages/auth-client/src/use-current-org.test.tsx
// T-262 AC #15, #18 — useCurrentOrg parses JWT claims; returns null
// when no claims set (no-org-yet flow).

import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { FakeAuthUser, createFakeAuth } from './test-helpers.js';
import { useCurrentOrg } from './use-current-org.js';

describe('useCurrentOrg (AC #15, #18)', () => {
  it('returns null when no user is signed in', async () => {
    const fake = createFakeAuth(null);
    const { result } = renderHook(() => useCurrentOrg(fake.client));
    await waitFor(() => expect(result.current).toBeNull());
  });

  it('returns null when user has no org/role claims (no-org-yet)', async () => {
    const fake = createFakeAuth(new FakeAuthUser('alice', {}));
    const { result } = renderHook(() => useCurrentOrg(fake.client));
    await waitFor(() => expect(result.current).toBeNull());
  });

  it('returns { orgId, role } when claims are present', async () => {
    const fake = createFakeAuth(new FakeAuthUser('alice', { org: 'org-1', role: 'admin' }));
    const { result } = renderHook(() => useCurrentOrg(fake.client));
    await waitFor(() => expect(result.current).toEqual({ orgId: 'org-1', role: 'admin' }));
  });

  it('returns null when role claim is unknown', async () => {
    const fake = createFakeAuth(new FakeAuthUser('alice', { org: 'org-1', role: 'godmode' }));
    const { result } = renderHook(() => useCurrentOrg(fake.client));
    await waitFor(() => expect(result.current).toBeNull());
  });

  it('updates when the user signs in mid-render', async () => {
    const fake = createFakeAuth(null);
    const { result } = renderHook(() => useCurrentOrg(fake.client));
    await waitFor(() => expect(result.current).toBeNull());
    act(() => {
      fake.setUser(new FakeAuthUser('bob', { org: 'org-2', role: 'editor' }));
    });
    await waitFor(() => expect(result.current).toEqual({ orgId: 'org-2', role: 'editor' }));
  });
});
