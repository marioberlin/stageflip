// packages/mcp-server/src/server.ts
// T-222 — factory that composes the adapter layer into an MCP SDK
// `Server`. Callers supply a populated BundleRegistry + ToolRouter + a
// per-call `buildContext` function; the factory wires the two MCP
// request types (tools/list, tools/call) into the router.
//
// The factory is transport-agnostic — connect the returned Server to a
// stdio, SSE, or InMemory transport as needed. T-223 layers an OAuth
// middleware in front; T-224 packages the server into the Claude plugin.

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';

import type { BundleRegistry, ToolRouter } from '@stageflip/engine';
import type { ToolContext } from '@stageflip/engine';

import { buildMcpToolList, dispatchMcpToolCall } from './adapter.js';

export interface McpServerDeps<TContext extends ToolContext = ToolContext> {
  readonly registry: BundleRegistry;
  readonly router: ToolRouter<TContext>;
  /**
   * Build the context passed to the underlying tool handler for one
   * `tools/call` request. Invoked once per call; may be async so
   * implementers can hydrate a document snapshot or open a transaction.
   */
  buildContext(toolName: string, args: unknown): TContext | Promise<TContext>;
  /**
   * Optional bundle scope. Tools outside the allowed bundles disappear
   * from `tools/list` and return an error on `tools/call`. Defaults to
   * "all bundles permitted" — T-223 tightens this per authenticated
   * principal.
   */
  readonly allowedBundles?: readonly string[];
  /** Server identity reported in the MCP handshake. */
  readonly serverInfo?: { readonly name: string; readonly version: string };
}

const DEFAULT_SERVER_INFO = {
  name: '@stageflip/mcp-server',
  version: '0.1.0',
} as const;

/**
 * Build a ready-to-connect MCP Server instance. Connect to a transport
 * via `server.connect(transport)` — the SDK's standard pattern.
 */
export function createMcpServer<TContext extends ToolContext>(
  deps: McpServerDeps<TContext>,
): Server {
  const { registry, router, buildContext, allowedBundles, serverInfo } = deps;
  const server = new Server(serverInfo ?? DEFAULT_SERVER_INFO, { capabilities: { tools: {} } });

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    const tools = buildMcpToolList(
      registry,
      allowedBundles !== undefined ? { allowedBundles } : {},
    );
    return { tools: tools.map((t) => ({ ...t })) };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const context = await buildContext(name, args);
    const result = await dispatchMcpToolCall({
      router,
      name,
      args,
      context,
      ...(allowedBundles !== undefined ? { allowedBundles } : {}),
    });
    return {
      content: result.content.map((b) => ({ ...b })),
      ...(result.isError !== undefined ? { isError: result.isError } : {}),
    };
  });

  return server;
}
