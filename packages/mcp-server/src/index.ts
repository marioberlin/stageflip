// packages/mcp-server/src/index.ts
// @stageflip/mcp-server — MCP adapter that exposes the engine's
// semantic-tool registry to any MCP-aware agent (Claude plugin, Claude
// Desktop, etc.) via the @modelcontextprotocol/sdk Server surface.
//
// Public API:
//   createMcpServer({ registry, router, buildContext, allowedBundles?, serverInfo? })
//     → SDK `Server` ready to `.connect(transport)`.
//
//   buildMcpToolList / dispatchMcpToolCall — pure adapter functions
//     for callers that need custom transport handling or want to
//     compose their own server.
//
//   populateCanonicalRegistryForMcp — happy-path helper that mirrors
//     the slide/video/display app orchestrator's bundle registration.

export {
  buildMcpToolList,
  dispatchMcpToolCall,
  type BuildMcpToolListOptions,
  type DispatchMcpToolCallArgs,
  type McpCallToolResult,
  type McpContentBlock,
  type McpToolEntry,
} from './adapter.js';
export { createMcpServer, type McpServerDeps } from './server.js';
export {
  populateCanonicalRegistryForMcp,
  type PopulatedRegistry,
} from './populate.js';
// Auth (T-223): OAuth → JWT → local store, plus the request guard that
// binds a verified session's allowedBundles to the adapter's gate.
export {
  issueMcpSessionJwt,
  verifyMcpSessionJwt,
  type IssueMcpSessionJwtArgs,
  type McpSessionClaims,
  type McpSessionRole,
  type VerifiedMcpSession,
  type VerifyMcpSessionJwtArgs,
} from './auth/jwt.js';
export {
  createFileTokenStore,
  defaultTokenStorePath,
  type CreateFileTokenStoreArgs,
  type StoredToken,
  type TokenStore,
} from './auth/store.js';
export { derivePkceChallenge, generatePkceVerifier } from './auth/pkce.js';
export {
  MockAuthProvider,
  runAuthFlow,
  type AuthProvider,
  type AuthorizationUrlArgs,
  type ExchangeCodeArgs,
  type ExchangeCodeResult,
  type MintSessionJwtArgs,
  type RunAuthFlowArgs,
  type RunAuthFlowResult,
} from './auth/flow.js';
export {
  UnauthorizedError,
  guardMcpSession,
  type GuardMcpSessionArgs,
  type GuardMcpSessionResult,
  type McpSessionPrincipal,
  type UnauthorizedReason,
} from './auth/guard.js';
