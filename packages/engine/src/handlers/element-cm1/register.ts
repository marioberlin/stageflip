// packages/engine/src/handlers/element-cm1/register.ts

import type { BundleRegistry } from '../../bundles/registry.js';
import type { ToolRouter } from '../../router/router.js';
import type { MutationContext, ToolHandler } from '../../router/types.js';
import {
  ELEMENT_CM1_BUNDLE_NAME,
  ELEMENT_CM1_HANDLERS,
  ELEMENT_CM1_TOOL_DEFINITIONS,
} from './handlers.js';

export { ELEMENT_CM1_BUNDLE_NAME, ELEMENT_CM1_HANDLERS, ELEMENT_CM1_TOOL_DEFINITIONS };

export function registerElementCm1Bundle<TContext extends MutationContext>(
  registry: BundleRegistry,
  router: ToolRouter<TContext>,
): void {
  registry.mergeTools(ELEMENT_CM1_BUNDLE_NAME, ELEMENT_CM1_TOOL_DEFINITIONS);
  for (const handler of ELEMENT_CM1_HANDLERS) {
    router.register(handler as unknown as ToolHandler<unknown, unknown, TContext>);
  }
}
