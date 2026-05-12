// packages/engine/src/handlers/audience-engagement/register.ts
// Bundle registration entrypoint for `audience-engagement`. Mirrors the
// `cluster-h-compose` posture verbatim — `ToolContext`-narrow handlers
// (no patch sink, no document reads) per T-379 / D-T379-2.

import type { BundleRegistry } from '../../bundles/registry.js';
import type { ToolRouter } from '../../router/router.js';
import type { ToolContext, ToolHandler } from '../../router/types.js';
import {
  AUDIENCE_ENGAGEMENT_BUNDLE_NAME,
  AUDIENCE_ENGAGEMENT_HANDLERS,
  AUDIENCE_ENGAGEMENT_TOOL_DEFINITIONS,
} from './handlers.js';

export {
  AUDIENCE_CLIP_KINDS,
  type AudienceClipKind,
  type AudienceComposeResult,
  AUDIENCE_ENGAGEMENT_BUNDLE_NAME,
  AUDIENCE_ENGAGEMENT_HANDLERS,
  AUDIENCE_ENGAGEMENT_TOOL_DEFINITIONS,
  QA_MODERATION_MODES,
  type QaModerationMode,
  SURVEY_QUESTION_KINDS,
  type SurveyQuestionKind,
} from './handlers.js';

/**
 * Register the `audience-engagement` bundle: append the 11 LLM tool
 * definitions to the canonical bundle entry and route each handler on
 * the supplied `ToolRouter`. The router type parameter widens to any
 * subtype of `ToolContext` because the handlers don't need anything
 * narrower (no document, no patch sink).
 */
export function registerAudienceEngagementBundle<TContext extends ToolContext>(
  registry: BundleRegistry,
  router: ToolRouter<TContext>,
): void {
  registry.mergeTools(AUDIENCE_ENGAGEMENT_BUNDLE_NAME, AUDIENCE_ENGAGEMENT_TOOL_DEFINITIONS);
  for (const handler of AUDIENCE_ENGAGEMENT_HANDLERS) {
    router.register(handler as unknown as ToolHandler<unknown, unknown, TContext>);
  }
}
