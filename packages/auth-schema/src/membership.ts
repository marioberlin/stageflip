// packages/auth-schema/src/membership.ts
// Membership schema — implementation lands in commit 2.

import { z } from 'zod';

export const membershipSchema = z.never();
export type Membership = z.infer<typeof membershipSchema>;
