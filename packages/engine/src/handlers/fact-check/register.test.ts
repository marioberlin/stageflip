// packages/engine/src/handlers/fact-check/register.test.ts

import { describe, expect, it } from 'vitest';
import { BundleRegistry, createCanonicalRegistry } from '../../bundles/registry.js';
import { ToolRouter } from '../../router/router.js';
import type { MutationContext } from '../../router/types.js';
import {
  FACT_CHECK_BUNDLE_NAME,
  FACT_CHECK_HANDLERS,
  FACT_CHECK_TOOL_DEFINITIONS,
  registerFactCheckBundle,
} from './register.js';

describe('registerFactCheckBundle', () => {
  it('populates the fact-check bundle with matching tool defs', () => {
    const registry = createCanonicalRegistry();
    const router = new ToolRouter<MutationContext>();
    registerFactCheckBundle(registry, router);
    const tools = registry.get(FACT_CHECK_BUNDLE_NAME)?.tools ?? [];
    expect(tools.map((t) => t.name)).toEqual(FACT_CHECK_TOOL_DEFINITIONS.map((t) => t.name));
  });

  it('registers every handler on the router', () => {
    const registry = createCanonicalRegistry();
    const router = new ToolRouter<MutationContext>();
    registerFactCheckBundle(registry, router);
    expect(router.size).toBe(FACT_CHECK_HANDLERS.length);
    for (const h of FACT_CHECK_HANDLERS) expect(router.has(h.name)).toBe(true);
  });

  it('router ↔ registry name sets agree (drift gate)', () => {
    const registry = createCanonicalRegistry();
    const router = new ToolRouter<MutationContext>();
    registerFactCheckBundle(registry, router);
    const registryNames = new Set(
      (registry.get(FACT_CHECK_BUNDLE_NAME)?.tools ?? []).map((t) => t.name),
    );
    expect(new Set(router.names())).toEqual(registryNames);
  });

  it('every handler declares bundle === "fact-check"', () => {
    for (const h of FACT_CHECK_HANDLERS) expect(h.bundle).toBe(FACT_CHECK_BUNDLE_NAME);
  });

  it('tool count stays within the I-9 budget (≤30)', () => {
    expect(FACT_CHECK_TOOL_DEFINITIONS.length).toBeLessThanOrEqual(30);
  });

  it('throws when the target registry has no fact-check bundle', () => {
    const registry = new BundleRegistry();
    const router = new ToolRouter<MutationContext>();
    expect(() => registerFactCheckBundle(registry, router)).toThrow(/unknown bundle "fact-check"/);
  });
});
