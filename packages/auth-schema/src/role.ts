// packages/auth-schema/src/role.ts
// Role hierarchy + checkRoleAtLeast — the security primitive every
// middleware decision flows through (T-262 AC #5–#6).
//
// `viewer` < `editor` < `admin` < `owner`. The order in roleSchema.options
// IS the rank order (viewer at index 0). Do not reorder; downstream
// `ROLE_RANK` and Firestore rules' `ranks` map mirror this layout.

import { z } from 'zod';

/** Discriminator for the role field on memberships and api-keys. */
export const roleSchema = z.enum(['viewer', 'editor', 'admin', 'owner']);

export type Role = z.infer<typeof roleSchema>;

/** Numeric rank for each role; mirrors `roleSchema.options.indexOf(role)`. */
export const ROLE_RANK: Readonly<Record<Role, number>> = {
  viewer: 0,
  editor: 1,
  admin: 2,
  owner: 3,
};

/**
 * Returns `true` iff the principal's role is at least the required role.
 *
 * Equivalent to `roleSchema.options.indexOf(have) >= roleSchema.options.indexOf(need)`.
 *
 * Example: `checkRoleAtLeast('admin', 'editor')` → `true`,
 * `checkRoleAtLeast('viewer', 'editor')` → `false`.
 */
export function checkRoleAtLeast(have: Role, need: Role): boolean {
  return ROLE_RANK[have] >= ROLE_RANK[need];
}
