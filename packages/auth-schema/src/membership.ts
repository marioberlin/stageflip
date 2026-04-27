// packages/auth-schema/src/membership.ts
// Org membership record — `orgs/{orgId}/members/{userId}` in Firestore
// (T-262 AC #3). The userId is the doc id; the schema covers the doc body.

import { z } from 'zod';
import { roleSchema } from './role.js';

export const membershipSchema = z.object({
  role: roleSchema,
  joinedAt: z.number().int().nonnegative(),
  invitedBy: z.string().min(1),
  lastModifiedBy: z.string().min(1),
});

export type Membership = z.infer<typeof membershipSchema>;
