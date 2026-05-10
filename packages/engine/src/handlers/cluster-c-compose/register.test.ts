// packages/engine/src/handlers/cluster-c-compose/register.test.ts

import { describe, expect, it } from 'vitest';
import { BundleRegistry, createCanonicalRegistry } from '../../bundles/registry.js';
import { ToolRouter } from '../../router/router.js';
import type { ToolContext } from '../../router/types.js';
import {
  CLUSTER_C_COMPOSE_BUNDLE_NAME,
  CLUSTER_C_COMPOSE_HANDLERS,
  CLUSTER_C_COMPOSE_TOOL_DEFINITIONS,
  registerClusterCComposeBundle,
} from './register.js';

describe('registerClusterCComposeBundle', () => {
  it('populates the cluster-c-compose bundle with matching tool defs', () => {
    const registry = createCanonicalRegistry();
    const router = new ToolRouter<ToolContext>();
    registerClusterCComposeBundle(registry, router);
    const tools = registry.get(CLUSTER_C_COMPOSE_BUNDLE_NAME)?.tools ?? [];
    expect(tools.map((t) => t.name)).toEqual(CLUSTER_C_COMPOSE_TOOL_DEFINITIONS.map((t) => t.name));
    expect(tools.length).toBe(4);
  });

  it('registers every handler on the router', () => {
    const registry = createCanonicalRegistry();
    const router = new ToolRouter<ToolContext>();
    registerClusterCComposeBundle(registry, router);
    expect(router.size).toBe(CLUSTER_C_COMPOSE_HANDLERS.length);
    for (const h of CLUSTER_C_COMPOSE_HANDLERS) {
      expect(router.has(h.name)).toBe(true);
    }
  });

  it('every handler declares bundle === "cluster-c-compose"', () => {
    for (const h of CLUSTER_C_COMPOSE_HANDLERS) {
      expect(h.bundle).toBe(CLUSTER_C_COMPOSE_BUNDLE_NAME);
    }
  });

  it('tool names within the bundle are unique', () => {
    const names = CLUSTER_C_COMPOSE_TOOL_DEFINITIONS.map((t) => t.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('tool count stays within the I-9 budget (≤30)', () => {
    expect(CLUSTER_C_COMPOSE_TOOL_DEFINITIONS.length).toBeLessThanOrEqual(30);
  });

  it('throws when the target registry has no cluster-c-compose bundle', () => {
    const registry = new BundleRegistry();
    const router = new ToolRouter<ToolContext>();
    expect(() => registerClusterCComposeBundle(registry, router)).toThrow(
      /unknown bundle "cluster-c-compose"/,
    );
  });

  it('idempotent across separate registries', () => {
    const r1 = createCanonicalRegistry();
    const r2 = createCanonicalRegistry();
    const router1 = new ToolRouter<ToolContext>();
    const router2 = new ToolRouter<ToolContext>();
    registerClusterCComposeBundle(r1, router1);
    registerClusterCComposeBundle(r2, router2);
    const t1 = r1.get(CLUSTER_C_COMPOSE_BUNDLE_NAME)?.tools.map((t) => t.name) ?? [];
    const t2 = r2.get(CLUSTER_C_COMPOSE_BUNDLE_NAME)?.tools.map((t) => t.name) ?? [];
    expect(t1).toEqual(t2);
    expect(router1.size).toBe(router2.size);
  });
});
