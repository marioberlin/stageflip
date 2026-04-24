// apps/api/src/auth/verify.ts
// T-229 principal verifier. Accepts a Bearer-token string and
// resolves to one of two principal kinds:
//   - mcp-session: T-223 MCP session JWT (Claude plugin, CLI)
//   - firebase:    Firebase Admin-verified ID token (web app)
//
// MCP-session verification runs first — no network, and most API
// traffic is MCP. Tokens that fail MCP verification with a
// structural error (not expired) fall through to Firebase.

import { type McpSessionRole, verifyMcpSessionJwt } from '@stageflip/mcp-server';

export type UnauthorizedReason =
  | 'missing'
  | 'malformed'
  | 'expired'
  | 'invalid-signature'
  | 'verification-failed';

export class UnauthorizedError extends Error {
  readonly reason: UnauthorizedReason;

  constructor(reason: UnauthorizedReason, message: string) {
    super(message);
    this.name = 'UnauthorizedError';
    this.reason = reason;
  }
}

export interface McpPrincipal {
  readonly kind: 'mcp-session';
  readonly sub: string;
  readonly org: string;
  readonly role: McpSessionRole;
  readonly allowedBundles: readonly string[];
}

export interface FirebasePrincipal {
  readonly kind: 'firebase';
  readonly sub: string;
  readonly email?: string;
}

export type Principal = McpPrincipal | FirebasePrincipal;

export interface FirebaseIdClaims {
  readonly uid: string;
  readonly email?: string;
}

export interface PrincipalVerifierDeps {
  readonly mcpSecret: string;
  verifyFirebaseIdToken(token: string): Promise<FirebaseIdClaims>;
}

export type PrincipalVerifier = (authorization: string | undefined) => Promise<Principal>;

export function createPrincipalVerifier(deps: PrincipalVerifierDeps): PrincipalVerifier {
  return async (authorization) => {
    if (typeof authorization !== 'string' || authorization.length === 0) {
      throw new UnauthorizedError('missing', 'authorization header not present');
    }
    const match = /^Bearer\s+(.+)$/i.exec(authorization);
    if (!match || !match[1]) {
      throw new UnauthorizedError('malformed', 'authorization header missing Bearer prefix');
    }
    const token = match[1];

    try {
      const verified = await verifyMcpSessionJwt({ secret: deps.mcpSecret, token });
      return {
        kind: 'mcp-session',
        sub: verified.sub,
        org: verified.org,
        role: verified.role,
        allowedBundles: verified.allowedBundles,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (/expired/i.test(message)) {
        throw new UnauthorizedError('expired', `MCP session: ${message}`);
      }
    }

    try {
      const claims = await deps.verifyFirebaseIdToken(token);
      return claims.email !== undefined
        ? { kind: 'firebase', sub: claims.uid, email: claims.email }
        : { kind: 'firebase', sub: claims.uid };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new UnauthorizedError(
        'verification-failed',
        `neither MCP nor Firebase verification succeeded: ${message}`,
      );
    }
  };
}
