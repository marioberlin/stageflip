// packages/auth-schema/src/user.ts
// User profile schema — implementation lands in commit 2.

import { z } from 'zod';

export const userSchema = z.never();
export type User = z.infer<typeof userSchema>;
