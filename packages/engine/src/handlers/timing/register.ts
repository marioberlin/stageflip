// packages/engine/src/handlers/timing/register.ts

import type { BundleRegistry } from '../../bundles/registry.js';
import type { ToolRouter } from '../../router/router.js';
import type { MutationContext, ToolHandler } from '../../router/types.js';
import { TIMING_BUNDLE_NAME, TIMING_HANDLERS, TIMING_TOOL_DEFINITIONS } from './handlers.js';

export { TIMING_BUNDLE_NAME, TIMING_HANDLERS, TIMING_TOOL_DEFINITIONS };

export function registerTimingBundle<TContext extends MutationContext>(
  registry: BundleRegistry,
  router: ToolRouter<TContext>,
): void {
  registry.mergeTools(TIMING_BUNDLE_NAME, TIMING_TOOL_DEFINITIONS);
  for (const handler of TIMING_HANDLERS) {
    router.register(handler as unknown as ToolHandler<unknown, unknown, TContext>);
  }
}
