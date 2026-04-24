// packages/engine/src/handlers/semantic-layout/register.ts

import type { BundleRegistry } from '../../bundles/registry.js';
import type { ToolRouter } from '../../router/router.js';
import type { MutationContext, ToolHandler } from '../../router/types.js';
import {
  SEMANTIC_LAYOUT_BUNDLE_NAME,
  SEMANTIC_LAYOUT_HANDLERS,
  SEMANTIC_LAYOUT_TOOL_DEFINITIONS,
} from './handlers.js';

export { SEMANTIC_LAYOUT_BUNDLE_NAME, SEMANTIC_LAYOUT_HANDLERS, SEMANTIC_LAYOUT_TOOL_DEFINITIONS };

export function registerSemanticLayoutBundle<TContext extends MutationContext>(
  registry: BundleRegistry,
  router: ToolRouter<TContext>,
): void {
  registry.mergeTools(SEMANTIC_LAYOUT_BUNDLE_NAME, SEMANTIC_LAYOUT_TOOL_DEFINITIONS);
  for (const handler of SEMANTIC_LAYOUT_HANDLERS) {
    router.register(handler as unknown as ToolHandler<unknown, unknown, TContext>);
  }
}
