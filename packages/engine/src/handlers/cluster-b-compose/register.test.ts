// packages/engine/src/handlers/cluster-b-compose/register.test.ts

import { describe, expect, it } from 'vitest';
import { BundleRegistry, createCanonicalRegistry } from '../../bundles/registry.js';
import { ToolRouter } from '../../router/router.js';
import type { ToolContext } from '../../router/types.js';
import {
  CLUSTER_B_COMPOSE_BUNDLE_NAME,
  CLUSTER_B_COMPOSE_HANDLERS,
  CLUSTER_B_COMPOSE_TOOL_DEFINITIONS,
  registerClusterBComposeBundle,
} from './register.js';

describe('registerClusterBComposeBundle', () => {
  it('populates the cluster-b-compose bundle with matching tool defs', () => {
    const registry = createCanonicalRegistry();
    const router = new ToolRouter<ToolContext>();
    registerClusterBComposeBundle(registry, router);
    const tools = registry.get(CLUSTER_B_COMPOSE_BUNDLE_NAME)?.tools ?? [];
    expect(tools.map((t) => t.name)).toEqual(CLUSTER_B_COMPOSE_TOOL_DEFINITIONS.map((t) => t.name));
    expect(tools.length).toBe(4);
  });

  it('registers every handler on the router', () => {
    const registry = createCanonicalRegistry();
    const router = new ToolRouter<ToolContext>();
    registerClusterBComposeBundle(registry, router);
    expect(router.size).toBe(CLUSTER_B_COMPOSE_HANDLERS.length);
    for (const h of CLUSTER_B_COMPOSE_HANDLERS) {
      expect(router.has(h.name)).toBe(true);
    }
  });

  it('every handler declares bundle === "cluster-b-compose"', () => {
    for (const h of CLUSTER_B_COMPOSE_HANDLERS) {
      expect(h.bundle).toBe(CLUSTER_B_COMPOSE_BUNDLE_NAME);
    }
  });

  it('tool names within the bundle are unique', () => {
    const names = CLUSTER_B_COMPOSE_TOOL_DEFINITIONS.map((t) => t.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('tool count stays within the I-9 budget (≤30)', () => {
    expect(CLUSTER_B_COMPOSE_TOOL_DEFINITIONS.length).toBeLessThanOrEqual(30);
  });

  it('throws when the target registry has no cluster-b-compose bundle', () => {
    const registry = new BundleRegistry();
    const router = new ToolRouter<ToolContext>();
    expect(() => registerClusterBComposeBundle(registry, router)).toThrow(
      /unknown bundle "cluster-b-compose"/,
    );
  });
});
