// packages/auth-client/src/use-current-user.test.tsx
// T-262 AC #14 — useCurrentUser reflects auth-state changes.

import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { FakeAuthUser, createFakeAuth } from './test-helpers.js';
import { useCurrentUser } from './use-current-user.js';

describe('useCurrentUser (AC #14)', () => {
  it('returns null when not signed in', () => {
    const fake = createFakeAuth(null);
    const { result } = renderHook(() => useCurrentUser(fake.client));
    expect(result.current).toBeNull();
  });

  it('returns the initial user when signed in', () => {
    const user = new FakeAuthUser('alice');
    const fake = createFakeAuth(user);
    const { result } = renderHook(() => useCurrentUser(fake.client));
    expect(result.current?.uid).toBe('alice');
  });

  it('updates when auth state changes', () => {
    const fake = createFakeAuth(null);
    const { result } = renderHook(() => useCurrentUser(fake.client));
    expect(result.current).toBeNull();
    act(() => {
      fake.setUser(new FakeAuthUser('bob'));
    });
    expect(result.current?.uid).toBe('bob');
    act(() => {
      fake.setUser(null);
    });
    expect(result.current).toBeNull();
  });
});
