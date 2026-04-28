// tests/load/seed.test.ts
// AC #9 — pin seed.ts idempotency. Two seed() calls with same config:
// first creates everything; second creates nothing.

import { describe, expect, it } from 'vitest';

import { seed } from './seed.js';
import type { SeedStore, SeededDoc, SeededUser } from './seed.js';

class InMemoryStore implements SeedStore {
  private users = new Map<string, SeededUser>();
  private docs = new Map<string, SeededDoc>();
  private k(a: string, b: string): string {
    return `${a}::${b}`;
  }
  async hasUser(orgId: string, userId: string): Promise<boolean> {
    return this.users.has(this.k(orgId, userId));
  }
  async putUser(orgId: string, userId: string, record: SeededUser): Promise<void> {
    this.users.set(this.k(orgId, userId), record);
  }
  async hasDoc(orgId: string, docKey: string): Promise<boolean> {
    return this.docs.has(this.k(orgId, docKey));
  }
  async putDoc(orgId: string, docKey: string, record: SeededDoc): Promise<void> {
    this.docs.set(this.k(orgId, docKey), record);
  }
  userCount(): number {
    return this.users.size;
  }
  docCount(): number {
    return this.docs.size;
  }
}

describe('seed()', () => {
  it('creates users + docs on first run', async () => {
    const store = new InMemoryStore();
    const result = await seed({ users: 5, documents: 10, orgId: 'org-load', store });
    expect(result.usersCreated).toBe(5);
    expect(result.usersSkipped).toBe(0);
    expect(result.docsCreated).toBe(10);
    expect(result.docsSkipped).toBe(0);
    expect(store.userCount()).toBe(5);
    expect(store.docCount()).toBe(10);
  });

  it('is idempotent — second run creates nothing', async () => {
    const store = new InMemoryStore();
    await seed({ users: 5, documents: 10, orgId: 'org-load', store });
    const result = await seed({ users: 5, documents: 10, orgId: 'org-load', store });
    expect(result.usersCreated).toBe(0);
    expect(result.usersSkipped).toBe(5);
    expect(result.docsCreated).toBe(0);
    expect(result.docsSkipped).toBe(10);
    expect(store.userCount()).toBe(5);
    expect(store.docCount()).toBe(10);
  });

  it('handles partial-prior-run by topping up', async () => {
    const store = new InMemoryStore();
    await seed({ users: 3, documents: 5, orgId: 'org-load', store });
    const result = await seed({ users: 5, documents: 10, orgId: 'org-load', store });
    expect(result.usersCreated).toBe(2);
    expect(result.usersSkipped).toBe(3);
    expect(result.docsCreated).toBe(5);
    expect(result.docsSkipped).toBe(5);
  });

  it('produces deterministic, padded ids', async () => {
    const store = new InMemoryStore();
    await seed({ users: 1, documents: 1, orgId: 'org-load', store });
    expect(await store.hasUser('org-load', 'loaduser-0000')).toBe(true);
    expect(await store.hasDoc('org-load', 'loaddoc-0000')).toBe(true);
  });

  it('zero-user / zero-doc config produces zero side-effects', async () => {
    const store = new InMemoryStore();
    const result = await seed({ users: 0, documents: 0, orgId: 'org-load', store });
    expect(result).toEqual({
      usersCreated: 0,
      usersSkipped: 0,
      docsCreated: 0,
      docsSkipped: 0,
    });
  });
});
