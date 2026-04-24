// packages/engine/src/handlers/domain-finance-sales-okr/register.ts

import type { BundleRegistry } from '../../bundles/registry.js';
import type { ToolRouter } from '../../router/router.js';
import type { MutationContext, ToolHandler } from '../../router/types.js';
import { DOMAIN_BUNDLE_NAME, DOMAIN_HANDLERS, DOMAIN_TOOL_DEFINITIONS } from './handlers.js';

export { DOMAIN_BUNDLE_NAME, DOMAIN_HANDLERS, DOMAIN_TOOL_DEFINITIONS };

export function registerDomainBundle<TContext extends MutationContext>(
  registry: BundleRegistry,
  router: ToolRouter<TContext>,
): void {
  registry.mergeTools(DOMAIN_BUNDLE_NAME, DOMAIN_TOOL_DEFINITIONS);
  for (const handler of DOMAIN_HANDLERS) {
    router.register(handler as unknown as ToolHandler<unknown, unknown, TContext>);
  }
}
