// packages/engine/src/handlers/validate/register.ts

import type { BundleRegistry } from '../../bundles/registry.js';
import type { ToolRouter } from '../../router/router.js';
import type { DocumentContext, ToolHandler } from '../../router/types.js';
import { VALIDATE_BUNDLE_NAME, VALIDATE_HANDLERS, VALIDATE_TOOL_DEFINITIONS } from './handlers.js';

export { VALIDATE_BUNDLE_NAME, VALIDATE_HANDLERS, VALIDATE_TOOL_DEFINITIONS };

export function registerValidateBundle<TContext extends DocumentContext>(
  registry: BundleRegistry,
  router: ToolRouter<TContext>,
): void {
  registry.mergeTools(VALIDATE_BUNDLE_NAME, VALIDATE_TOOL_DEFINITIONS);
  for (const handler of VALIDATE_HANDLERS) {
    router.register(handler as unknown as ToolHandler<unknown, unknown, TContext>);
  }
}
