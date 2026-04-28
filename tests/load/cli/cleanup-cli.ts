// tests/load/cli/cleanup-cli.ts
// Operator-facing wrapper around cleanup(). Mirror of seed-cli.ts.

import process from 'node:process';

import { cleanup } from '../cleanup.js';
import type { CleanupStore } from '../cleanup.js';

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    process.stderr.write(`cleanup-cli: missing required env var ${name}\n`);
    process.exit(2);
  }
  return v;
}

class StubStore implements CleanupStore {
  async listUsers(_orgId: string, _prefix: string): Promise<readonly string[]> {
    return [];
  }
  async deleteUser(_orgId: string, _userId: string): Promise<void> {}
  async listDocs(_orgId: string, _prefix: string): Promise<readonly string[]> {
    return [];
  }
  async deleteDoc(_orgId: string, _docKey: string): Promise<void> {}
}

async function main(): Promise<void> {
  const target = requireEnv('STAGEFLIP_LOAD_TARGET');
  requireEnv('STAGEFLIP_LOAD_AUTH_TOKEN');
  const orgId = requireEnv('STAGEFLIP_LOAD_ORG_ID');
  process.stdout.write(`cleanup-cli: target=${target} org=${orgId}\n`);
  const result = await cleanup({ orgId, store: new StubStore() });
  process.stdout.write(
    `cleanup-cli: deleted ${result.usersDeleted} users, ${result.docsDeleted} docs\n`,
  );
}

main().catch((err: unknown) => {
  process.stderr.write(`cleanup-cli: ${String(err)}\n`);
  process.exit(1);
});
