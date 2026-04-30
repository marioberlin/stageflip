// firebase/functions/src/auth/invite-member.ts
// `inviteMember({ email, role })` — admin-only. Creates an
// `orgs/{orgId}/invites/{token}` doc with TTL 7 days; returns the
// invite token. Email delivery is operational (out of scope).
// T-262 AC #22.
import { checkRoleAtLeast, roleSchema } from '@stageflip/auth-schema';
import { CallableError } from './types.js';
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
export async function inviteMemberHandler(deps, caller, input) {
    if (!caller.uid || !caller.orgId || !caller.role) {
        throw new CallableError('unauthenticated', 'sign-in + active org required', 401);
    }
    if (!checkRoleAtLeast(caller.role, 'admin')) {
        throw new CallableError('permission-denied', 'admin role required', 403);
    }
    if (!input.email || typeof input.email !== 'string' || !/^.+@.+\..+$/.test(input.email)) {
        throw new CallableError('invalid-argument', 'a valid email is required');
    }
    const parsedRole = roleSchema.safeParse(input.role);
    if (!parsedRole.success) {
        throw new CallableError('invalid-argument', 'role must be a valid Role');
    }
    if (parsedRole.data === 'owner') {
        throw new CallableError('permission-denied', 'cannot invite as owner; transfer-ownership is a separate flow', 403);
    }
    if (!checkRoleAtLeast(caller.role, parsedRole.data)) {
        throw new CallableError('permission-denied', 'cannot invite a role higher than your own', 403);
    }
    const tokenBytes = deps.randomBytes(24);
    const token = Buffer.from(tokenBytes).toString('base64url');
    const expiresAt = deps.clock() + SEVEN_DAYS_MS;
    await deps.firestore.doc(`orgs/${caller.orgId}/invites/${token}`).set({
        email: input.email,
        role: parsedRole.data,
        invitedBy: caller.uid,
        createdAt: deps.clock(),
        expiresAt,
    });
    return { token, expiresAt };
}
//# sourceMappingURL=invite-member.js.map