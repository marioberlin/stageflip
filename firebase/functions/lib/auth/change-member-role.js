// firebase/functions/src/auth/change-member-role.ts
// `changeMemberRole({ userId, newRole })` — admin-only. Cannot change
// own role; cannot grant `owner` (owner-transfer is a separate flow).
// T-262 AC #25.
import { checkRoleAtLeast, roleSchema } from '@stageflip/auth-schema';
import { CallableError } from './types.js';
export async function changeMemberRoleHandler(deps, caller, input) {
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
        throw new CallableError('failed-precondition', 'cannot change your own role', 400);
    }
    const parsedRole = roleSchema.safeParse(input.newRole);
    if (!parsedRole.success) {
        throw new CallableError('invalid-argument', 'newRole must be a valid Role');
    }
    if (parsedRole.data === 'owner') {
        throw new CallableError('permission-denied', 'cannot grant owner role; transfer-ownership is a separate flow', 403);
    }
    if (!checkRoleAtLeast(caller.role, parsedRole.data)) {
        throw new CallableError('permission-denied', 'cannot grant a role higher than your own', 403);
    }
    const ref = deps.firestore.doc(`orgs/${caller.orgId}/members/${input.userId}`);
    const snap = await ref.get();
    if (!snap.exists) {
        throw new CallableError('not-found', 'member not found in this org', 404);
    }
    await ref.update({ role: parsedRole.data, lastModifiedBy: caller.uid });
    return { success: true };
}
//# sourceMappingURL=change-member-role.js.map