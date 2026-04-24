// packages/engine/src/handlers/slide-cm1/register.ts

import type { BundleRegistry } from '../../bundles/registry.js';
import type { ToolRouter } from '../../router/router.js';
import type { MutationContext, ToolHandler } from '../../router/types.js';
import {
  SLIDE_CM1_BUNDLE_NAME,
  SLIDE_CM1_HANDLERS,
  SLIDE_CM1_TOOL_DEFINITIONS,
} from './handlers.js';

export { SLIDE_CM1_BUNDLE_NAME, SLIDE_CM1_HANDLERS, SLIDE_CM1_TOOL_DEFINITIONS };

export function registerSlideCm1Bundle<TContext extends MutationContext>(
  registry: BundleRegistry,
  router: ToolRouter<TContext>,
): void {
  registry.mergeTools(SLIDE_CM1_BUNDLE_NAME, SLIDE_CM1_TOOL_DEFINITIONS);
  for (const handler of SLIDE_CM1_HANDLERS) {
    router.register(handler as unknown as ToolHandler<unknown, unknown, TContext>);
  }
}
