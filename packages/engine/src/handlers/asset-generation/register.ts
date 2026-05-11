// packages/engine/src/handlers/asset-generation/register.ts
// Bundle registration entrypoint for `asset-generation`. Mirrors the
// cluster-h-compose posture (per T-379) but routes the handlers against
// `MutationContext` (per T-423 D-T423-2 — the bundle's tools dispatch
// through soft seams on `AssetGenerationContext extends MutationContext`).

import type { BundleRegistry } from '../../bundles/registry.js';
import type { ToolRouter } from '../../router/router.js';
import type { MutationContext, ToolHandler } from '../../router/types.js';
import {
  ASSET_GENERATION_BUNDLE_NAME,
  ASSET_GENERATION_HANDLERS,
  ASSET_GENERATION_TOOL_DEFINITIONS,
} from './handlers.js';

export {
  ASSET_GENERATION_BUNDLE_NAME,
  ASSET_GENERATION_HANDLERS,
  ASSET_GENERATION_TOOL_DEFINITIONS,
  type AssetGenerationContext,
  type ExecuteAdapterCallInput,
  type ExecuteAdapterCallResult,
} from './handlers.js';

/**
 * Register the `asset-generation` bundle: append the 3 LLM tool
 * definitions to the canonical bundle entry and route each handler on
 * the supplied `ToolRouter`. The router type parameter widens to any
 * subtype of `MutationContext` because the handlers consult an
 * optional `AssetGenerationContext` sub-interface — hosts wire the
 * seams via `ctx as AssetGenerationContext` when available.
 */
export function registerAssetGenerationBundle<TContext extends MutationContext>(
  registry: BundleRegistry,
  router: ToolRouter<TContext>,
): void {
  registry.mergeTools(ASSET_GENERATION_BUNDLE_NAME, ASSET_GENERATION_TOOL_DEFINITIONS);
  for (const handler of ASSET_GENERATION_HANDLERS) {
    router.register(handler as unknown as ToolHandler<unknown, unknown, TContext>);
  }
}
