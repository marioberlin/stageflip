// firebase/functions/src/auth/accept-invite.ts
// `acceptInvite({ token })` — any authenticated user. Verifies the
// invite, creates `orgs/{orgId}/members/{userId}` with the invite's
// role, and deletes the invite doc.
// T-262 AC #23.
import { roleSchema } from '@stageflip/auth-schema';
import { CallableError } from './types.js';
export async function acceptInviteHandler(deps, caller, input) {
    if (!caller.uid) {
        throw new CallableError('unauthenticated', 'sign-in required', 401);
    }
    if (!input.token || !input.orgId) {
        throw new CallableError('invalid-argument', 'token and orgId are required');
    }
    const inviteRef = deps.firestore.doc(`orgs/${input.orgId}/invites/${input.token}`);
    const snap = await inviteRef.get();
    if (!snap.exists) {
        throw new CallableError('not-found', 'invite not found or already accepted', 404);
    }
    const data = snap.data() ?? {};
    const expiresAt = typeof data.expiresAt === 'number' ? data.expiresAt : 0;
    if (expiresAt <= deps.clock()) {
        throw new CallableError('failed-precondition', 'invite expired', 410);
    }
    const parsedRole = roleSchema.safeParse(data.role);
    if (!parsedRole.success) {
        throw new CallableError('failed-precondition', 'invite has invalid role', 500);
    }
    const now = deps.clock();
    await deps.firestore.doc(`orgs/${input.orgId}/members/${caller.uid}`).set({
        role: parsedRole.data,
        joinedAt: now,
        invitedBy: typeof data.invitedBy === 'string' ? data.invitedBy : caller.uid,
        lastModifiedBy: typeof data.invitedBy === 'string' ? data.invitedBy : caller.uid,
    });
    await inviteRef.delete();
    return { orgId: input.orgId, role: parsedRole.data };
}
//# sourceMappingURL=accept-invite.js.map