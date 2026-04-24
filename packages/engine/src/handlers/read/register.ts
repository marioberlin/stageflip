// packages/engine/src/handlers/read/register.ts
// One-shot bundle registration — `registerReadBundle(registry, router)`
// merges the read tools' LLMToolDefinitions onto the registry and installs
// the 5 handlers onto the router. Handler packages (T-155–T-168) all
// follow this pattern; executor-side callers only need one function call
// per bundle.

import type { BundleRegistry } from '../../bundles/registry.js';
import type { ToolRouter } from '../../router/router.js';
import type { DocumentContext, ToolHandler } from '../../router/types.js';
import { READ_BUNDLE_NAME, READ_HANDLERS, READ_TOOL_DEFINITIONS } from './handlers.js';

export { READ_BUNDLE_NAME, READ_HANDLERS, READ_TOOL_DEFINITIONS };

/**
 * Register the `read` bundle onto a registry + router pair. The router's
 * context must at least be a `DocumentContext` (handlers only read
 * `document` + `selection`); an Executor running with a wider
 * `ExecutorContext` satisfies that constraint automatically.
 */
export function registerReadBundle<TContext extends DocumentContext>(
  registry: BundleRegistry,
  router: ToolRouter<TContext>,
): void {
  registry.mergeTools(READ_BUNDLE_NAME, READ_TOOL_DEFINITIONS);
  for (const handler of READ_HANDLERS) {
    router.register(handler as unknown as ToolHandler<unknown, unknown, TContext>);
  }
}
