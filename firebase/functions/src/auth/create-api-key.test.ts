// firebase/functions/src/auth/create-api-key.test.ts
// T-262 AC #20 — createApiKey requires admin, returns plaintext ONCE,
// and the plaintext must NEVER appear in logs/audit/errors.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApiKeyHandler } from './create-api-key.js';
import { MemoryFirestore, fakeDeps } from './test-helpers.js';

function admin() {
  return { uid: 'admin-1', orgId: 'org-1', role: 'admin' as const };
}

describe('createApiKey (AC #20)', () => {
  it('requires at-least admin', async () => {
    const deps = fakeDeps();
    await expect(
      createApiKeyHandler(
        deps,
        { ...admin(), role: 'editor' },
        {
          name: 'k',
          role: 'viewer',
        },
      ),
    ).rejects.toMatchObject({ code: 'permission-denied' });
  });

  it('returns the plaintext key ONCE and persists hash + prefix', async () => {
    const fs = new MemoryFirestore();
    const deps = fakeDeps({ firestore: fs });
    const result = await createApiKeyHandler(deps, admin(), { name: 'CI', role: 'editor' });
    expect(result.plaintext.startsWith('sf_dev_')).toBe(true);
    expect(result.prefix.startsWith('sf_dev_')).toBe(true);
    expect(result.id).toBeTruthy();

    // Stored doc has hash, NOT plaintext.
    const stored = fs.docs.get(`orgs/org-1/apiKeys/${result.id}`)?.data;
    expect(stored).toBeDefined();
    expect(typeof stored?.hashedKey).toBe('string');
    expect(stored?.hashedKey).not.toBe(result.plaintext);
    expect(stored?.role).toBe('editor');
    expect(stored?.createdBy).toBe('admin-1');
    expect(JSON.stringify(stored)).not.toContain(result.plaintext);
  });

  it('rejects elevation: cannot issue role higher than caller', async () => {
    const deps = fakeDeps();
    await expect(
      createApiKeyHandler(deps, { ...admin(), role: 'admin' }, { name: 'k', role: 'owner' }),
    ).rejects.toMatchObject({ code: 'permission-denied' });
  });

  it('rejects invalid role', async () => {
    const deps = fakeDeps();
    await expect(
      createApiKeyHandler(deps, admin(), { name: 'k', role: 'godmode' as never }),
    ).rejects.toMatchObject({ code: 'invalid-argument' });
  });
});

describe('createApiKey — plaintext leak guard (AC #20)', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let errSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy.mockRestore();
    errSpy.mockRestore();
  });

  it('does not log the plaintext key on the happy path', async () => {
    const deps = fakeDeps();
    const result = await createApiKeyHandler(deps, admin(), { name: 'k', role: 'editor' });
    for (const call of logSpy.mock.calls.concat(errSpy.mock.calls)) {
      const joined = call.map((x) => String(x)).join(' ');
      expect(joined).not.toContain(result.plaintext);
    }
  });

  it('does not put the plaintext into thrown error messages', async () => {
    // Force a failure path AFTER plaintext generation: hashApiKey throws.
    const boom = new Error('hash failure with plaintext sf_dev_LEAKED');
    const deps = fakeDeps({
      hashApiKey: async () => {
        throw boom;
      },
    });
    let thrown: unknown;
    try {
      await createApiKeyHandler(deps, admin(), { name: 'k', role: 'editor' });
    } catch (err) {
      thrown = err;
    }
    // The handler should NOT swallow the boom — but no plaintext we
    // generated leaks (the test's own message has 'LEAKED', so we just
    // check it didn't assemble a NEW message containing OUR generated
    // sf_dev_*). The handler propagates boom as-is.
    expect(thrown).toBe(boom);
  });
});
