// packages/engine/src/handlers/cluster-g-compose/register.test.ts
// Bundle-registration smoke test mirroring cluster-b-compose's
// `register.test.ts` shape — registry merges tool defs, router routes
// every handler, bundle name + tool count are stable.

import { describe, expect, it } from 'vitest';
import { BundleRegistry, createCanonicalRegistry } from '../../bundles/registry.js';
import { ToolRouter } from '../../router/router.js';
import type { ToolContext } from '../../router/types.js';
import {
  CLUSTER_G_COMPOSE_BUNDLE_NAME,
  CLUSTER_G_COMPOSE_HANDLERS,
  CLUSTER_G_COMPOSE_TOOL_DEFINITIONS,
  registerClusterGComposeBundle,
} from './register.js';

describe('registerClusterGComposeBundle', () => {
  it('populates the cluster-g-compose bundle with matching tool defs', () => {
    const registry = createCanonicalRegistry();
    const router = new ToolRouter<ToolContext>();
    registerClusterGComposeBundle(registry, router);
    const tools = registry.get(CLUSTER_G_COMPOSE_BUNDLE_NAME)?.tools ?? [];
    expect(tools.map((t) => t.name)).toEqual(CLUSTER_G_COMPOSE_TOOL_DEFINITIONS.map((t) => t.name));
    expect(tools.length).toBe(4);
  });

  it('registers every handler on the router', () => {
    const registry = createCanonicalRegistry();
    const router = new ToolRouter<ToolContext>();
    registerClusterGComposeBundle(registry, router);
    expect(router.size).toBe(CLUSTER_G_COMPOSE_HANDLERS.length);
    for (const h of CLUSTER_G_COMPOSE_HANDLERS) {
      expect(router.has(h.name)).toBe(true);
    }
  });

  it('every handler declares bundle === "cluster-g-compose"', () => {
    for (const h of CLUSTER_G_COMPOSE_HANDLERS) {
      expect(h.bundle).toBe(CLUSTER_G_COMPOSE_BUNDLE_NAME);
    }
  });

  it('tool names within the bundle are unique', () => {
    const names = CLUSTER_G_COMPOSE_TOOL_DEFINITIONS.map((t) => t.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('tool count stays within the I-9 budget (≤30)', () => {
    expect(CLUSTER_G_COMPOSE_TOOL_DEFINITIONS.length).toBeLessThanOrEqual(30);
  });

  it('throws when the target registry has no cluster-g-compose bundle', () => {
    const registry = new BundleRegistry();
    const router = new ToolRouter<ToolContext>();
    expect(() => registerClusterGComposeBundle(registry, router)).toThrow(
      /unknown bundle "cluster-g-compose"/,
    );
  });
});
