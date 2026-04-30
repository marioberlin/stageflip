// packages/engine/src/handlers/arrange-variants/register.ts
// One-shot bundle registration for `arrange-variants` (T-386).

import type { BundleRegistry } from '../../bundles/registry.js';
import type { ToolRouter } from '../../router/router.js';
import type { ToolHandler } from '../../router/types.js';
import {
  ARRANGE_VARIANTS_BUNDLE_NAME,
  ARRANGE_VARIANTS_HANDLERS,
  ARRANGE_VARIANTS_TOOL_DEFINITIONS,
  type VariantPersistenceContext,
} from './handlers.js';

export {
  ARRANGE_VARIANTS_BUNDLE_NAME,
  ARRANGE_VARIANTS_HANDLERS,
  ARRANGE_VARIANTS_TOOL_DEFINITIONS,
  type VariantPersistenceContext,
};

/**
 * Register the `arrange-variants` bundle onto a registry + router pair.
 * Handlers type against `VariantPersistenceContext`; the executor
 * narrows `ExecutorContext` so the tool can call `persistVariant`. A
 * test seam lives in the bundle's own `handlers.test.ts`.
 */
export function registerArrangeVariantsBundle<TContext extends VariantPersistenceContext>(
  registry: BundleRegistry,
  router: ToolRouter<TContext>,
): void {
  registry.mergeTools(ARRANGE_VARIANTS_BUNDLE_NAME, ARRANGE_VARIANTS_TOOL_DEFINITIONS);
  for (const handler of ARRANGE_VARIANTS_HANDLERS) {
    router.register(handler as unknown as ToolHandler<unknown, unknown, TContext>);
  }
}
