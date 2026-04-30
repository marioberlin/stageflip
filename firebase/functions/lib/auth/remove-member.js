// firebase/functions/src/auth/remove-member.ts
// `removeMember({ userId })` — admin-only. Cannot remove an `owner`
// (owner-transfer is a separate flow; out of scope for T-262).
// T-262 AC #24.
import { checkRoleAtLeast, roleSchema } from '@stageflip/auth-schema';
import { CallableError } from './types.js';
export async function removeMemberHandler(deps, caller, input) {
    if (!caller.uid || !caller.orgId || !caller.role) {
        throw new CallableError('unauthenticated', 'sign-in + active org required', 401);
    }
    if (!checkRoleAtLeast(caller.role, 'admin')) {
        throw new CallableError('permission-denied', 'admin role required', 403);
    }
    if (!input.userId || typeof input.userId !== 'string') {
        throw new CallableError('invalid-argument', 'userId is required');
    }
    if (input.userId === caller.uid) {
        throw new CallableError('failed-precondition', 'cannot remove yourself', 400);
    }
    const ref = deps.firestore.doc(`orgs/${caller.orgId}/members/${input.userId}`);
    const snap = await ref.get();
    if (!snap.exists) {
        throw new CallableError('not-found', 'member not found in this org', 404);
    }
    const data = snap.data() ?? {};
    const parsedRole = roleSchema.safeParse(data.role);
    if (parsedRole.success && parsedRole.data === 'owner') {
        throw new CallableError('permission-denied', 'cannot remove the org owner; transfer ownership first', 403);
    }
    await ref.delete();
    return { success: true };
}
//# sourceMappingURL=remove-member.js.map