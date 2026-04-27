// packages/auth-schema/src/api-key.ts
// API key record — `orgs/{orgId}/apiKeys/{keyId}` in Firestore (T-262 AC #4).
// Plaintext keys are returned ONCE at issuance; storage holds bcrypt(key) +
// the prefix used for lookup (D-T262-2).

import { z } from 'zod';
import { roleSchema } from './role.js';

export const apiKeySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  /** bcrypt or scrypt hash of the plaintext key. Never returned to clients. */
  hashedKey: z.string().min(1),
  /** First 6 base64url chars of the random suffix, prefixed with `sf_<env>_`. */
  prefix: z.string().regex(/^sf_[a-z0-9]+_[A-Za-z0-9_-]+$/),
  role: roleSchema,
  createdAt: z.number().int().nonnegative(),
  createdBy: z.string().min(1),
  lastUsedAt: z.number().int().nonnegative().optional(),
  revokedAt: z.number().int().nonnegative().optional(),
});

export type ApiKey = z.infer<typeof apiKeySchema>;
