// packages/mcp-server/src/auth/jwt.ts
// T-223 — short-lived MCP session JWT. Symmetric HS256 because the
// flow pins one signer (`apps/api`) and one verifier (this package);
// asymmetric keys are unnecessary overhead here.
//
// Contract (per skills/stageflip/concepts/auth/SKILL.md §"MCP auth flow"):
// - `typ` must equal `"mcp-session"`.
// - `iss` must equal `"stageflip"`.
// - `allowedBundles` is a whitelist consumed by `createMcpServer`'s
//   bundle-gate (I-9); empty array ⇒ zero tools exposed.
// - Default TTL is 3600s; callers may shorten for testing.

import { SignJWT, errors, jwtVerify } from 'jose';

export type McpSessionRole = 'viewer' | 'editor' | 'admin' | 'owner';

export interface McpSessionClaims {
  readonly sub: string;
  readonly org: string;
  readonly role: McpSessionRole;
  readonly allowedBundles: readonly string[];
}

export interface IssueMcpSessionJwtArgs {
  readonly secret: string;
  readonly claims: McpSessionClaims;
  readonly ttlSeconds: number;
  /** Override the `typ` claim for tests. Defaults to `"mcp-session"`. */
  readonly typ?: string;
}

export interface VerifyMcpSessionJwtArgs {
  readonly secret: string;
  readonly token: string;
}

export interface VerifiedMcpSession extends McpSessionClaims {
  readonly iss: string;
  readonly typ: string;
  readonly exp: number;
  readonly iat: number;
}

const DEFAULT_TYP = 'mcp-session';
const EXPECTED_ISSUER = 'stageflip';

function toKey(secret: string): Uint8Array {
  return new TextEncoder().encode(secret);
}

/** Issue a signed MCP session JWT. The caller owns the shared secret. */
export async function issueMcpSessionJwt(args: IssueMcpSessionJwtArgs): Promise<string> {
  const { secret, claims, ttlSeconds, typ = DEFAULT_TYP } = args;
  const nowSeconds = Math.floor(Date.now() / 1000);
  const exp = nowSeconds + ttlSeconds;
  return await new SignJWT({
    org: claims.org,
    role: claims.role,
    allowedBundles: [...claims.allowedBundles],
    typ,
  })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuer(EXPECTED_ISSUER)
    .setSubject(claims.sub)
    .setIssuedAt(nowSeconds)
    .setExpirationTime(exp)
    .sign(toKey(secret));
}

/**
 * Verify a signed MCP session JWT. Throws on any of:
 *   - invalid signature / malformed token
 *   - expired (`exp` in the past)
 *   - `typ` claim not `"mcp-session"`
 *   - `iss` not `"stageflip"`
 */
export async function verifyMcpSessionJwt(
  args: VerifyMcpSessionJwtArgs,
): Promise<VerifiedMcpSession> {
  const { secret, token } = args;
  let result: { payload: Record<string, unknown> };
  try {
    result = await jwtVerify(token, toKey(secret), { issuer: EXPECTED_ISSUER });
  } catch (err) {
    if (err instanceof errors.JWTExpired) {
      throw new Error(`MCP session JWT expired at ${err.payload.exp}`);
    }
    throw err;
  }
  const payload = result.payload as Record<string, unknown>;
  const typ = payload.typ;
  if (typ !== DEFAULT_TYP) {
    throw new Error(`MCP session JWT typ claim is "${String(typ)}"; expected "${DEFAULT_TYP}"`);
  }
  const sub = payload.sub;
  const org = payload.org;
  const role = payload.role;
  const allowedBundles = payload.allowedBundles;
  const exp = payload.exp;
  const iat = payload.iat;
  const iss = payload.iss;

  if (typeof sub !== 'string' || typeof org !== 'string') {
    throw new Error('MCP session JWT missing sub/org claim');
  }
  if (role !== 'viewer' && role !== 'editor' && role !== 'admin' && role !== 'owner') {
    throw new Error(`MCP session JWT has invalid role claim "${String(role)}"`);
  }
  if (!Array.isArray(allowedBundles) || allowedBundles.some((b) => typeof b !== 'string')) {
    throw new Error('MCP session JWT allowedBundles claim must be a string array');
  }
  if (typeof exp !== 'number' || typeof iat !== 'number' || typeof iss !== 'string') {
    throw new Error('MCP session JWT missing standard exp/iat/iss claims');
  }

  return {
    sub,
    org,
    role,
    allowedBundles: allowedBundles as string[],
    exp,
    iat,
    iss,
    typ,
  };
}
