// packages/auth-middleware/src/resolve-principal.ts
// Parses an Authorization header into a resolved Principal (T-262 AC #7-#9).
//
// Two kinds of bearer token are accepted:
// 1. Firebase ID-token JWT (from `firebase/auth` client SDK) — verified
//    via the injected `IdTokenVerifier`. Custom claims `org` + `role`
//    on the verified token name the active org and the user's role on
//    that org. The convention matches `firebase/firestore.rules`'s
//    `request.auth.token.org` / `request.auth.token.role` lookups.
// 2. API key prefixed with `sf_<env>_` — looked up via
//    `ApiKeyStore.findByPrefix` and confirmed via scrypt-compare.
//
// MCP-session JWTs (T-223) are also accepted iff an `McpSessionVerifier`
// is provided; T-262's middleware accepts the JWT format T-223 emits.

import { type Role, roleSchema } from '@stageflip/auth-schema';
import {
  type ApiKeyResolution,
  compareApiKey,
  readApiKeyCache,
  writeApiKeyCache,
} from './api-key-verify.js';
import { AuthError } from './errors.js';
import type { Principal } from './principal.js';

/** Decoded claims from a Firebase ID token. */
export interface DecodedFirebaseToken {
  readonly uid: string;
  readonly org?: string;
  readonly role?: string;
  readonly exp?: number;
  readonly iat?: number;
}

/**
 * Verifier for Firebase ID tokens. Implementations wrap
 * `admin.auth().verifyIdToken(token)`. We accept any structurally-
 * matching shape so tests don't pull `firebase-admin`.
 */
export interface IdTokenVerifier {
  verifyIdToken(token: string): Promise<DecodedFirebaseToken>;
}

/** A persisted api-key record, projected to what the middleware needs. */
export interface PersistedApiKey {
  readonly id: string;
  readonly orgId: string;
  readonly hashedKey: string;
  readonly role: Role;
  readonly revokedAt?: number;
}

/**
 * Source of api-key records. The middleware looks up by `(orgId, prefix)`
 * because the request must carry `X-Org-Id` (D-T262-2) — that bound
 * keeps the lookup O(N keys per org), not O(N keys global).
 */
export interface ApiKeyStore {
  findByPrefix(orgId: string, prefix: string): Promise<PersistedApiKey[]>;
}

/** Decoded MCP-session token (subset, mirrors T-223's `VerifiedMcpSession`). */
export interface DecodedMcpSession {
  readonly sub: string;
  readonly org: string;
  readonly role: Role;
  readonly allowedBundles: readonly string[];
}

export interface McpSessionVerifier {
  verifyMcpSessionJwt(token: string): Promise<DecodedMcpSession>;
}

/** Inputs to `resolvePrincipal`. */
export interface ResolvePrincipalContext {
  readonly authorization: string | undefined;
  readonly orgIdHeader: string | undefined;
  readonly idTokens: IdTokenVerifier;
  readonly apiKeys: ApiKeyStore;
  readonly mcpSessions?: McpSessionVerifier;
}

/** API-key prefix regex; mirrors apiKeySchema.shape.prefix. */
const API_KEY_RE = /^sf_[a-z0-9]+_[A-Za-z0-9_-]+$/;

/** First N chars of the random suffix that the indexed `prefix` field stores. */
export const API_KEY_INDEX_PREFIX_LEN = 6;

function bearerToken(header: string | undefined): string {
  if (!header) {
    throw new AuthError({ code: 'missing-token', message: 'Authorization header is required' });
  }
  const trimmed = header.trim();
  const match = /^Bearer\s+(.+)$/i.exec(trimmed);
  if (!match) {
    throw new AuthError({
      code: 'invalid-token',
      message: 'Authorization header must be Bearer <token>',
    });
  }
  const token = match[1]?.trim();
  if (!token) {
    throw new AuthError({ code: 'invalid-token', message: 'Bearer token is empty' });
  }
  return token;
}

