// packages/auth-schema/src/user.ts
// User profile record — `users/{userId}` in Firestore (T-262 AC #1).

import { z } from 'zod';

export const userSchema = z.object({
  id: z.string().min(1),
  email: z.string().email(),
  displayName: z.string(),
  photoURL: z.string().url().optional(),
  createdAt: z.number().int().nonnegative(),
});

export type User = z.infer<typeof userSchema>;
