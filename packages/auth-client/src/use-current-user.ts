// packages/auth-client/src/use-current-user.ts
// React hook that subscribes to Firebase Auth's auth-state stream and
// returns the current `AuthUser` or `null` (T-262 AC #14).

import { useEffect, useState } from 'react';
import type { AuthClient, AuthUser } from './types.js';

/**
 * Returns the currently-authenticated `AuthUser`, or `null` when the
 * user is signed out / unknown. Re-renders on auth-state changes via
 * `auth.onAuthStateChanged`.
 */
export function useCurrentUser(auth: AuthClient): AuthUser | null {
  const [user, setUser] = useState<AuthUser | null>(() => auth.currentUser);
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((next) => {
      setUser(next);
    });
    return unsubscribe;
  }, [auth]);
  return user;
}
