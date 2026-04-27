// packages/auth-schema/src/org.ts
// Organisation record — `orgs/{orgId}` in Firestore (T-262 AC #2).
// Plan is enumerated; region is optional (filled in by T-271 EU residency).

import { z } from 'zod';

export const planSchema = z.enum(['free', 'team', 'business', 'enterprise']);

export const orgSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  /** Lowercase slug — `[a-z0-9-]+`. Used for tenant-friendly URLs. */
  slug: z.string().regex(/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/),
  createdAt: z.number().int().nonnegative(),
  ownerId: z.string().min(1),
  plan: planSchema,
  region: z.string().optional(),
});

export type Org = z.infer<typeof orgSchema>;
export type OrgPlan = z.infer<typeof planSchema>;
