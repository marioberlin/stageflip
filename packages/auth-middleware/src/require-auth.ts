// packages/auth-middleware/src/require-auth.ts
// Connect-style middleware: parse Authorization → attach req.principal,
// or write a 401 with a structured body. Layered on `resolvePrincipal`
// (T-262 AC #10).

import { AuthError } from './errors.js';
import type { Principal } from './principal.js';
import {
  type ApiKeyStore,
  type IdTokenVerifier,
  type McpSessionVerifier,
  resolvePrincipal,
} from './resolve-principal.js';

/** Minimal request shape — Connect/Express compatible. */
export interface AuthRequest {
  headers: Record<string, string | string[] | undefined>;
  principal?: Principal;
}

/** Minimal response shape. */
export interface AuthResponse {
  status(code: number): AuthResponse;
  json(body: unknown): AuthResponse;
}

export type NextFn = (err?: unknown) => void;

export interface RequireAuthOptions {
  readonly idTokens: IdTokenVerifier;
  readonly apiKeys: ApiKeyStore;
  readonly mcpSessions?: McpSessionVerifier;
}

function header(req: AuthRequest, name: string): string | undefined {
  const lower = name.toLowerCase();
  for (const key of Object.keys(req.headers)) {
    if (key.toLowerCase() === lower) {
      const v = req.headers[key];
      if (Array.isArray(v)) return v[0];
      return v;
    }
  }
  return undefined;
}

/** Error → HTTP status mapping. */
function statusFor(code: AuthError['code']): number {
  switch (code) {
    case 'missing-org-header':
      return 400;
    default:
      return 401;
  }
}

/**
 * Build a `(req, res, next)` middleware that resolves the principal
 * and either calls `next()` or short-circuits with a 401/400.
 */
export function requireAuth(opts: RequireAuthOptions) {
  return async function requireAuthMiddleware(
    req: AuthRequest,
    res: AuthResponse,
    next: NextFn,
  ): Promise<void> {
    try {
      const principal = await resolvePrincipal({
        authorization: header(req, 'authorization'),
        orgIdHeader: header(req, 'x-org-id'),
        idTokens: opts.idTokens,
        apiKeys: opts.apiKeys,
        ...(opts.mcpSessions ? { mcpSessions: opts.mcpSessions } : {}),
      });
      req.principal = principal;
      next();
    } catch (err) {
      if (err instanceof AuthError) {
        res.status(statusFor(err.code)).json(err.toJSON());
        return;
      }
      next(err);
    }
  };
}
