// packages/engine/src/handlers/timing/register.test.ts

import { describe, expect, it } from 'vitest';
import { BundleRegistry, createCanonicalRegistry } from '../../bundles/registry.js';
import { ToolRouter } from '../../router/router.js';
import type { MutationContext } from '../../router/types.js';
import {
  TIMING_BUNDLE_NAME,
  TIMING_HANDLERS,
  TIMING_TOOL_DEFINITIONS,
  registerTimingBundle,
} from './register.js';

describe('registerTimingBundle', () => {
  it('populates the timing bundle with matching tool defs', () => {
    const registry = createCanonicalRegistry();
    const router = new ToolRouter<MutationContext>();
    registerTimingBundle(registry, router);
    const tools = registry.get(TIMING_BUNDLE_NAME)?.tools ?? [];
    expect(tools.map((t) => t.name)).toEqual(TIMING_TOOL_DEFINITIONS.map((t) => t.name));
  });

  it('registers every handler on the router', () => {
    const registry = createCanonicalRegistry();
    const router = new ToolRouter<MutationContext>();
    registerTimingBundle(registry, router);
    expect(router.size).toBe(TIMING_HANDLERS.length);
    for (const h of TIMING_HANDLERS) expect(router.has(h.name)).toBe(true);
  });

  it('router ↔ registry name sets agree (drift gate)', () => {
    const registry = createCanonicalRegistry();
    const router = new ToolRouter<MutationContext>();
    registerTimingBundle(registry, router);
    const registryNames = new Set(
      (registry.get(TIMING_BUNDLE_NAME)?.tools ?? []).map((t) => t.name),
    );
    expect(new Set(router.names())).toEqual(registryNames);
  });

  it('every handler declares bundle === "timing"', () => {
    for (const h of TIMING_HANDLERS) expect(h.bundle).toBe(TIMING_BUNDLE_NAME);
  });

  it('tool count stays within the I-9 budget (≤30)', () => {
    expect(TIMING_TOOL_DEFINITIONS.length).toBeLessThanOrEqual(30);
  });

  it('throws when the target registry has no timing bundle', () => {
    const registry = new BundleRegistry();
    const router = new ToolRouter<MutationContext>();
    expect(() => registerTimingBundle(registry, router)).toThrow(/unknown bundle "timing"/);
  });
});
