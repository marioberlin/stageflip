// apps/api/src/routes/mcp-session.ts
// T-229 /auth/mcp-session — called by the Claude plugin's
// GoogleAuthProvider (T-224) after a successful OAuth exchange.
// Verifies the Google id-token via Firebase Admin, resolves the
// principal to a StageFlip user + org + role + allowed bundles,
// and mints a short-lived MCP session JWT (T-223).

import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { z } from 'zod';

import { type McpSessionRole, issueMcpSessionJwt } from '@stageflip/mcp-server';

import type { FirebaseIdClaims } from '../auth/verify.js';

const BodySchema = z.object({
  idToken: z.string().min(1),
  accessToken: z.string().min(1),
});

export interface PrincipalLookup {
  readonly firebaseUid: string;
  readonly email?: string;
}

export interface PrincipalResolution {
  readonly sub: string;
  readonly org: string;
  readonly role: McpSessionRole;
  readonly allowedBundles: readonly string[];
}

export interface McpSessionDeps {
  readonly mcpSecret: string;
  readonly ttlSeconds?: number;
  verifyFirebaseIdToken(token: string): Promise<FirebaseIdClaims>;
  resolvePrincipal(lookup: PrincipalLookup): Promise<PrincipalResolution>;
}

const DEFAULT_TTL_SECONDS = 3600;

export function createMcpSessionRoute(deps: McpSessionDeps): Hono {
  const app = new Hono();
  app.post('/', zValidator('json', BodySchema), async (c) => {
    const { idToken } = c.req.valid('json');

    let claims: FirebaseIdClaims;
    try {
      claims = await deps.verifyFirebaseIdToken(idToken);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return c.json({ error: 'invalid_id_token', message }, 401);
    }

    const resolved = await deps.resolvePrincipal(
      claims.email !== undefined
        ? { firebaseUid: claims.uid, email: claims.email }
        : { firebaseUid: claims.uid },
    );

    const jwt = await issueMcpSessionJwt({
      secret: deps.mcpSecret,
      claims: {
        sub: resolved.sub,
        org: resolved.org,
        role: resolved.role,
        allowedBundles: [...resolved.allowedBundles],
      },
      ttlSeconds: deps.ttlSeconds ?? DEFAULT_TTL_SECONDS,
    });

    return c.json({ jwt });
  });
  return app;
}
