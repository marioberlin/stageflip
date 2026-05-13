// apps/api/src/index.ts
// T-229 — @stageflip/app-api entry. Exports the building blocks the
// deployed API server composes:
//
//   - createPrincipalVerifier + authMiddleware: verify Firebase ID
//     tokens OR T-223 MCP session JWTs on every protected route.
//   - createMcpSessionRoute: the /auth/mcp-session mint endpoint
//     T-224's GoogleAuthProvider POSTs to after a successful OAuth
//     exchange.
//   - createFirebaseVerifier: lazy factory for the production
//     firebase-admin-backed verifier.
//
// The server composition (Hono app + listen port + graceful shutdown)
// is deliberately not in this package — Cloud Run wiring lives in
// T-231.

export {
  UnauthorizedError,
  createPrincipalVerifier,
  type FirebaseIdClaims,
  type FirebasePrincipal,
  type McpPrincipal,
  type Principal,
  type PrincipalVerifier,
  type PrincipalVerifierDeps,
  type UnauthorizedReason,
} from './auth/verify.js';

export {
  authMiddleware,
  type AuthMiddlewareOptions,
  type AuthVariables,
} from './auth/middleware.js';

export { createFirebaseVerifier, type FirebaseAdminOptions } from './auth/firebase.js';

export {
  createMcpSessionRoute,
  type McpSessionDeps,
  type PrincipalLookup,
  type PrincipalResolution,
} from './routes/mcp-session.js';

// T-411b — TenantSettings API surface (procedures + authorization predicate).
export {
  createTenantSettingsRoute,
  type TenantSettingsRouteDeps,
} from './routes/tenant-settings.js';
export {
  canSetInteractive,
  type AuthorizationActor,
  type AuthorizationDecision,
  type InteractiveValue,
} from './auth/can-set-interactive.js';

// T-453 — Audience-backend service surface. REST routes
// (open / close / state / join) + WebSocket multiplexer + rate-limit
// primitives + loss-flag emitter.
export {
  DEFAULT_AUDIENCE_FEATURE_SETTINGS,
  createAudienceSessionsRoute,
  type AudienceSessionsRouteDeps,
} from './routes/audience-sessions.js';
export {
  ReconnectBudget,
  authenticateHandshake,
  buildSnapshotFrame,
  createAudienceWebSocketServer,
  dispatchAudienceMessage,
  type AdminCommandFrame,
  type AudienceWebSocketServer,
  type AudienceWebSocketServerDeps,
  type DispatchDeps,
  type ErrorFrame,
  type HandshakeDeps,
  type HandshakeOutcome,
  type ServerInboundFrame,
  type ServerOutboundFrame,
  type SnapshotFrame,
  type VoteFrame,
  type WsPrincipal,
} from './routes/audience-ws.js';
export {
  TenantRateLimiter,
  TokenBucketRateLimiter,
  VoterRateLimiter,
  type RateLimitDecision,
  type TokenBucketConfig,
} from './routes/audience-rate-limit.js';
export {
  emitAudienceLossFlag,
  type AudienceLossFlagInput,
  type ServerAudienceLossFlagCode,
} from './routes/audience-loss-flags.js';

// T-542 — Admin pack-inventory surface. Read-only `GET /admin/tenants/:tenantId/packs`
// with an abstracted persistence layer (`TenantPackInventoryStore`) — v1 ships the
// in-memory implementation; Firestore adapter deferred to T-550.
export {
  InMemoryTenantPackInventoryStore,
  createAdminPackInventoryRoute,
  type AdminPackInventoryRouteDeps,
  type TenantPackInventoryRow,
  type TenantPackInventoryStore,
} from './routes/admin-pack-inventory.js';
