// packages/auth-client/src/use-role.ts
// React hook flavour of `checkRoleAtLeast` (T-262 AC #16).

import { type Role, checkRoleAtLeast } from '@stageflip/auth-schema';
import type { AuthClient } from './types.js';
import { useCurrentOrg } from './use-current-org.js';

/**
 * Returns `true` iff the current user's active-org role is at least
 * the required role. `false` when no org is active.
 */
export function useRole(auth: AuthClient, need: Role): boolean {
  const org = useCurrentOrg(auth);
  if (!org) return false;
  return checkRoleAtLeast(org.role, need);
}
