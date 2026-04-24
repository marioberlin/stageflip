// packages/engine/src/handlers/layout/register.ts

import type { BundleRegistry } from '../../bundles/registry.js';
import type { ToolRouter } from '../../router/router.js';
import type { MutationContext, ToolHandler } from '../../router/types.js';
import { LAYOUT_BUNDLE_NAME, LAYOUT_HANDLERS, LAYOUT_TOOL_DEFINITIONS } from './handlers.js';

export { LAYOUT_BUNDLE_NAME, LAYOUT_HANDLERS, LAYOUT_TOOL_DEFINITIONS };

export function registerLayoutBundle<TContext extends MutationContext>(
  registry: BundleRegistry,
  router: ToolRouter<TContext>,
): void {
  registry.mergeTools(LAYOUT_BUNDLE_NAME, LAYOUT_TOOL_DEFINITIONS);
  for (const handler of LAYOUT_HANDLERS) {
    router.register(handler as unknown as ToolHandler<unknown, unknown, TContext>);
  }
}