/**
 * Resolve `Authorization: Bearer ...` into a `Principal`.
 *
 * Throws:
 * - `AuthError({ code: 'missing-token' })` if no header.
 * - `AuthError({ code: 'invalid-token' })` for malformed input or
 *   verification failures that aren't "expired".
 * - `AuthError({ code: 'expired-token' })` when the verifier reports
 *   token expiry.
 * - `AuthError({ code: 'missing-org-header' })` if an api-key is
 *   presented without `X-Org-Id`.
 */
export async function resolvePrincipal(ctx: ResolvePrincipalContext): Promise<Principal> {
  const token = bearerToken(ctx.authorization);

  if (API_KEY_RE.test(token)) {
    return await resolveApiKey(token, ctx);
  }

  if (ctx.mcpSessions) {
    try {
      const decoded = await ctx.mcpSessions.verifyMcpSessionJwt(token);
      return {
        kind: 'mcp-session',
        userId: decoded.sub,
        orgId: decoded.org,
        role: decoded.role,
        allowedBundles: [...decoded.allowedBundles],
      };
    } catch {
      // Fall through to Firebase ID-token verification.
    }
  }

  let decoded: DecodedFirebaseToken;
  try {
    decoded = await ctx.idTokens.verifyIdToken(token);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/expired|exp claim/i.test(msg)) {
      throw new AuthError({ code: 'expired-token', message: 'Firebase ID token expired' });
    }
    throw new AuthError({ code: 'invalid-token', message: `Firebase ID token rejected: ${msg}` });
  }
  const { uid, org, role } = decoded;
  if (!uid || !org || !role) {
    throw new AuthError({
      code: 'invalid-token',
      message: 'Firebase ID token missing org/role custom claims',
    });
  }
  const parsedRole = roleSchema.safeParse(role);
  if (!parsedRole.success) {
    throw new AuthError({
      code: 'invalid-token',
      message: `Firebase ID token has unknown role claim "${role}"`,
    });
  }
  return { kind: 'user', userId: uid, orgId: org, role: parsedRole.data };
}

async function resolveApiKey(token: string, ctx: ResolvePrincipalContext): Promise<Principal> {
  const orgId = ctx.orgIdHeader?.trim();
  if (!orgId) {
    throw new AuthError({
      code: 'missing-org-header',
      message: 'X-Org-Id header is required for api-key auth',
    });
  }

  const cached = readApiKeyCache(token);
  if (cached && cached.orgId === orgId) {
    const parsedRole = roleSchema.safeParse(cached.role);
    if (parsedRole.success) {
      return { kind: 'apiKey', orgId: cached.orgId, keyId: cached.keyId, role: parsedRole.data };
    }
  }

  const indexedPrefix = token.slice(0, prefixIndexLength(token));
  const candidates = await ctx.apiKeys.findByPrefix(orgId, indexedPrefix);

  for (const candidate of candidates) {
    if (candidate.revokedAt !== undefined) continue;
    const ok = await compareApiKey(token, candidate.hashedKey);
    if (!ok) continue;
    const resolution: ApiKeyResolution = {
      orgId: candidate.orgId,
      keyId: candidate.id,
      role: candidate.role,
    };
    writeApiKeyCache(token, resolution);
    return { kind: 'apiKey', orgId: candidate.orgId, keyId: candidate.id, role: candidate.role };
  }
  throw new AuthError({
    code: 'unknown-api-key',
    message: 'Api-key did not match any active key for this org',
  });
}

/**
 * For an api-key shaped like `sf_<env>_<base64url>`, the indexed prefix
 * stored on the doc is `sf_<env>_<first 6 chars of suffix>`.
 */
function prefixIndexLength(token: string): number {
  const parts = token.split('_');
  if (parts.length < 3) return token.length;
  const head = parts[0] ?? '';
  const env = parts[1] ?? '';
  const headLen = head.length + 1 + env.length + 1;
  return Math.min(headLen + API_KEY_INDEX_PREFIX_LEN, token.length);
}
