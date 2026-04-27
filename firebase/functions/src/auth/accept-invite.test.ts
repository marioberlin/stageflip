// firebase/functions/src/auth/accept-invite.test.ts
// T-262 AC #23 — acceptInvite creates membership + deletes invite.

import { describe, expect, it } from 'vitest';
import { acceptInviteHandler } from './accept-invite.js';
import { MemoryFirestore, fakeDeps } from './test-helpers.js';

const caller = { uid: 'new-user', orgId: undefined, role: undefined };

describe('acceptInvite (AC #23)', () => {
  it('creates membership with invite role and deletes the invite', async () => {
    const fs = new MemoryFirestore();
    fs.seed('orgs/org-1/invites/tok-1', {
      email: 'new-user@example.com',
      role: 'editor',
      invitedBy: 'admin-1',
      createdAt: 1,
      expiresAt: Number.MAX_SAFE_INTEGER,
    });
    const deps = fakeDeps({ firestore: fs });
    const result = await acceptInviteHandler(deps, caller, { token: 'tok-1', orgId: 'org-1' });
    expect(result).toEqual({ orgId: 'org-1', role: 'editor' });

    const member = fs.docs.get('orgs/org-1/members/new-user')?.data;
    expect(member).toMatchObject({
      role: 'editor',
      invitedBy: 'admin-1',
      lastModifiedBy: 'admin-1',
    });

    const invite = fs.docs.get('orgs/org-1/invites/tok-1');
    expect(invite?.data).toBeUndefined();
  });

  it('rejects expired invites', async () => {
    const fs = new MemoryFirestore();
    fs.seed('orgs/org-1/invites/tok-old', {
      email: 'x@y.z',
      role: 'viewer',
      invitedBy: 'admin',
      createdAt: 1,
      expiresAt: 1,
    });
    const deps = fakeDeps({ firestore: fs, clock: () => 1_000_000 });
    await expect(
      acceptInviteHandler(deps, caller, { token: 'tok-old', orgId: 'org-1' }),
    ).rejects.toMatchObject({ code: 'failed-precondition' });
  });

  it('rejects unknown token', async () => {
    const deps = fakeDeps();
    await expect(
      acceptInviteHandler(deps, caller, { token: 'missing', orgId: 'org-1' }),
    ).rejects.toMatchObject({ code: 'not-found' });
  });

  it('rejects unauthenticated caller', async () => {
    const deps = fakeDeps();
    await expect(
      acceptInviteHandler(
        deps,
        { uid: '', orgId: undefined, role: undefined },
        { token: 't', orgId: 'o' },
      ),
    ).rejects.toMatchObject({ code: 'unauthenticated' });
  });
});
