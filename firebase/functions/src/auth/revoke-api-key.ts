// firebase/functions/src/auth/revoke-api-key.ts
// `revokeApiKey({ keyId })` — admin-only. Marks the api-key revoked.
// Cache invalidation: the in-process cache in `@stageflip/auth-middleware`
// is local-process; remote instances see eventual consistency bounded
// by the 60s TTL. Documented in concepts/auth/SKILL.md.
// T-262 AC #21.

import { checkRoleAtLeast } from '@stageflip/auth-schema';
import { type AuthDeps, CallableError, type CallerContext } from './types.js';

export interface RevokeApiKeyInput {
  readonly keyId: string;
}

export interface RevokeApiKeyOutput {
  readonly success: true;
}

export async function revokeApiKeyHandler(
  deps: AuthDeps,
  caller: CallerContext,
  input: RevokeApiKeyInput,
): Promise<RevokeApiKeyOutput> {
  if (!caller.uid || !caller.orgId || !caller.role) {
    throw new CallableError('unauthenticated', 'sign-in + active org required', 401);
  }
  if (!checkRoleAtLeast(caller.role, 'admin')) {
    throw new CallableError('permission-denied', 'admin role required', 403);
  }
  if (!input.keyId || typeof input.keyId !== 'string') {
    throw new CallableError('invalid-argument', 'keyId is required');
  }

  const ref = deps.firestore.doc(`orgs/${caller.orgId}/apiKeys/${input.keyId}`);
  const snap = await ref.get();
  if (!snap.exists) {
    throw new CallableError('not-found', 'api-key not found', 404);
  }
  await ref.update({ revokedAt: deps.clock() });
  return { success: true };
}
