// packages/engine/src/handlers/cluster-d-compose/register.ts
// Bundle registration entrypoint for `cluster-d-compose`. Mirrors the
// `cluster-a-compose` / `cluster-b-compose` / `cluster-c-compose` /
// `cluster-e-compose` / `cluster-f-compose` / `cluster-g-compose` /
// `cluster-h-compose` / `cluster-i-compose` posture verbatim — the
// context is `ToolContext` because these handlers are read-only (no
// patch sink, no document reads) per T-347 / D-T347-2.

import type { BundleRegistry } from '../../bundles/registry.js';
import type { ToolRouter } from '../../router/router.js';
import type { ToolContext, ToolHandler } from '../../router/types.js';
import {
  CLUSTER_D_COMPOSE_BUNDLE_NAME,
  CLUSTER_D_COMPOSE_HANDLERS,
  CLUSTER_D_COMPOSE_TOOL_DEFINITIONS,
  CLUSTER_D_PRESET_IDS,
  type ClusterDPresetId,
  END_CREDITS_SCROLL_SPEEDS,
} from './handlers.js';

export {
  CLUSTER_D_COMPOSE_BUNDLE_NAME,
  CLUSTER_D_COMPOSE_HANDLERS,
  CLUSTER_D_COMPOSE_TOOL_DEFINITIONS,
  CLUSTER_D_PRESET_IDS,
  END_CREDITS_SCROLL_SPEEDS,
};
export type { ClusterDPresetId };

/**
 * Register the `cluster-d-compose` bundle: append the 3 LLM tool
 * definitions to the canonical bundle entry and route each handler on
 * the supplied `ToolRouter`. The router type parameter widens to any
 * subtype of `ToolContext` because the handlers don't need anything
 * narrower (no document, no patch sink).
 */
export function registerClusterDComposeBundle<TContext extends ToolContext>(
  registry: BundleRegistry,
  router: ToolRouter<TContext>,
): void {
  registry.mergeTools(CLUSTER_D_COMPOSE_BUNDLE_NAME, CLUSTER_D_COMPOSE_TOOL_DEFINITIONS);
  for (const handler of CLUSTER_D_COMPOSE_HANDLERS) {
    router.register(handler as unknown as ToolHandler<unknown, unknown, TContext>);
  }
}
