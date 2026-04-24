// apps/api/src/bin.ts
// T-231 — Cloud Run container entrypoint. Wires process.env into the
// server composition and starts listening. Shutdown signals close
// the server gracefully so Cloud Run's graceful-termination window
// is respected.

import { getApps, initializeApp } from 'firebase-admin/app';

import { startServer } from './server.js';

function readRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`missing required env ${name}`);
  return value;
}

async function main(): Promise<void> {
  if (getApps().length === 0) initializeApp();
  const mcpSecret = readRequiredEnv('STAGEFLIP_JWT_SECRET');
  const port = Number.parseInt(process.env.PORT ?? '8080', 10);

  const { close } = startServer({
    mcpSecret,
    port,
    resolvePrincipal: async ({ firebaseUid }) => {
      // TODO(T-262): resolve from Firestore users + orgs. Until then
      // every authenticated user is a single-org editor.
      return {
        sub: firebaseUid,
        org: 'org-default',
        role: 'editor',
        allowedBundles: ['read', 'create-mutate', 'validate'],
      };
    },
  });

  const shutdown = async (signal: string): Promise<void> => {
    process.stderr.write(`\n[api] received ${signal}, shutting down…\n`);
    await close();
    process.exit(0);
  };
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));

  process.stdout.write(`[api] listening on :${port}\n`);
}

main().catch((err) => {
  process.stderr.write(
    `[api] startup failure: ${err instanceof Error ? (err.stack ?? err.message) : String(err)}\n`,
  );
  process.exit(1);
});
