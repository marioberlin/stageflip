// packages/engine/src/handlers/cluster-f-compose/register.ts
// Bundle registration entrypoint for `cluster-f-compose`. Mirrors the
// `cluster-b-compose` posture verbatim — the context is `ToolContext`
// because these handlers are read-only (no patch sink, no document
// reads) per T-368 / D-T368-1.

import type { BundleRegistry } from '../../bundles/registry.js';
import type { ToolRouter } from '../../router/router.js';
import type { ToolContext, ToolHandler } from '../../router/types.js';
import {
  CLUSTER_F_COMPOSE_BUNDLE_NAME,
  CLUSTER_F_COMPOSE_HANDLERS,
  CLUSTER_F_COMPOSE_TOOL_DEFINITIONS,
} from './handlers.js';

export {
  CLUSTER_F_COMPOSE_BUNDLE_NAME,
  CLUSTER_F_COMPOSE_HANDLERS,
  CLUSTER_F_COMPOSE_TOOL_DEFINITIONS,
};

/**
 * Register the `cluster-f-compose` bundle: append the 4 LLM tool
 * definitions to the canonical bundle entry and route each handler on
 * the supplied `ToolRouter`. The router type parameter widens to any
 * subtype of `ToolContext` because the handlers don't need anything
 * narrower (no document, no patch sink).
 */
export function registerClusterFComposeBundle<TContext extends ToolContext>(
  registry: BundleRegistry,
  router: ToolRouter<TContext>,
): void {
  registry.mergeTools(CLUSTER_F_COMPOSE_BUNDLE_NAME, CLUSTER_F_COMPOSE_TOOL_DEFINITIONS);
  for (const handler of CLUSTER_F_COMPOSE_HANDLERS) {
    router.register(handler as unknown as ToolHandler<unknown, unknown, TContext>);
  }
}
