// packages/engine/src/handlers/display-mode/register.ts
// One-shot bundle registration for `display-mode` (T-206).

import type { BundleRegistry } from '../../bundles/registry.js';
import type { ToolRouter } from '../../router/router.js';
import type { DocumentContext, ToolHandler } from '../../router/types.js';

import {
  DISPLAY_MODE_BUNDLE_NAME,
  DISPLAY_MODE_HANDLERS,
  DISPLAY_MODE_TOOL_DEFINITIONS,
} from './handlers.js';

export { DISPLAY_MODE_BUNDLE_NAME, DISPLAY_MODE_HANDLERS, DISPLAY_MODE_TOOL_DEFINITIONS };

/**
 * Register the `display-mode` bundle onto a registry + router pair.
 * Handlers type against `DocumentContext`; an Executor's wider
 * `ExecutorContext` satisfies the constraint automatically.
 */
export function registerDisplayModeBundle<TContext extends DocumentContext>(
  registry: BundleRegistry,
  router: ToolRouter<TContext>,
): void {
  registry.mergeTools(DISPLAY_MODE_BUNDLE_NAME, DISPLAY_MODE_TOOL_DEFINITIONS);
  for (const handler of DISPLAY_MODE_HANDLERS) {
    router.register(handler as unknown as ToolHandler<unknown, unknown, TContext>);
  }
}
