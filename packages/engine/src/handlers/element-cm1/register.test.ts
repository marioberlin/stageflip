// packages/engine/src/handlers/element-cm1/register.test.ts

import { describe, expect, it } from 'vitest';
import { BundleRegistry, createCanonicalRegistry } from '../../bundles/registry.js';
import { ToolRouter } from '../../router/router.js';
import type { MutationContext } from '../../router/types.js';
import {
  ELEMENT_CM1_BUNDLE_NAME,
  ELEMENT_CM1_HANDLERS,
  ELEMENT_CM1_TOOL_DEFINITIONS,
  registerElementCm1Bundle,
} from './register.js';

describe('registerElementCm1Bundle', () => {
  it('populates the element-cm1 bundle with matching tool defs', () => {
    const registry = createCanonicalRegistry();
    const router = new ToolRouter<MutationContext>();
    registerElementCm1Bundle(registry, router);
    const tools = registry.get(ELEMENT_CM1_BUNDLE_NAME)?.tools ?? [];
    expect(tools.map((t) => t.name)).toEqual(ELEMENT_CM1_TOOL_DEFINITIONS.map((t) => t.name));
  });

  it('registers every handler on the router', () => {
    const registry = createCanonicalRegistry();
    const router = new ToolRouter<MutationContext>();
    registerElementCm1Bundle(registry, router);
    expect(router.size).toBe(ELEMENT_CM1_HANDLERS.length);
    for (const h of ELEMENT_CM1_HANDLERS) expect(router.has(h.name)).toBe(true);
  });

  it('router ↔ registry name sets agree (drift gate)', () => {
    const registry = createCanonicalRegistry();
    const router = new ToolRouter<MutationContext>();
    registerElementCm1Bundle(registry, router);
    const registryNames = new Set(
      (registry.get(ELEMENT_CM1_BUNDLE_NAME)?.tools ?? []).map((t) => t.name),
    );
    expect(new Set(router.names())).toEqual(registryNames);
  });

  it('every handler declares bundle === "element-cm1"', () => {
    for (const h of ELEMENT_CM1_HANDLERS) expect(h.bundle).toBe(ELEMENT_CM1_BUNDLE_NAME);
  });

  it('tool count stays within the I-9 budget (≤30)', () => {
    expect(ELEMENT_CM1_TOOL_DEFINITIONS.length).toBeLessThanOrEqual(30);
  });

  it('throws when the target registry has no element-cm1 bundle', () => {
    const registry = new BundleRegistry();
    const router = new ToolRouter<MutationContext>();
    expect(() => registerElementCm1Bundle(registry, router)).toThrow(
      /unknown bundle "element-cm1"/,
    );
  });
});
