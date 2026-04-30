// firebase/functions/src/auth/set-active-org.ts
// `setActiveOrg({ orgId })` — verifies the caller is a member of the
// target org and writes `{ org, role }` into the user's custom claims.
// The client then force-refreshes the ID token (handled in
// @stageflip/auth-client's `switchOrg`).
// T-262 AC #19, D-T262-1.
import { roleSchema } from '@stageflip/auth-schema';
import { CallableError } from './types.js';
export async function setActiveOrgHandler(deps, caller, input) {
    if (!caller.uid) {
        throw new CallableError('unauthenticated', 'sign-in required', 401);
    }
    if (!input.orgId || typeof input.orgId !== 'string') {
        throw new CallableError('invalid-argument', 'orgId is required');
    }
    const memberSnap = await deps.firestore.doc(`orgs/${input.orgId}/members/${caller.uid}`).get();
    if (!memberSnap.exists) {
        throw new CallableError('permission-denied', 'caller is not a member of this org', 403);
    }
    const data = memberSnap.data();
    const parsedRole = roleSchema.safeParse(data?.role);
    if (!parsedRole.success) {
        throw new CallableError('failed-precondition', 'membership has invalid role', 500);
    }
    const role = parsedRole.data;
    await deps.auth.setCustomUserClaims(caller.uid, { org: input.orgId, role });
    return { success: true };
}
//# sourceMappingURL=set-active-org.js.map