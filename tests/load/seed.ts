// tests/load/seed.ts
// AC #9 — idempotent test-data seeder for the staging tenant.
//
// Seeds:
//   - 1 test org (id: STAGEFLIP_LOAD_ORG_ID).
//   - N test users (one per VU), each with a JWT-stub + an api-key.
//   - 100 documents pre-populated (D-T269-4).
//
// Idempotency: each seed call queries existing state first; if a document
// with the same `seedKey` already exists, it is skipped. Re-running seed.ts
// against an already-seeded tenant is a no-op — emits a count and exits 0.
//
// This script is intentionally minimal at T-269 time. The real implementation
// will plug into @stageflip/storage-firebase admin client once that API
// stabilises post-T-271; for now the function shape and the idempotency
// invariant are pinned by tests in seed.test.ts.

export interface SeedConfig {
  /** Number of users (= number of VUs in the largest scenario). */
  readonly users: number;
  /** Number of pre-populated documents. D-T269-4 default = 100. */
  readonly documents: number;
  /** Shared org id for the seeded tenant. */
  readonly orgId: string;
  /**
   * Backend store. `'memory'` is used by unit tests; a real implementation
   * is plugged in by the staging-runner.
   */
  readonly store: SeedStore;
}

/** Minimal store contract — keeps the seeder testable without a live DB. */
export interface SeedStore {
  hasUser(orgId: string, userId: string): Promise<boolean>;
  putUser(orgId: string, userId: string, record: SeededUser): Promise<void>;
  hasDoc(orgId: string, docKey: string): Promise<boolean>;
  putDoc(orgId: string, docKey: string, record: SeededDoc): Promise<void>;
}

export interface SeededUser {
  readonly userId: string;
  readonly orgId: string;
  readonly apiKeyPrefix: string;
}

export interface SeededDoc {
  readonly docKey: string;
  readonly orgId: string;
  readonly title: string;
}

export interface SeedResult {
  readonly usersCreated: number;
  readonly usersSkipped: number;
  readonly docsCreated: number;
  readonly docsSkipped: number;
}

/**
 * Seed the staging tenant with the given config. Idempotent: a second call
 * with the same config is a no-op (returns counts of 0 created, N skipped).
 */
export async function seed(config: SeedConfig): Promise<SeedResult> {
  let usersCreated = 0;
  let usersSkipped = 0;
  for (let i = 0; i < config.users; i++) {
    const userId = `loaduser-${i.toString().padStart(4, '0')}`;
    const exists = await config.store.hasUser(config.orgId, userId);
    if (exists) {
      usersSkipped++;
      continue;
    }
    await config.store.putUser(config.orgId, userId, {
      userId,
      orgId: config.orgId,
      apiKeyPrefix: `sk_load_${i.toString().padStart(4, '0')}`,
    });
    usersCreated++;
  }
  let docsCreated = 0;
  let docsSkipped = 0;
  for (let i = 0; i < config.documents; i++) {
    const docKey = `loaddoc-${i.toString().padStart(4, '0')}`;
    const exists = await config.store.hasDoc(config.orgId, docKey);
    if (exists) {
      docsSkipped++;
      continue;
    }
    await config.store.putDoc(config.orgId, docKey, {
      docKey,
      orgId: config.orgId,
      title: `Load-test doc ${i}`,
    });
    docsCreated++;
  }
  return { usersCreated, usersSkipped, docsCreated, docsSkipped };
}
