// packages/engine/src/handlers/cluster-f-compose/register.test.ts
// Bundle-registration smoke test mirroring cluster-b-compose's
// `register.test.ts` shape — registry merges tool defs, router routes
// every handler, bundle name + tool count are stable.

import { describe, expect, it } from 'vitest';
import { BundleRegistry, createCanonicalRegistry } from '../../bundles/registry.js';
import { ToolRouter } from '../../router/router.js';
import type { ToolContext } from '../../router/types.js';
import {
  CLUSTER_F_COMPOSE_BUNDLE_NAME,
  CLUSTER_F_COMPOSE_HANDLERS,
  CLUSTER_F_COMPOSE_TOOL_DEFINITIONS,
  registerClusterFComposeBundle,
} from './register.js';

describe('registerClusterFComposeBundle', () => {
  it('populates the cluster-f-compose bundle with matching tool defs', () => {
    const registry = createCanonicalRegistry();
    const router = new ToolRouter<ToolContext>();
    registerClusterFComposeBundle(registry, router);
    const tools = registry.get(CLUSTER_F_COMPOSE_BUNDLE_NAME)?.tools ?? [];
    expect(tools.map((t) => t.name)).toEqual(CLUSTER_F_COMPOSE_TOOL_DEFINITIONS.map((t) => t.name));
    expect(tools.length).toBe(4);
  });

  it('registers every handler on the router', () => {
    const registry = createCanonicalRegistry();
    const router = new ToolRouter<ToolContext>();
    registerClusterFComposeBundle(registry, router);
    expect(router.size).toBe(CLUSTER_F_COMPOSE_HANDLERS.length);
    for (const h of CLUSTER_F_COMPOSE_HANDLERS) {
      expect(router.has(h.name)).toBe(true);
    }
  });

  it('every handler declares bundle === "cluster-f-compose"', () => {
    for (const h of CLUSTER_F_COMPOSE_HANDLERS) {
      expect(h.bundle).toBe(CLUSTER_F_COMPOSE_BUNDLE_NAME);
    }
  });

  it('tool names within the bundle are unique', () => {
    const names = CLUSTER_F_COMPOSE_TOOL_DEFINITIONS.map((t) => t.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('tool count stays within the I-9 budget (≤30)', () => {
    expect(CLUSTER_F_COMPOSE_TOOL_DEFINITIONS.length).toBeLessThanOrEqual(30);
  });

  it('throws when the target registry has no cluster-f-compose bundle', () => {
    const registry = new BundleRegistry();
    const router = new ToolRouter<ToolContext>();
    expect(() => registerClusterFComposeBundle(registry, router)).toThrow(
      /unknown bundle "cluster-f-compose"/,
    );
  });
});
