// firebase/functions/src/auth/invite-member.test.ts
// T-262 AC #22 — inviteMember creates an invite doc with TTL 7 days.

import { describe, expect, it } from 'vitest';
import { inviteMemberHandler } from './invite-member.js';
import { MemoryFirestore, fakeDeps } from './test-helpers.js';

const admin = { uid: 'a', orgId: 'org-1', role: 'admin' as const };

describe('inviteMember (AC #22)', () => {
  it('creates an invite doc and returns the token', async () => {
    const fs = new MemoryFirestore();
    const now = 1_000_000;
    const deps = fakeDeps({ firestore: fs, clock: () => now });
    const result = await inviteMemberHandler(deps, admin, {
      email: 'b@example.com',
      role: 'editor',
    });
    expect(result.token).toBeTruthy();
    expect(result.expiresAt).toBe(now + 7 * 24 * 60 * 60 * 1000);
    const doc = fs.docs.get(`orgs/org-1/invites/${result.token}`);
    expect(doc?.data).toMatchObject({ email: 'b@example.com', role: 'editor', invitedBy: 'a' });
  });

  it('rejects non-admins', async () => {
    const deps = fakeDeps();
    await expect(
      inviteMemberHandler(deps, { ...admin, role: 'editor' }, { email: 'x@y.z', role: 'viewer' }),
    ).rejects.toMatchObject({ code: 'permission-denied' });
  });

  it('rejects invalid email', async () => {
    const deps = fakeDeps();
    await expect(
      inviteMemberHandler(deps, admin, { email: 'notanemail', role: 'viewer' }),
    ).rejects.toMatchObject({ code: 'invalid-argument' });
  });

  it('rejects invite-as-owner', async () => {
    const deps = fakeDeps();
    await expect(
      inviteMemberHandler(deps, admin, { email: 'x@y.z', role: 'owner' }),
    ).rejects.toMatchObject({ code: 'permission-denied' });
  });

  it('rejects elevation: admin cannot invite as admin+', async () => {
    const deps = fakeDeps();
    await expect(
      inviteMemberHandler(deps, { ...admin, role: 'editor' }, { email: 'x@y.z', role: 'admin' }),
    ).rejects.toMatchObject({ code: 'permission-denied' });
  });
});
