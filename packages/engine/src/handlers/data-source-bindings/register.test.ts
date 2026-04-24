// packages/engine/src/handlers/data-source-bindings/register.test.ts

import { describe, expect, it } from 'vitest';
import { BundleRegistry, createCanonicalRegistry } from '../../bundles/registry.js';
import { ToolRouter } from '../../router/router.js';
import type { MutationContext } from '../../router/types.js';
import {
  DATA_SOURCE_BINDINGS_BUNDLE_NAME,
  DATA_SOURCE_BINDINGS_HANDLERS,
  DATA_SOURCE_BINDINGS_TOOL_DEFINITIONS,
  registerDataSourceBindingsBundle,
} from './register.js';

describe('registerDataSourceBindingsBundle', () => {
  it('populates the bundle with matching tool defs', () => {
    const registry = createCanonicalRegistry();
    const router = new ToolRouter<MutationContext>();
    registerDataSourceBindingsBundle(registry, router);
    const tools = registry.get(DATA_SOURCE_BINDINGS_BUNDLE_NAME)?.tools ?? [];
    expect(tools.map((t) => t.name)).toEqual(
      DATA_SOURCE_BINDINGS_TOOL_DEFINITIONS.map((t) => t.name),
    );
  });

  it('registers every handler on the router', () => {
    const registry = createCanonicalRegistry();
    const router = new ToolRouter<MutationContext>();
    registerDataSourceBindingsBundle(registry, router);
    expect(router.size).toBe(DATA_SOURCE_BINDINGS_HANDLERS.length);
    for (const h of DATA_SOURCE_BINDINGS_HANDLERS) expect(router.has(h.name)).toBe(true);
  });

  it('router ↔ registry name sets agree', () => {
    const registry = createCanonicalRegistry();
    const router = new ToolRouter<MutationContext>();
    registerDataSourceBindingsBundle(registry, router);
    const registryNames = new Set(
      (registry.get(DATA_SOURCE_BINDINGS_BUNDLE_NAME)?.tools ?? []).map((t) => t.name),
    );
    expect(new Set(router.names())).toEqual(registryNames);
  });

  it('every handler declares bundle === "data-source-bindings"', () => {
    for (const h of DATA_SOURCE_BINDINGS_HANDLERS)
      expect(h.bundle).toBe(DATA_SOURCE_BINDINGS_BUNDLE_NAME);
  });

  it('tool count stays within the I-9 budget (≤30)', () => {
    expect(DATA_SOURCE_BINDINGS_TOOL_DEFINITIONS.length).toBeLessThanOrEqual(30);
  });

  it('throws when the target registry has no bundle', () => {
    const registry = new BundleRegistry();
    const router = new ToolRouter<MutationContext>();
    expect(() => registerDataSourceBindingsBundle(registry, router)).toThrow(
      /unknown bundle "data-source-bindings"/,
    );
  });
});
