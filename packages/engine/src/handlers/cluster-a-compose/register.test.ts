// packages/engine/src/handlers/cluster-a-compose/register.test.ts
// Bundle-registration smoke test mirroring cluster-b-compose's
// `register.test.ts` shape — registry merges tool defs, router routes
// every handler, bundle name + tool count are stable.

import { describe, expect, it } from 'vitest';
import { BundleRegistry, createCanonicalRegistry } from '../../bundles/registry.js';
import { ToolRouter } from '../../router/router.js';
import type { ToolContext } from '../../router/types.js';
import {
  CLUSTER_A_COMPOSE_BUNDLE_NAME,
  CLUSTER_A_COMPOSE_HANDLERS,
  CLUSTER_A_COMPOSE_TOOL_DEFINITIONS,
  registerClusterAComposeBundle,
} from './register.js';

describe('registerClusterAComposeBundle', () => {
  it('populates the cluster-a-compose bundle with matching tool defs', () => {
    const registry = createCanonicalRegistry();
    const router = new ToolRouter<ToolContext>();
    registerClusterAComposeBundle(registry, router);
    const tools = registry.get(CLUSTER_A_COMPOSE_BUNDLE_NAME)?.tools ?? [];
    expect(tools.map((t) => t.name)).toEqual(CLUSTER_A_COMPOSE_TOOL_DEFINITIONS.map((t) => t.name));
    expect(tools.length).toBe(4);
  });

  it('registers every handler on the router', () => {
    const registry = createCanonicalRegistry();
    const router = new ToolRouter<ToolContext>();
    registerClusterAComposeBundle(registry, router);
    expect(router.size).toBe(CLUSTER_A_COMPOSE_HANDLERS.length);
    for (const h of CLUSTER_A_COMPOSE_HANDLERS) {
      expect(router.has(h.name)).toBe(true);
    }
  });

  it('every handler declares bundle === "cluster-a-compose"', () => {
    for (const h of CLUSTER_A_COMPOSE_HANDLERS) {
      expect(h.bundle).toBe(CLUSTER_A_COMPOSE_BUNDLE_NAME);
    }
  });

  it('tool names within the bundle are unique', () => {
    const names = CLUSTER_A_COMPOSE_TOOL_DEFINITIONS.map((t) => t.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('tool count stays within the I-9 budget (≤30)', () => {
    expect(CLUSTER_A_COMPOSE_TOOL_DEFINITIONS.length).toBeLessThanOrEqual(30);
  });

  it('throws when the target registry has no cluster-a-compose bundle', () => {
    const registry = new BundleRegistry();
    const router = new ToolRouter<ToolContext>();
    expect(() => registerClusterAComposeBundle(registry, router)).toThrow(
      /unknown bundle "cluster-a-compose"/,
    );
  });
});
