// firebase/functions/src/auth/create-api-key.ts
// `createApiKey({ name, role })` — admin-only. Generates a fresh
// random key, hashes it, and stores `{ name, hashedKey, prefix, role,
// createdAt, createdBy }`. Returns the plaintext key ONCE in the
// response. The plaintext must NEVER be logged or persisted in audit
// surfaces.
// T-262 AC #20.
import { checkRoleAtLeast, roleSchema } from '@stageflip/auth-schema';
import { CallableError } from './types.js';
const PREFIX_INDEX_LEN = 6;
function base64url(bytes) {
    const buf = Buffer.from(bytes);
    return buf.toString('base64url');
}
export async function createApiKeyHandler(deps, caller, input) {
    if (!caller.uid || !caller.orgId || !caller.role) {
        throw new CallableError('unauthenticated', 'sign-in + active org required', 401);
    }
    if (!checkRoleAtLeast(caller.role, 'admin')) {
        throw new CallableError('permission-denied', 'admin role required', 403);
    }
    if (!input.name || typeof input.name !== 'string') {
        throw new CallableError('invalid-argument', 'name is required');
    }
    const parsedRole = roleSchema.safeParse(input.role);
    if (!parsedRole.success) {
        throw new CallableError('invalid-argument', 'role must be one of viewer/editor/admin/owner');
    }
    // Issuance must not grant a role higher than the issuer's.
    if (!checkRoleAtLeast(caller.role, parsedRole.data)) {
        throw new CallableError('permission-denied', 'cannot issue api-key with a role higher than your own', 403);
    }
    const random = base64url(deps.randomBytes(32));
    const plaintext = `sf_${deps.env}_${random}`;
    const prefix = `sf_${deps.env}_${random.slice(0, PREFIX_INDEX_LEN)}`;
    const hashedKey = await deps.hashApiKey(plaintext);
    const ref = await deps.firestore.collection(`orgs/${caller.orgId}/apiKeys`).add({
        name: input.name,
        hashedKey,
        prefix,
        role: parsedRole.data,
        createdAt: deps.clock(),
        createdBy: caller.uid,
    });
    return { id: ref.id, plaintext, prefix };
}
//# sourceMappingURL=create-api-key.js.map