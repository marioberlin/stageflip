// packages/engine/src/handlers/create-mutate/register.ts

import type { BundleRegistry } from '../../bundles/registry.js';
import type { ToolRouter } from '../../router/router.js';
import type { MutationContext, ToolHandler } from '../../router/types.js';
import {
  CREATE_MUTATE_BUNDLE_NAME,
  CREATE_MUTATE_HANDLERS,
  CREATE_MUTATE_TOOL_DEFINITIONS,
} from './handlers.js';

export { CREATE_MUTATE_BUNDLE_NAME, CREATE_MUTATE_HANDLERS, CREATE_MUTATE_TOOL_DEFINITIONS };

export function registerCreateMutateBundle<TContext extends MutationContext>(
  registry: BundleRegistry,
  router: ToolRouter<TContext>,
): void {
  registry.mergeTools(CREATE_MUTATE_BUNDLE_NAME, CREATE_MUTATE_TOOL_DEFINITIONS);
  for (const handler of CREATE_MUTATE_HANDLERS) {
    router.register(handler as unknown as ToolHandler<unknown, unknown, TContext>);
  }
}
