// packages/engine/src/handlers/cluster-i-compose/register.ts
// Bundle registration entrypoint for `cluster-i-compose`. Mirrors the
// `cluster-h-compose` posture verbatim — `ToolContext`-narrow handlers
// (no patch sink, no document reads) per T-379 / D-T379-2.

import type { BundleRegistry } from '../../bundles/registry.js';
import type { ToolRouter } from '../../router/router.js';
import type { ToolContext, ToolHandler } from '../../router/types.js';
import {
  CLUSTER_I_COMPOSE_BUNDLE_NAME,
  CLUSTER_I_COMPOSE_HANDLERS,
  CLUSTER_I_COMPOSE_TOOL_DEFINITIONS,
  CLUSTER_I_PRESET_IDS,
  type ClusterIComposeOutput,
  type ClusterIPresetId,
} from './handlers.js';

export {
  CLUSTER_I_COMPOSE_BUNDLE_NAME,
  CLUSTER_I_COMPOSE_HANDLERS,
  CLUSTER_I_COMPOSE_TOOL_DEFINITIONS,
  CLUSTER_I_PRESET_IDS,
};
export type { ClusterIComposeOutput, ClusterIPresetId };

/**
 * Register the `cluster-i-compose` bundle: append the 3 LLM tool
 * definitions to the canonical bundle entry and route each handler on
 * the supplied `ToolRouter`.
 */
export function registerClusterIComposeBundle<TContext extends ToolContext>(
  registry: BundleRegistry,
  router: ToolRouter<TContext>,
): void {
  registry.mergeTools(CLUSTER_I_COMPOSE_BUNDLE_NAME, CLUSTER_I_COMPOSE_TOOL_DEFINITIONS);
  for (const handler of CLUSTER_I_COMPOSE_HANDLERS) {
    router.register(handler as unknown as ToolHandler<unknown, unknown, TContext>);
  }
}
