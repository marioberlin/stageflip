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
