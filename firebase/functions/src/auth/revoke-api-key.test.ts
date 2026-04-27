// firebase/functions/src/auth/revoke-api-key.test.ts
// T-262 AC #21 — revokeApiKey marks revoked.

import { describe, expect, it } from 'vitest';
import { revokeApiKeyHandler } from './revoke-api-key.js';
import { MemoryFirestore, fakeDeps } from './test-helpers.js';

const admin = { uid: 'a', orgId: 'org-1', role: 'admin' as const };

describe('revokeApiKey (AC #21)', () => {
  it('sets revokedAt on the api-key doc', async () => {
    const fs = new MemoryFirestore();
    fs.seed('orgs/org-1/apiKeys/k1', {
      name: 'k',
      hashedKey: 'h',
      prefix: 'sf_dev_abc123',
      role: 'editor',
      createdAt: 1,
      createdBy: 'a',
    });
    const deps = fakeDeps({ firestore: fs, clock: () => 9_999 });
    const result = await revokeApiKeyHandler(deps, admin, { keyId: 'k1' });
    expect(result).toEqual({ success: true });
    expect(fs.docs.get('orgs/org-1/apiKeys/k1')?.data?.revokedAt).toBe(9_999);
  });

  it('rejects non-admins', async () => {
    const deps = fakeDeps();
    await expect(
      revokeApiKeyHandler(deps, { ...admin, role: 'editor' }, { keyId: 'k1' }),
    ).rejects.toMatchObject({ code: 'permission-denied' });
  });

  it('rejects unknown key', async () => {
    const deps = fakeDeps();
    await expect(revokeApiKeyHandler(deps, admin, { keyId: 'missing' })).rejects.toMatchObject({
      code: 'not-found',
    });
  });
});
