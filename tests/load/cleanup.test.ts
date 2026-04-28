// tests/load/cleanup.test.ts
// AC #9 — pin cleanup.ts idempotency. cleanup-after-cleanup returns zeros.

import { describe, expect, it } from 'vitest';

import { cleanup } from './cleanup.js';
import type { CleanupStore } from './cleanup.js';

class InMemoryStore implements CleanupStore {
  users = new Set<string>();
  docs = new Set<string>();
  async listUsers(_orgId: string, prefix: string): Promise<readonly string[]> {
    return [...this.users].filter((id) => id.startsWith(prefix)).map((id) => id);
  }
  async deleteUser(_orgId: string, userId: string): Promise<void> {
    this.users.delete(userId);
  }
  async listDocs(_orgId: string, prefix: string): Promise<readonly string[]> {
    return [...this.docs].filter((k) => k.startsWith(prefix));
  }
  async deleteDoc(_orgId: string, docKey: string): Promise<void> {
    this.docs.delete(docKey);
  }
}

describe('cleanup()', () => {
  it('deletes every load-test record on first run', async () => {
    const store = new InMemoryStore();
    store.users.add('loaduser-0000');
    store.users.add('loaduser-0001');
    store.users.add('keep-me');
    store.docs.add('loaddoc-0000');
    store.docs.add('loaddoc-0001');
    store.docs.add('keep-doc');

    const result = await cleanup({ orgId: 'org-load', store });

    expect(result.usersDeleted).toBe(2);
    expect(result.docsDeleted).toBe(2);
    expect(store.users.has('keep-me')).toBe(true);
    expect(store.docs.has('keep-doc')).toBe(true);
  });

  it('is idempotent — second run is a no-op', async () => {
    const store = new InMemoryStore();
    store.users.add('loaduser-0000');
    store.docs.add('loaddoc-0000');
    await cleanup({ orgId: 'org-load', store });
    const result = await cleanup({ orgId: 'org-load', store });
    expect(result).toEqual({ usersDeleted: 0, docsDeleted: 0 });
  });

  it('does not touch records outside the load-test prefix', async () => {
    const store = new InMemoryStore();
    store.users.add('real-user-1');
    store.docs.add('real-doc-1');
    const result = await cleanup({ orgId: 'org-load', store });
    expect(result).toEqual({ usersDeleted: 0, docsDeleted: 0 });
    expect(store.users.has('real-user-1')).toBe(true);
    expect(store.docs.has('real-doc-1')).toBe(true);
  });
});
