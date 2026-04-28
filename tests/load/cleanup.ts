// tests/load/cleanup.ts
// AC #9 — idempotent test-data cleanup for the staging tenant.
//
// Removes every record created by seed.ts (matched by id prefix:
// `loaduser-` / `loaddoc-`). Re-running cleanup after a successful cleanup
// is a no-op (returns counts of 0).

export interface CleanupConfig {
  readonly orgId: string;
  readonly store: CleanupStore;
}

/** Store contract for cleanup — dual of SeedStore. */
export interface CleanupStore {
  listUsers(orgId: string, idPrefix: string): Promise<readonly string[]>;
  deleteUser(orgId: string, userId: string): Promise<void>;
  listDocs(orgId: string, keyPrefix: string): Promise<readonly string[]>;
  deleteDoc(orgId: string, docKey: string): Promise<void>;
}

export interface CleanupResult {
  readonly usersDeleted: number;
  readonly docsDeleted: number;
}

const USER_PREFIX = 'loaduser-';
const DOC_PREFIX = 'loaddoc-';

/**
 * Delete every load-test record from the org. Idempotent: a second call
 * after a successful cleanup returns `{ usersDeleted: 0, docsDeleted: 0 }`.
 */
export async function cleanup(config: CleanupConfig): Promise<CleanupResult> {
  const userIds = await config.store.listUsers(config.orgId, USER_PREFIX);
  let usersDeleted = 0;
  for (const userId of userIds) {
    await config.store.deleteUser(config.orgId, userId);
    usersDeleted++;
  }
  const docKeys = await config.store.listDocs(config.orgId, DOC_PREFIX);
  let docsDeleted = 0;
  for (const docKey of docKeys) {
    await config.store.deleteDoc(config.orgId, docKey);
    docsDeleted++;
  }
  return { usersDeleted, docsDeleted };
}
