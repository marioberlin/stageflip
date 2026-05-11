// packages/engine/src/handlers/cluster-h-compose/register.ts
// Bundle registration entrypoint for `cluster-h-compose`. Mirrors the
// `cluster-g-compose` posture verbatim — `ToolContext`-narrow handlers
// (no patch sink, no document reads) per T-379 / D-T379-2.

import type { BundleRegistry } from '../../bundles/registry.js';
import type { ToolRouter } from '../../router/router.js';
import type { ToolContext, ToolHandler } from '../../router/types.js';
import {
  CLUSTER_H_COMPOSE_BUNDLE_NAME,
  CLUSTER_H_COMPOSE_HANDLERS,
  CLUSTER_H_COMPOSE_TOOL_DEFINITIONS,
} from './handlers.js';

export {
  CLUSTER_H_COMPOSE_BUNDLE_NAME,
  CLUSTER_H_COMPOSE_HANDLERS,
  CLUSTER_H_COMPOSE_TOOL_DEFINITIONS,
};

/**
 * Register the `cluster-h-compose` bundle: append the 3 LLM tool
 * definitions to the canonical bundle entry and route each handler on
 * the supplied `ToolRouter`. The router type parameter widens to any
 * subtype of `ToolContext` because the handlers don't need anything
 * narrower (no document, no patch sink).
 */
export function registerClusterHComposeBundle<TContext extends ToolContext>(
  registry: BundleRegistry,
  router: ToolRouter<TContext>,
): void {
  registry.mergeTools(CLUSTER_H_COMPOSE_BUNDLE_NAME, CLUSTER_H_COMPOSE_TOOL_DEFINITIONS);
  for (const handler of CLUSTER_H_COMPOSE_HANDLERS) {
    router.register(handler as unknown as ToolHandler<unknown, unknown, TContext>);
  }
}
