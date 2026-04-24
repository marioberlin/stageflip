// packages/engine/src/handlers/fact-check/register.ts

import type { BundleRegistry } from '../../bundles/registry.js';
import type { ToolRouter } from '../../router/router.js';
import type { MutationContext, ToolHandler } from '../../router/types.js';
import {
  FACT_CHECK_BUNDLE_NAME,
  FACT_CHECK_HANDLERS,
  FACT_CHECK_TOOL_DEFINITIONS,
} from './handlers.js';

export { FACT_CHECK_BUNDLE_NAME, FACT_CHECK_HANDLERS, FACT_CHECK_TOOL_DEFINITIONS };

export function registerFactCheckBundle<TContext extends MutationContext>(
  registry: BundleRegistry,
  router: ToolRouter<TContext>,
): void {
  registry.mergeTools(FACT_CHECK_BUNDLE_NAME, FACT_CHECK_TOOL_DEFINITIONS);
  for (const handler of FACT_CHECK_HANDLERS) {
    router.register(handler as unknown as ToolHandler<unknown, unknown, TContext>);
  }
}
