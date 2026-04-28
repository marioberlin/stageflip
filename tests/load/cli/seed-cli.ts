// tests/load/cli/seed-cli.ts
// Operator-facing wrapper around seed(). Reads config from env vars and
// invokes the seeder against a real store. T-269 ships the CLI shape; the
// concrete store implementation lands in the staging-runner repo (out of
// scope for this PR per task spec).
//
// Env vars (per AC #8 in tests/load/README.md):
//   STAGEFLIP_LOAD_TARGET       — base URL of the staging tenant.
//   STAGEFLIP_LOAD_AUTH_TOKEN   — admin token used by the store.
//   STAGEFLIP_LOAD_ORG_ID       — orgId to seed into.
//   STAGEFLIP_LOAD_USERS        — number of test users (default: 50).
//   STAGEFLIP_LOAD_DOCUMENTS    — number of seeded docs (default: 100).

import process from 'node:process';

import { seed } from '../seed.js';
import type { SeedStore, SeededDoc, SeededUser } from '../seed.js';

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    process.stderr.write(`seed-cli: missing required env var ${name}\n`);
    process.exit(2);
  }
  return v;
}

function intEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 0) {
    process.stderr.write(`seed-cli: invalid integer for ${name}: ${raw}\n`);
    process.exit(2);
  }
  return n;
}

/**
 * Stub store. Logs intent only — operator wires a real client in the
 * staging-runner overlay (see tests/load/README.md §Operator notes).
 */
class StubStore implements SeedStore {
  private seenUsers = new Set<string>();
  private seenDocs = new Set<string>();
  async hasUser(orgId: string, userId: string): Promise<boolean> {
    return this.seenUsers.has(`${orgId}::${userId}`);
  }
  async putUser(orgId: string, userId: string, _r: SeededUser): Promise<void> {
    this.seenUsers.add(`${orgId}::${userId}`);
  }
  async hasDoc(orgId: string, docKey: string): Promise<boolean> {
    return this.seenDocs.has(`${orgId}::${docKey}`);
  }
  async putDoc(orgId: string, docKey: string, _r: SeededDoc): Promise<void> {
    this.seenDocs.add(`${orgId}::${docKey}`);
  }
}

async function main(): Promise<void> {
  const target = requireEnv('STAGEFLIP_LOAD_TARGET');
  requireEnv('STAGEFLIP_LOAD_AUTH_TOKEN');
  const orgId = requireEnv('STAGEFLIP_LOAD_ORG_ID');
  const users = intEnv('STAGEFLIP_LOAD_USERS', 50);
  const documents = intEnv('STAGEFLIP_LOAD_DOCUMENTS', 100);
  process.stdout.write(
    `seed-cli: target=${target} org=${orgId} users=${users} docs=${documents}\n`,
  );
  const result = await seed({ users, documents, orgId, store: new StubStore() });
  process.stdout.write(
    `seed-cli: created ${result.usersCreated} users (skipped ${result.usersSkipped}), ` +
      `${result.docsCreated} docs (skipped ${result.docsSkipped})\n`,
  );
}

main().catch((err: unknown) => {
  process.stderr.write(`seed-cli: ${String(err)}\n`);
  process.exit(1);
});
