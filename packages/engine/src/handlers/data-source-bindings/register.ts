// packages/engine/src/handlers/data-source-bindings/register.ts

import type { BundleRegistry } from '../../bundles/registry.js';
import type { ToolRouter } from '../../router/router.js';
import type { MutationContext, ToolHandler } from '../../router/types.js';
import {
  DATA_SOURCE_BINDINGS_BUNDLE_NAME,
  DATA_SOURCE_BINDINGS_HANDLERS,
  DATA_SOURCE_BINDINGS_TOOL_DEFINITIONS,
} from './handlers.js';

export {
  DATA_SOURCE_BINDINGS_BUNDLE_NAME,
  DATA_SOURCE_BINDINGS_HANDLERS,
  DATA_SOURCE_BINDINGS_TOOL_DEFINITIONS,
};

export function registerDataSourceBindingsBundle<TContext extends MutationContext>(
  registry: BundleRegistry,
  router: ToolRouter<TContext>,
): void {
  registry.mergeTools(DATA_SOURCE_BINDINGS_BUNDLE_NAME, DATA_SOURCE_BINDINGS_TOOL_DEFINITIONS);
  for (const handler of DATA_SOURCE_BINDINGS_HANDLERS) {
    router.register(handler as unknown as ToolHandler<unknown, unknown, TContext>);
  }
}
