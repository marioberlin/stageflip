// packages/engine/src/handlers/semantic-layout/register.test.ts

import { describe, expect, it } from 'vitest';
import { BundleRegistry, createCanonicalRegistry } from '../../bundles/registry.js';
import { ToolRouter } from '../../router/router.js';
import type { MutationContext } from '../../router/types.js';
import {
  SEMANTIC_LAYOUT_BUNDLE_NAME,
  SEMANTIC_LAYOUT_HANDLERS,
  SEMANTIC_LAYOUT_TOOL_DEFINITIONS,
  registerSemanticLayoutBundle,
} from './register.js';

describe('registerSemanticLayoutBundle', () => {
  it('populates the bundle with matching tool defs', () => {
    const registry = createCanonicalRegistry();
    const router = new ToolRouter<MutationContext>();
    registerSemanticLayoutBundle(registry, router);
    const tools = registry.get(SEMANTIC_LAYOUT_BUNDLE_NAME)?.tools ?? [];
    expect(tools.map((t) => t.name)).toEqual(SEMANTIC_LAYOUT_TOOL_DEFINITIONS.map((t) => t.name));
  });

  it('registers every handler on the router', () => {
    const registry = createCanonicalRegistry();
    const router = new ToolRouter<MutationContext>();
    registerSemanticLayoutBundle(registry, router);
    expect(router.size).toBe(SEMANTIC_LAYOUT_HANDLERS.length);
    for (const h of SEMANTIC_LAYOUT_HANDLERS) expect(router.has(h.name)).toBe(true);
  });

  it('router ↔ registry name sets agree', () => {
    const registry = createCanonicalRegistry();
    const router = new ToolRouter<MutationContext>();
    registerSemanticLayoutBundle(registry, router);
    const registryNames = new Set(
      (registry.get(SEMANTIC_LAYOUT_BUNDLE_NAME)?.tools ?? []).map((t) => t.name),
    );
    expect(new Set(router.names())).toEqual(registryNames);
  });

  it('every handler declares bundle === "semantic-layout"', () => {
    for (const h of SEMANTIC_LAYOUT_HANDLERS) expect(h.bundle).toBe(SEMANTIC_LAYOUT_BUNDLE_NAME);
  });

  it('tool count stays within the I-9 budget (≤30)', () => {
    expect(SEMANTIC_LAYOUT_TOOL_DEFINITIONS.length).toBeLessThanOrEqual(30);
  });

  it('throws when the target registry has no bundle', () => {
    const registry = new BundleRegistry();
    const router = new ToolRouter<MutationContext>();
    expect(() => registerSemanticLayoutBundle(registry, router)).toThrow(
      /unknown bundle "semantic-layout"/,
    );
  });
});
