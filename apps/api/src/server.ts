// apps/api/src/server.ts
// T-231 — composed Hono application entry. Wires the T-229
// building blocks (auth middleware + MCP session mint) into a real
// server + port listener. Cloud Run invokes this module as the
// container entrypoint.

import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { logger } from 'hono/logger';

import { createFirebaseVerifier } from './auth/firebase.js';
import { type AuthVariables, authMiddleware } from './auth/middleware.js';
import { createPrincipalVerifier } from './auth/verify.js';
import { type PrincipalResolution, createMcpSessionRoute } from './routes/mcp-session.js';

export interface ServerConfig {
  readonly mcpSecret: string;
  readonly port: number;
  /**
   * Called by the mint endpoint once the Google id-token has been
   * Firebase-verified. Production callers resolve the StageFlip
   * user + org + role from Firestore; tests inject a stub.
   */
  resolvePrincipal(args: { firebaseUid: string; email?: string }): Promise<PrincipalResolution>;
  /** Override the Firebase ID-token verifier (tests). */
  verifyFirebaseIdToken?: (token: string) => Promise<{ uid: string; email?: string }>;
}

/**
 * Build the fully-wired Hono app. Exported separately from `startServer`
 * so integration tests can drive it via `app.request(...)` without
 * opening a real socket.
 */
export function createApp(config: ServerConfig): Hono<{ Variables: AuthVariables }> {
  const verifyFirebaseIdToken = config.verifyFirebaseIdToken ?? createFirebaseVerifier();

  const verify = createPrincipalVerifier({
    mcpSecret: config.mcpSecret,
    verifyFirebaseIdToken,
  });

  const app = new Hono<{ Variables: AuthVariables }>();
  app.use('*', logger());

  // Cloud Run liveness probe.
  app.get('/healthz', (c) => c.json({ ok: true }));

  // Auth: mint an MCP session JWT from a verified Google id-token.
  app.route(
    '/auth/mcp-session',
    createMcpSessionRoute({
      mcpSecret: config.mcpSecret,
      verifyFirebaseIdToken,
      resolvePrincipal: config.resolvePrincipal,
    }),
  );

  // Protected API surface — placeholder for subsequent tasks.
  app.use('/v1/*', authMiddleware({ verify }));
  app.get('/v1/whoami', (c) => c.json({ principal: c.var.principal }));

  return app;
}

export interface StartServerOptions extends ServerConfig {
  /** Override for tests. Defaults to `@hono/node-server`'s `serve`. */
  readonly serveFn?: typeof serve;
}

export function startServer(options: StartServerOptions): { close: () => Promise<void> } {
  const app = createApp(options);
  const serveImpl = options.serveFn ?? serve;
  const server = serveImpl({
    fetch: app.fetch,
    port: options.port,
  });
  return {
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}
