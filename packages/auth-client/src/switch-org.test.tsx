// packages/auth-client/src/switch-org.test.tsx
// T-262 AC #17 — switchOrg invokes setActiveOrg then force-refreshes
// the ID token; afterwards useCurrentOrg reflects the new claims.

import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { switchOrg } from './switch-org.js';
import { FakeAuthUser, createFakeAuth } from './test-helpers.js';
import type { SetActiveOrgCallable } from './types.js';
import { useCurrentOrg } from './use-current-org.js';

describe('switchOrg (AC #17)', () => {
  it('calls setActiveOrg then forces a token refresh', async () => {
    const user = new FakeAuthUser('alice', { org: 'org-1', role: 'editor' });
    const fake = createFakeAuth(user);
    const refreshSpy = vi.spyOn(user, 'getIdTokenResult');
    const setActive: SetActiveOrgCallable = vi.fn(async () => ({
      data: { success: true } as const,
    }));

    await switchOrg(fake.client, setActive, 'org-2');

    expect(setActive).toHaveBeenCalledWith({ orgId: 'org-2' });
    expect(refreshSpy).toHaveBeenCalledWith(true);
  });

  it('useCurrentOrg reflects new claims after switchOrg resolves', async () => {
    const user = new FakeAuthUser('alice', { org: 'org-1', role: 'editor' });
    const fake = createFakeAuth(user);

    const { result, rerender } = renderHook(() => useCurrentOrg(fake.client));
    await waitFor(() => expect(result.current).toEqual({ orgId: 'org-1', role: 'editor' }));

    const setActive: SetActiveOrgCallable = async ({ orgId }) => {
      // Simulate the callable having run: server has set claims; the
      // next force-refresh will see them.
      user.setClaims({ org: orgId, role: 'admin' });
      return { data: { success: true } };
    };

    await switchOrg(fake.client, setActive, 'org-2');
    rerender();
    await waitFor(() => expect(result.current).toEqual({ orgId: 'org-2', role: 'admin' }));
  });

  it('throws when called with no current user', async () => {
    const fake = createFakeAuth(null);
    const setActive: SetActiveOrgCallable = async () => ({ data: { success: true } });
    await expect(switchOrg(fake.client, setActive, 'org-x')).rejects.toThrow(/no current user/);
  });
});
