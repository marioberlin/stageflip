// packages/auth-schema/src/org.ts
// Org schema — implementation lands in commit 2.

import { z } from 'zod';

export const orgSchema = z.never();
export type Org = z.infer<typeof orgSchema>;
