// packages/editor-shell/src/context/auth-context.tsx
// Shell auth context — interface only.

/**
 * The real backend (Firebase, or whatever the platform decision lands on)
 * arrives with a later task. T-121b ships just enough structure for
 * component ports to depend on a stable `useAuth()` shape: `user`,
 * `signIn()`, `signOut()`. Both actions reject with a clearly-labeled
 * "not implemented" error so any accidental production call fails
 * loudly instead of silently succeeding.
 *
 * Consumers that need to branch on "is auth wired" can test
 * `user === null` — the shell is always unauthenticated.
 */

import type React from 'react';
import { createContext, useContext, useMemo } from 'react';

export interface AuthUser {
  id: string;
  email?: string;
  displayName?: string;
}

export interface AuthContextValue {
  user: AuthUser | null;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function notImplemented(): Promise<never> {
  return Promise.reject(new Error('auth: not implemented — wired by a later task'));
}

const SHELL_VALUE: AuthContextValue = {
  user: null,
  signIn: notImplemented,
  signOut: notImplemented,
};

export function AuthProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  // The value is shared across every provider instance — it's a singleton
  // shell. If a future variant needs instance state it can override via
  // the value prop; for now useMemo keeps the reference stable.
  const value = useMemo(() => SHELL_VALUE, []);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside <AuthProvider>');
  }
  return ctx;
}
