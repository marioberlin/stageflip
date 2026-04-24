// packages/engine/src/handlers/slide-cm1/register.test.ts

import { describe, expect, it } from 'vitest';
import { BundleRegistry, createCanonicalRegistry } from '../../bundles/registry.js';
import { ToolRouter } from '../../router/router.js';
import type { MutationContext } from '../../router/types.js';
import {
  SLIDE_CM1_BUNDLE_NAME,
  SLIDE_CM1_HANDLERS,
  SLIDE_CM1_TOOL_DEFINITIONS,
  registerSlideCm1Bundle,
} from './register.js';

describe('registerSlideCm1Bundle', () => {
  it('populates the slide-cm1 bundle with matching tool defs', () => {
    const registry = createCanonicalRegistry();
    const router = new ToolRouter<MutationContext>();
    registerSlideCm1Bundle(registry, router);
    const tools = registry.get(SLIDE_CM1_BUNDLE_NAME)?.tools ?? [];
    expect(tools.map((t) => t.name)).toEqual(SLIDE_CM1_TOOL_DEFINITIONS.map((t) => t.name));
  });

  it('registers every handler on the router', () => {
    const registry = createCanonicalRegistry();
    const router = new ToolRouter<MutationContext>();
    registerSlideCm1Bundle(registry, router);
    expect(router.size).toBe(SLIDE_CM1_HANDLERS.length);
    for (const h of SLIDE_CM1_HANDLERS) expect(router.has(h.name)).toBe(true);
  });

  it('router ↔ registry name sets agree (drift gate)', () => {
    const registry = createCanonicalRegistry();
    const router = new ToolRouter<MutationContext>();
    registerSlideCm1Bundle(registry, router);
    const registryNames = new Set(
      (registry.get(SLIDE_CM1_BUNDLE_NAME)?.tools ?? []).map((t) => t.name),
    );
    expect(new Set(router.names())).toEqual(registryNames);
  });

  it('every handler declares bundle === "slide-cm1"', () => {
    for (const h of SLIDE_CM1_HANDLERS) expect(h.bundle).toBe(SLIDE_CM1_BUNDLE_NAME);
  });

  it('tool count stays within the I-9 budget (≤30)', () => {
    expect(SLIDE_CM1_TOOL_DEFINITIONS.length).toBeLessThanOrEqual(30);
  });

  it('throws when the target registry has no slide-cm1 bundle', () => {
    const registry = new BundleRegistry();
    const router = new ToolRouter<MutationContext>();
    expect(() => registerSlideCm1Bundle(registry, router)).toThrow(/unknown bundle "slide-cm1"/);
  });
});
