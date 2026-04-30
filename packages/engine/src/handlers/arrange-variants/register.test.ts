// packages/engine/src/handlers/arrange-variants/register.test.ts

import { describe, expect, it } from 'vitest';
import { BundleRegistry, createCanonicalRegistry } from '../../bundles/registry.js';
import { ToolRouter } from '../../router/router.js';
import {
  ARRANGE_VARIANTS_BUNDLE_NAME,
  ARRANGE_VARIANTS_HANDLERS,
  ARRANGE_VARIANTS_TOOL_DEFINITIONS,
  type VariantPersistenceContext,
  registerArrangeVariantsBundle,
} from './register.js';

describe('registerArrangeVariantsBundle', () => {
  it('populates the arrange-variants bundle with matching tool defs', () => {
    const registry = createCanonicalRegistry();
    const router = new ToolRouter<VariantPersistenceContext>();
    registerArrangeVariantsBundle(registry, router);
    const tools = registry.get(ARRANGE_VARIANTS_BUNDLE_NAME)?.tools ?? [];
    expect(tools.map((t) => t.name)).toEqual(ARRANGE_VARIANTS_TOOL_DEFINITIONS.map((t) => t.name));
  });

  it('registers every handler on the router', () => {
    const registry = createCanonicalRegistry();
    const router = new ToolRouter<VariantPersistenceContext>();
    registerArrangeVariantsBundle(registry, router);
    expect(router.size).toBe(ARRANGE_VARIANTS_HANDLERS.length);
    for (const h of ARRANGE_VARIANTS_HANDLERS) expect(router.has(h.name)).toBe(true);
  });

  it('router ↔ registry name sets agree (drift gate)', () => {
    const registry = createCanonicalRegistry();
    const router = new ToolRouter<VariantPersistenceContext>();
    registerArrangeVariantsBundle(registry, router);
    const registryNames = new Set(
      (registry.get(ARRANGE_VARIANTS_BUNDLE_NAME)?.tools ?? []).map((t) => t.name),
    );
    expect(new Set(router.names())).toEqual(registryNames);
  });

  it('every handler declares bundle === "arrange-variants"', () => {
    for (const h of ARRANGE_VARIANTS_HANDLERS) expect(h.bundle).toBe(ARRANGE_VARIANTS_BUNDLE_NAME);
  });

  it('tool count stays within the I-9 budget (≤30)', () => {
    expect(ARRANGE_VARIANTS_TOOL_DEFINITIONS.length).toBeLessThanOrEqual(30);
  });

  it('throws when the target registry has no arrange-variants bundle', () => {
    const registry = new BundleRegistry();
    const router = new ToolRouter<VariantPersistenceContext>();
    expect(() => registerArrangeVariantsBundle(registry, router)).toThrow(
      /unknown bundle "arrange-variants"/,
    );
  });
});
