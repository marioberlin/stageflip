// packages/auth-schema/src/api-key.ts
// API key schema — implementation lands in commit 2.

import { z } from 'zod';

export const apiKeySchema = z.never();
export type ApiKey = z.infer<typeof apiKeySchema>;
