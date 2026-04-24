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
