// firebase/functions/src/auth/remove-member.test.ts
// T-262 AC #24 — removeMember admin-only; cannot remove owner.

import { describe, expect, it } from 'vitest';
import { removeMemberHandler } from './remove-member.js';
import { MemoryFirestore, fakeDeps } from './test-helpers.js';

const admin = { uid: 'a', orgId: 'org-1', role: 'admin' as const };

describe('removeMember (AC #24)', () => {
  it('deletes the member doc', async () => {
    const fs = new MemoryFirestore();
    fs.seed('orgs/org-1/members/u-2', {
      role: 'editor',
      joinedAt: 1,
      invitedBy: 'a',
      lastModifiedBy: 'a',
    });
    const deps = fakeDeps({ firestore: fs });
    const result = await removeMemberHandler(deps, admin, { userId: 'u-2' });
    expect(result).toEqual({ success: true });
    expect(fs.docs.get('orgs/org-1/members/u-2')?.data).toBeUndefined();
  });

  it('refuses to remove the owner', async () => {
    const fs = new MemoryFirestore();
    fs.seed('orgs/org-1/members/owner', {
      role: 'owner',
      joinedAt: 1,
      invitedBy: 'a',
      lastModifiedBy: 'a',
    });
    const deps = fakeDeps({ firestore: fs });
    await expect(removeMemberHandler(deps, admin, { userId: 'owner' })).rejects.toMatchObject({
      code: 'permission-denied',
    });
  });

  it('refuses self-removal', async () => {
    const deps = fakeDeps();
    await expect(removeMemberHandler(deps, admin, { userId: 'a' })).rejects.toMatchObject({
      code: 'failed-precondition',
    });
  });

  it('rejects non-admin caller', async () => {
    const deps = fakeDeps();
    await expect(
      removeMemberHandler(deps, { ...admin, role: 'editor' }, { userId: 'x' }),
    ).rejects.toMatchObject({ code: 'permission-denied' });
  });
});
