// packages/engine/src/handlers/audience-engagement/register.test.ts
// Bundle-registration smoke test mirroring cluster-h-compose's
// `register.test.ts` shape — registry merges tool defs, router routes
// every handler, bundle name + tool count are stable.

import { describe, expect, it } from 'vitest';
import { BundleRegistry, createCanonicalRegistry } from '../../bundles/registry.js';
import { ToolRouter } from '../../router/router.js';
import type { ToolContext } from '../../router/types.js';
import {
  AUDIENCE_ENGAGEMENT_BUNDLE_NAME,
  AUDIENCE_ENGAGEMENT_HANDLERS,
  AUDIENCE_ENGAGEMENT_TOOL_DEFINITIONS,
  registerAudienceEngagementBundle,
} from './register.js';

describe('registerAudienceEngagementBundle', () => {
  it('populates the audience-engagement bundle with matching tool defs', () => {
    const registry = createCanonicalRegistry();
    const router = new ToolRouter<ToolContext>();
    registerAudienceEngagementBundle(registry, router);
    const tools = registry.get(AUDIENCE_ENGAGEMENT_BUNDLE_NAME)?.tools ?? [];
    expect(tools.map((t) => t.name)).toEqual(
      AUDIENCE_ENGAGEMENT_TOOL_DEFINITIONS.map((t) => t.name),
    );
    expect(tools.length).toBe(11);
  });

  it('registers every handler on the router', () => {
    const registry = createCanonicalRegistry();
    const router = new ToolRouter<ToolContext>();
    registerAudienceEngagementBundle(registry, router);
    expect(router.size).toBe(AUDIENCE_ENGAGEMENT_HANDLERS.length);
    for (const h of AUDIENCE_ENGAGEMENT_HANDLERS) {
      expect(router.has(h.name)).toBe(true);
    }
  });

  it('every handler declares bundle === "audience-engagement"', () => {
    for (const h of AUDIENCE_ENGAGEMENT_HANDLERS) {
      expect(h.bundle).toBe(AUDIENCE_ENGAGEMENT_BUNDLE_NAME);
    }
  });

  it('tool names within the bundle are unique', () => {
    const names = AUDIENCE_ENGAGEMENT_TOOL_DEFINITIONS.map((t) => t.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('tool count stays within the I-9 budget (≤30)', () => {
    expect(AUDIENCE_ENGAGEMENT_TOOL_DEFINITIONS.length).toBeLessThanOrEqual(30);
  });

  it('throws when the target registry has no audience-engagement bundle', () => {
    const registry = new BundleRegistry();
    const router = new ToolRouter<ToolContext>();
    expect(() => registerAudienceEngagementBundle(registry, router)).toThrow(
      /unknown bundle "audience-engagement"/,
    );
  });
});
