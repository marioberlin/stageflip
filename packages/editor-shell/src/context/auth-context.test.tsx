// packages/editor-shell/src/context/auth-context.test.tsx
// Shell-only auth surface. Real implementations land with the
// Firebase backend in Phase 8/10; T-121b ships the interface so
// component ports can depend on a stable `useAuth()` shape.

import { cleanup, renderHook } from '@testing-library/react';
import type React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { AuthProvider, useAuth } from './auth-context';

afterEach(() => {
  cleanup();
});

function wrap({ children }: { children: React.ReactNode }): React.ReactElement {
  return <AuthProvider>{children}</AuthProvider>;
}

describe('AuthProvider shell', () => {
  it('starts unauthenticated (user === null)', () => {
    const { result } = renderHook(() => useAuth(), { wrapper: wrap });
    expect(result.current.user).toBeNull();
  });

  it('signIn rejects with "not implemented" until the backend lands', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper: wrap });
    await expect(result.current.signIn()).rejects.toThrow(/not implemented/i);
  });

  it('signOut rejects with "not implemented" until the backend lands', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper: wrap });
    await expect(result.current.signOut()).rejects.toThrow(/not implemented/i);
  });
});

describe('useAuth outside a provider', () => {
  it('throws a descriptive error', () => {
    expect(() => renderHook(() => useAuth())).toThrow(/AuthProvider/);
  });
});
