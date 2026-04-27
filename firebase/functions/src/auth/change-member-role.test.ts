// firebase/functions/src/auth/change-member-role.test.ts
// T-262 AC #25 — changeMemberRole admin-only; cannot self-change;
// cannot grant owner.

import { describe, expect, it } from 'vitest';
import { changeMemberRoleHandler } from './change-member-role.js';
import { MemoryFirestore, fakeDeps } from './test-helpers.js';

const admin = { uid: 'a', orgId: 'org-1', role: 'admin' as const };

describe('changeMemberRole (AC #25)', () => {
  it('updates role + lastModifiedBy', async () => {
    const fs = new MemoryFirestore();
    fs.seed('orgs/org-1/members/u-2', {
      role: 'viewer',
      joinedAt: 1,
      invitedBy: 'a',
      lastModifiedBy: 'a',
    });
    const deps = fakeDeps({ firestore: fs });
    const result = await changeMemberRoleHandler(deps, admin, { userId: 'u-2', newRole: 'editor' });
    expect(result).toEqual({ success: true });
    const data = fs.docs.get('orgs/org-1/members/u-2')?.data;
    expect(data?.role).toBe('editor');
    expect(data?.lastModifiedBy).toBe('a');
  });

  it('refuses self-change', async () => {
    const deps = fakeDeps();
    await expect(
      changeMemberRoleHandler(deps, admin, { userId: 'a', newRole: 'editor' }),
    ).rejects.toMatchObject({ code: 'failed-precondition' });
  });

  it('refuses to grant owner', async () => {
    const fs = new MemoryFirestore();
    fs.seed('orgs/org-1/members/u-2', { role: 'editor' });
    const deps = fakeDeps({ firestore: fs });
    await expect(
      changeMemberRoleHandler(deps, admin, { userId: 'u-2', newRole: 'owner' }),
    ).rejects.toMatchObject({ code: 'permission-denied' });
  });

  it('refuses elevation above caller role', async () => {
    const fs = new MemoryFirestore();
    fs.seed('orgs/org-1/members/u-2', { role: 'viewer' });
    const deps = fakeDeps({ firestore: fs });
    await expect(
      changeMemberRoleHandler(
        deps,
        { ...admin, role: 'editor' },
        { userId: 'u-2', newRole: 'admin' },
      ),
    ).rejects.toMatchObject({ code: 'permission-denied' });
  });

  it('rejects invalid newRole', async () => {
    const deps = fakeDeps();
    await expect(
      changeMemberRoleHandler(deps, admin, { userId: 'u-2', newRole: 'godmode' as never }),
    ).rejects.toMatchObject({ code: 'invalid-argument' });
  });
});
