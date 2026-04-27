// packages/auth-client/src/use-current-org.ts
// React hook that decodes the current ID token and exposes
// `{ orgId, role }` from custom claims (T-262 AC #15, #18).
//
// Returns `null` when:
// - the user is signed out
// - the user has no org/role claims yet (no memberships, or has not
//   called switchOrg). Apps see this and redirect to org-create flow.

import { roleSchema } from '@stageflip/auth-schema';
import { useEffect, useState } from 'react';
import { subscribeClaimsChanged } from './claims-events.js';
import type { ActiveOrg, AuthClient, AuthUser } from './types.js';

async function readActiveOrg(user: AuthUser): Promise<ActiveOrg | null> {
  const result = await user.getIdTokenResult(false);
  const { org, role } = result.claims;
  if (typeof org !== 'string' || typeof role !== 'string') return null;
  const parsedRole = roleSchema.safeParse(role);
  if (!parsedRole.success) return null;
  return { orgId: org, role: parsedRole.data };
}

/**
 * Returns the active-org `{ orgId, role }` from the current user's ID
 * token claims, or `null` when no active org is set.
 */
export function useCurrentOrg(auth: AuthClient): ActiveOrg | null {
  const [org, setOrg] = useState<ActiveOrg | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function refresh(user: AuthUser | null): Promise<void> {
      if (!user) {
        if (!cancelled) setOrg(null);
        return;
      }
      const next = await readActiveOrg(user);
      if (!cancelled) setOrg(next);
    }
    void refresh(auth.currentUser);
    const unsubscribeAuth = auth.onAuthStateChanged((u) => {
      void refresh(u);
    });
    const unsubscribeClaims = subscribeClaimsChanged(() => {
      void refresh(auth.currentUser);
    });
    return () => {
      cancelled = true;
      unsubscribeAuth();
      unsubscribeClaims();
    };
  }, [auth]);

  return org;
}
