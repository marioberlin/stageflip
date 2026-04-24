// packages/engine/src/handlers/clip-animation/register.ts

import type { BundleRegistry } from '../../bundles/registry.js';
import type { ToolRouter } from '../../router/router.js';
import type { MutationContext, ToolHandler } from '../../router/types.js';
import {
  CLIP_ANIMATION_BUNDLE_NAME,
  CLIP_ANIMATION_HANDLERS,
  CLIP_ANIMATION_TOOL_DEFINITIONS,
} from './handlers.js';

export { CLIP_ANIMATION_BUNDLE_NAME, CLIP_ANIMATION_HANDLERS, CLIP_ANIMATION_TOOL_DEFINITIONS };

export function registerClipAnimationBundle<TContext extends MutationContext>(
  registry: BundleRegistry,
  router: ToolRouter<TContext>,
): void {
  registry.mergeTools(CLIP_ANIMATION_BUNDLE_NAME, CLIP_ANIMATION_TOOL_DEFINITIONS);
  for (const handler of CLIP_ANIMATION_HANDLERS) {
    router.register(handler as unknown as ToolHandler<unknown, unknown, TContext>);
  }
}
