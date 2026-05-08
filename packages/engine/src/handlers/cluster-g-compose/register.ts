// packages/engine/src/handlers/cluster-g-compose/register.ts
// Bundle registration entrypoint for `cluster-g-compose`. Mirrors the
// `cluster-b-compose` posture verbatim — `ToolContext`-narrow handlers
// (no patch sink, no document reads) per T-374 / D-T374-2.

import type { BundleRegistry } from '../../bundles/registry.js';
import type { ToolRouter } from '../../router/router.js';
import type { ToolContext, ToolHandler } from '../../router/types.js';
import {
  CLUSTER_G_COMPOSE_BUNDLE_NAME,
  CLUSTER_G_COMPOSE_HANDLERS,
  CLUSTER_G_COMPOSE_TOOL_DEFINITIONS,
} from './handlers.js';

export {
  CLUSTER_G_COMPOSE_BUNDLE_NAME,
  CLUSTER_G_COMPOSE_HANDLERS,
  CLUSTER_G_COMPOSE_TOOL_DEFINITIONS,
};

/**
 * Register the `cluster-g-compose` bundle: append the 4 LLM tool
 * definitions to the canonical bundle entry and route each handler on
 * the supplied `ToolRouter`. The router type parameter widens to any
 * subtype of `ToolContext` because the handlers don't need anything
 * narrower (no document, no patch sink).
 */
export function registerClusterGComposeBundle<TContext extends ToolContext>(
  registry: BundleRegistry,
  router: ToolRouter<TContext>,
): void {
  registry.mergeTools(CLUSTER_G_COMPOSE_BUNDLE_NAME, CLUSTER_G_COMPOSE_TOOL_DEFINITIONS);
  for (const handler of CLUSTER_G_COMPOSE_HANDLERS) {
    router.register(handler as unknown as ToolHandler<unknown, unknown, TContext>);
  }
}
