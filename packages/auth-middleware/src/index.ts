// packages/auth-middleware/src/index.ts
// @stageflip/auth-middleware — Node-side auth middleware for StageFlip
// HTTP and Cloud Function surfaces. Source of truth for principal
// resolution + role gating: skills/stageflip/concepts/auth/SKILL.md.

export {
  API_KEY_CACHE_TTL_MS,
  compareApiKey,
  hashApiKey,
  invalidateApiKeyCache,
  readApiKeyCache,
  writeApiKeyCache,
} from './api-key-verify.js';
export type { ApiKeyResolution, VerifyClock } from './api-key-verify.js';
export { AuthError, ForbiddenError } from './errors.js';
export type { AuthErrorBody, AuthErrorCode, ForbiddenErrorBody } from './errors.js';
export type {
  ApiKeyPrincipal,
  McpSessionPrincipal,
  Principal,
  UserPrincipal,
} from './principal.js';
export {
  API_KEY_INDEX_PREFIX_LEN,
  resolvePrincipal,
} from './resolve-principal.js';
export type {
  ApiKeyStore,
  DecodedFirebaseToken,
  DecodedMcpSession,
  IdTokenVerifier,
  McpSessionVerifier,
  PersistedApiKey,
  ResolvePrincipalContext,
} from './resolve-principal.js';
export type { AuthRequest, AuthResponse, NextFn, RequireAuthOptions } from './require-auth.js';
export { requireAuth } from './require-auth.js';
export type { RequireRoleOptions } from './require-role.js';
export { requireRole } from './require-role.js';
