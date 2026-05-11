// packages/engine/src/handlers/asset-generation/register.test.ts
// Bundle-registration smoke test mirroring cluster-h-compose's register.test.ts —
// registry merges tool defs, router routes every handler, bundle name +
// tool count are stable.

import { describe, expect, it } from 'vitest';
import { BundleRegistry, createCanonicalRegistry } from '../../bundles/registry.js';
import { ToolRouter } from '../../router/router.js';
import type { MutationContext } from '../../router/types.js';
import {
  ASSET_GENERATION_BUNDLE_NAME,
  ASSET_GENERATION_HANDLERS,
  ASSET_GENERATION_TOOL_DEFINITIONS,
  registerAssetGenerationBundle,
} from './register.js';

describe('registerAssetGenerationBundle', () => {
  it('populates the asset-generation bundle with matching tool defs', () => {
    const registry = createCanonicalRegistry();
    const router = new ToolRouter<MutationContext>();
    registerAssetGenerationBundle(registry, router);
    const tools = registry.get(ASSET_GENERATION_BUNDLE_NAME)?.tools ?? [];
    expect(tools.map((t) => t.name)).toEqual(ASSET_GENERATION_TOOL_DEFINITIONS.map((t) => t.name));
    // T-443 — bundle grew from 3 tools to 4 (added `query_cost_budget`).
    expect(tools.length).toBe(4);
  });

  it('registers every handler on the router', () => {
    const registry = createCanonicalRegistry();
    const router = new ToolRouter<MutationContext>();
    registerAssetGenerationBundle(registry, router);
    expect(router.size).toBe(ASSET_GENERATION_HANDLERS.length);
    for (const h of ASSET_GENERATION_HANDLERS) {
      expect(router.has(h.name)).toBe(true);
    }
  });

  it('every handler declares bundle === "asset-generation"', () => {
    for (const h of ASSET_GENERATION_HANDLERS) {
      expect(h.bundle).toBe(ASSET_GENERATION_BUNDLE_NAME);
    }
  });

  it('tool names within the bundle are unique', () => {
    const names = ASSET_GENERATION_TOOL_DEFINITIONS.map((t) => t.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('tool count stays within the I-9 budget (≤30)', () => {
    expect(ASSET_GENERATION_TOOL_DEFINITIONS.length).toBeLessThanOrEqual(30);
  });

  it('throws when the target registry has no asset-generation bundle', () => {
    const registry = new BundleRegistry();
    const router = new ToolRouter<MutationContext>();
    expect(() => registerAssetGenerationBundle(registry, router)).toThrow(
      /unknown bundle "asset-generation"/,
    );
  });
});
