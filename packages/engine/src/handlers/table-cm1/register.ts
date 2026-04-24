// packages/engine/src/handlers/table-cm1/register.ts

import type { BundleRegistry } from '../../bundles/registry.js';
import type { ToolRouter } from '../../router/router.js';
import type { MutationContext, ToolHandler } from '../../router/types.js';
import {
  TABLE_CM1_BUNDLE_NAME,
  TABLE_CM1_HANDLERS,
  TABLE_CM1_TOOL_DEFINITIONS,
} from './handlers.js';

export { TABLE_CM1_BUNDLE_NAME, TABLE_CM1_HANDLERS, TABLE_CM1_TOOL_DEFINITIONS };

export function registerTableCm1Bundle<TContext extends MutationContext>(
  registry: BundleRegistry,
  router: ToolRouter<TContext>,
): void {
  registry.mergeTools(TABLE_CM1_BUNDLE_NAME, TABLE_CM1_TOOL_DEFINITIONS);
  for (const handler of TABLE_CM1_HANDLERS) {
    router.register(handler as unknown as ToolHandler<unknown, unknown, TContext>);
  }
}
