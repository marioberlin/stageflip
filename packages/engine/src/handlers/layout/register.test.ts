// packages/engine/src/handlers/layout/register.test.ts

import { describe, expect, it } from 'vitest';
import { BundleRegistry, createCanonicalRegistry } from '../../bundles/registry.js';
import { ToolRouter } from '../../router/router.js';
import type { MutationContext } from '../../router/types.js';
import {
  LAYOUT_BUNDLE_NAME,
  LAYOUT_HANDLERS,
  LAYOUT_TOOL_DEFINITIONS,
  registerLayoutBundle,
} from './register.js';

describe('registerLayoutBundle', () => {
  it('populates the layout bundle with matching tool defs', () => {
    const registry = createCanonicalRegistry();
    const router = new ToolRouter<MutationContext>();
    registerLayoutBundle(registry, router);
    const tools = registry.get(LAYOUT_BUNDLE_NAME)?.tools ?? [];
    expect(tools.map((t) => t.name)).toEqual(LAYOUT_TOOL_DEFINITIONS.map((t) => t.name));
  });

  it('registers every handler on the router', () => {
    const registry = createCanonicalRegistry();
    const router = new ToolRouter<MutationContext>();
    registerLayoutBundle(registry, router);
    expect(router.size).toBe(LAYOUT_HANDLERS.length);
    for (const h of LAYOUT_HANDLERS) expect(router.has(h.name)).toBe(true);
  });

  it('router ↔ registry name sets agree (drift gate)', () => {
    const registry = createCanonicalRegistry();
    const router = new ToolRouter<MutationContext>();
    registerLayoutBundle(registry, router);
    const registryNames = new Set(
      (registry.get(LAYOUT_BUNDLE_NAME)?.tools ?? []).map((t) => t.name),
    );
    expect(new Set(router.names())).toEqual(registryNames);
  });

  it('every handler declares bundle === "layout"', () => {
    for (const h of LAYOUT_HANDLERS) expect(h.bundle).toBe(LAYOUT_BUNDLE_NAME);
  });

  it('tool count stays within the I-9 budget (≤30)', () => {
    expect(LAYOUT_TOOL_DEFINITIONS.length).toBeLessThanOrEqual(30);
  });

  it('throws when the target registry has no layout bundle', () => {
    const registry = new BundleRegistry();
    const router = new ToolRouter<MutationContext>();
    expect(() => registerLayoutBundle(registry, router)).toThrow(/unknown bundle "layout"/);
  });
});
