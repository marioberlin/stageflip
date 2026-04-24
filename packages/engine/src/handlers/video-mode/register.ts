// packages/engine/src/handlers/video-mode/register.ts
// One-shot bundle registration for `video-mode` (T-185).

import type { BundleRegistry } from '../../bundles/registry.js';
import type { ToolRouter } from '../../router/router.js';
import type { DocumentContext, ToolHandler } from '../../router/types.js';

import {
  VIDEO_MODE_BUNDLE_NAME,
  VIDEO_MODE_HANDLERS,
  VIDEO_MODE_TOOL_DEFINITIONS,
} from './handlers.js';

export { VIDEO_MODE_BUNDLE_NAME, VIDEO_MODE_HANDLERS, VIDEO_MODE_TOOL_DEFINITIONS };

/**
 * Register the `video-mode` bundle onto a registry + router pair. Handlers
 * type against `DocumentContext`; an Executor's wider `ExecutorContext`
 * satisfies the constraint automatically.
 */
export function registerVideoModeBundle<TContext extends DocumentContext>(
  registry: BundleRegistry,
  router: ToolRouter<TContext>,
): void {
  registry.mergeTools(VIDEO_MODE_BUNDLE_NAME, VIDEO_MODE_TOOL_DEFINITIONS);
  for (const handler of VIDEO_MODE_HANDLERS) {
    router.register(handler as unknown as ToolHandler<unknown, unknown, TContext>);
  }
}
