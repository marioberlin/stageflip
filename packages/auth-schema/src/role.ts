// packages/auth-schema/src/role.ts
// Role hierarchy primitive — implementation lands in commit 2.

import { z } from 'zod';

export const roleSchema = z.never();
export type Role = 'viewer' | 'editor' | 'admin' | 'owner';
export const ROLE_RANK: Readonly<Record<Role, number>> = {
  viewer: 0,
  editor: 0,
  admin: 0,
  owner: 0,
};
export function checkRoleAtLeast(_have: Role, _need: Role): boolean {
  throw new Error('checkRoleAtLeast not implemented');
}
