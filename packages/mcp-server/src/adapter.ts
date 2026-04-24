// packages/mcp-server/src/adapter.ts
// T-222 — pure adapter between the engine's BundleRegistry + ToolRouter
// and the MCP wire protocol. Kept independent of the MCP SDK runtime so
// unit tests don't need a transport — `createMcpServer` in `server.ts`
// composes these functions into an SDK `Server` instance.

import { type BundleRegistry, type ToolRouter, ToolRouterError } from '@stageflip/engine';
import type { ToolContext } from '@stageflip/engine';

/**
 * MCP tool entry. Mirrors the MCP SDK's `Tool` shape without importing
 * from the SDK — keeps the adapter layer pure-TS and test-friendly.
 */
export interface McpToolEntry {
  readonly name: string;
  readonly description: string;
  readonly inputSchema: Record<string, unknown>;
}

export interface McpContentBlock {
  readonly type: 'text';
  readonly text: string;
}

export interface McpCallToolResult {
  readonly content: readonly McpContentBlock[];
  readonly isError?: boolean;
}

export interface BuildMcpToolListOptions {
  /**
   * If provided, only tools whose bundle is in this list are returned.
   * Empty array ⇒ no tools are exposed (the session has no permissions).
   * Omitting the option entirely ⇒ no filter, every tool exposed.
   */
  readonly allowedBundles?: readonly string[];
}

/**
 * Project every tool registered across every bundle into MCP's `Tool`
 * shape. Bundle insertion order + per-bundle tool order are preserved so
 * downstream consumers (clients, caches) see deterministic lists.
 */
export function buildMcpToolList(
  registry: BundleRegistry,
  options: BuildMcpToolListOptions = {},
): readonly McpToolEntry[] {
  const filter = options.allowedBundles;
  const list: McpToolEntry[] = [];
  for (const { name: bundleName } of registry.list()) {
    if (filter !== undefined && !filter.includes(bundleName)) continue;
    const bundle = registry.get(bundleName);
    if (!bundle) continue;
    for (const tool of bundle.tools) {
      list.push({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.input_schema,
      });
    }
  }
  return list;
}

export interface DispatchMcpToolCallArgs<TContext extends ToolContext> {
  readonly router: ToolRouter<TContext>;
  readonly name: string;
  readonly args: unknown;
  readonly context: TContext;
  /**
   * Optional bundle filter. When present, a call to a tool outside the
   * allowed set returns an `isError: true` result *without* dispatching
   * through the router. Tools inside the set go through the normal
   * router flow.
   */
  readonly allowedBundles?: readonly string[];
}

/**
 * Dispatch one MCP `tools/call` request. Maps router outcomes to MCP
 * semantics:
 *
 * - **Success** — stringifies the handler's JSON output into a single
 *   `text` content block.
 * - **ToolRouterError** — returns `{ isError: true, content: [text] }`
 *   with a human-readable diagnostic. MCP convention: errors surface as
 *   a failed tool-call result, not a JSON-RPC transport error.
 * - **Non-permitted tool** — short-circuits before dispatch.
 */
export async function dispatchMcpToolCall<TContext extends ToolContext>(
  args: DispatchMcpToolCallArgs<TContext>,
): Promise<McpCallToolResult> {
  const { router, name, context, allowedBundles } = args;
  const rawArgs = args.args === undefined ? {} : args.args;

  if (allowedBundles !== undefined) {
    const handler = router.get(name);
    if (!handler || !allowedBundles.includes(handler.bundle)) {
      return errorResult(
        `Tool "${name}" is not permitted for this session — not allowed by the session's bundle scope.`,
      );
    }
  }

  try {
    const output = await router.call(name, rawArgs, context);
    return {
      content: [{ type: 'text', text: stringify(output) }],
    };
  } catch (err) {
    if (err instanceof ToolRouterError) return errorResult(formatRouterError(err));
    const msg = err instanceof Error ? err.message : String(err);
    return errorResult(`Tool "${name}" dispatch failed: ${msg}`);
  }
}

function formatRouterError(err: ToolRouterError): string {
  switch (err.kind) {
    case 'unknown_tool':
      return `Unknown tool "${err.toolName}".`;
    case 'input_invalid': {
      const issues = err.issues ?? [];
      const summary = issues
        .slice(0, 3)
        .map((i) => `${i.path.join('.') || '<root>'}: ${i.message}`)
        .join('; ');
      return `Invalid input for "${err.toolName}": ${summary || err.message}`;
    }
    case 'output_invalid':
      return `Tool "${err.toolName}" returned an invalid output — handler contract violation.`;
    case 'aborted':
      return `Tool "${err.toolName}" was aborted before completion.`;
    default:
      // `handler_error` and any future kinds fall through to the raw
      // message — it already carries "handler threw: …" prefix.
      return err.message;
  }
}

function errorResult(text: string): McpCallToolResult {
  return {
    content: [{ type: 'text', text }],
    isError: true,
  };
}

function stringify(value: unknown): string {
  try {
    return JSON.stringify(value ?? null, null, 2);
  } catch {
    return String(value);
  }
}
