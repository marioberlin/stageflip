// packages/engine/src/handlers/cluster-c-compose/register.ts
// Bundle registration entrypoint for `cluster-c-compose`. Mirrors the
// `cluster-a-compose` / `cluster-b-compose` / `cluster-e-compose` /
// `cluster-f-compose` / `cluster-g-compose` posture verbatim — the
// context is `ToolContext` because these handlers are read-only (no
// patch sink, no document reads) per T-347 / D-T347-2.

import type { BundleRegistry } from '../../bundles/registry.js';
import type { ToolRouter } from '../../router/router.js';
import type { ToolContext, ToolHandler } from '../../router/types.js';
import {
  CLUSTER_C_COMPOSE_BUNDLE_NAME,
  CLUSTER_C_COMPOSE_HANDLERS,
  CLUSTER_C_COMPOSE_TOOL_DEFINITIONS,
} from './handlers.js';

export {
  CLUSTER_C_COMPOSE_BUNDLE_NAME,
  CLUSTER_C_COMPOSE_HANDLERS,
  CLUSTER_C_COMPOSE_TOOL_DEFINITIONS,
};

/**
 * Register the `cluster-c-compose` bundle: append the 4 LLM tool
 * definitions to the canonical bundle entry and route each handler on
 * the supplied `ToolRouter`. The router type parameter widens to any
 * subtype of `ToolContext` because the handlers don't need anything
 * narrower (no document, no patch sink).
 */
export function registerClusterCComposeBundle<TContext extends ToolContext>(
  registry: BundleRegistry,
  router: ToolRouter<TContext>,
): void {
  registry.mergeTools(CLUSTER_C_COMPOSE_BUNDLE_NAME, CLUSTER_C_COMPOSE_TOOL_DEFINITIONS);
  for (const handler of CLUSTER_C_COMPOSE_HANDLERS) {
    router.register(handler as unknown as ToolHandler<unknown, unknown, TContext>);
  }
}
