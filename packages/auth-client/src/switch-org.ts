// packages/auth-client/src/switch-org.ts
// Calls the `setActiveOrg` Cloud Function then force-refreshes the
// ID token so subsequent reads of custom claims see the new active
// org (T-262 AC #17).

import { notifyClaimsChanged } from './claims-events.js';
import type { AuthClient, SetActiveOrgCallable } from './types.js';

/**
 * Switch the user's active org. Calls the server-side
 * `setActiveOrg(orgId)`, then force-refreshes the ID token. After
 * resolution, `useCurrentOrg(auth)` returns the new `{ orgId, role }`.
 *
 * Throws if the callable rejects (e.g. caller is not a member of the
 * target org).
 */
export async function switchOrg(
  auth: AuthClient,
  setActiveOrg: SetActiveOrgCallable,
  orgId: string,
): Promise<void> {
  await setActiveOrg({ orgId });
  const user = auth.currentUser;
  if (!user) {
    throw new Error('switchOrg called with no current user');
  }
  await user.getIdTokenResult(true);
  notifyClaimsChanged();
}
