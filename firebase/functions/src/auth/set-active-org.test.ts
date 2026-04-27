// firebase/functions/src/auth/set-active-org.test.ts
// T-262 AC #19 — setActiveOrg verifies membership + writes claims.

import { describe, expect, it } from 'vitest';
import { setActiveOrgHandler } from './set-active-org.js';
import { MemoryAuth, MemoryFirestore, fakeDeps } from './test-helpers.js';
import { CallableError } from './types.js';

function caller(uid = 'user-1') {
  return { uid, orgId: undefined, role: undefined };
}

describe('setActiveOrg (AC #19)', () => {
  it('writes { org, role } claims when caller is a member', async () => {
    const fs = new MemoryFirestore();
    fs.seed('orgs/org-1/members/user-1', {
      role: 'editor',
      joinedAt: 1,
      invitedBy: 'admin',
      lastModifiedBy: 'admin',
    });
    const auth = new MemoryAuth();
    const deps = fakeDeps({ firestore: fs, auth });

    const result = await setActiveOrgHandler(deps, caller(), { orgId: 'org-1' });
    expect(result).toEqual({ success: true });
    expect(auth.claims.get('user-1')).toEqual({ org: 'org-1', role: 'editor' });
  });

  it('rejects non-members', async () => {
    const deps = fakeDeps();
    await expect(setActiveOrgHandler(deps, caller(), { orgId: 'org-x' })).rejects.toMatchObject({
      code: 'permission-denied',
    });
  });

  it('rejects when caller has no uid', async () => {
    const deps = fakeDeps();
    await expect(
      setActiveOrgHandler(deps, { uid: '', orgId: undefined, role: undefined }, { orgId: 'o' }),
    ).rejects.toBeInstanceOf(CallableError);
  });

  it('rejects when orgId is missing', async () => {
    const deps = fakeDeps();
    await expect(setActiveOrgHandler(deps, caller(), { orgId: '' })).rejects.toMatchObject({
      code: 'invalid-argument',
    });
  });

  it('rejects when membership doc has invalid role', async () => {
    const fs = new MemoryFirestore();
    fs.seed('orgs/org-1/members/user-1', { role: 'godmode' });
    const deps = fakeDeps({ firestore: fs });
    await expect(setActiveOrgHandler(deps, caller(), { orgId: 'org-1' })).rejects.toMatchObject({
      code: 'failed-precondition',
    });
  });
});
