// packages/engine/src/handlers/read/register.test.ts

import { describe, expect, it } from 'vitest';
import { BundleRegistry, createCanonicalRegistry } from '../../bundles/registry.js';
import { ToolRouter } from '../../router/router.js';
import type { DocumentContext } from '../../router/types.js';
import { READ_BUNDLE_NAME, READ_HANDLERS, READ_TOOL_DEFINITIONS } from './handlers.js';
import { registerReadBundle } from './register.js';

describe('registerReadBundle', () => {
  it('populates the read bundle on the registry with matching tool defs', () => {
    const registry = createCanonicalRegistry();
    const router = new ToolRouter<DocumentContext>();
    expect(registry.get(READ_BUNDLE_NAME)?.tools).toHaveLength(0);

    registerReadBundle(registry, router);

    expect(registry.get(READ_BUNDLE_NAME)?.tools).toHaveLength(READ_TOOL_DEFINITIONS.length);
    expect(registry.get(READ_BUNDLE_NAME)?.tools.map((t) => t.name)).toEqual(
      READ_TOOL_DEFINITIONS.map((t) => t.name),
    );
  });

  it('registers every handler on the router', () => {
    const registry = createCanonicalRegistry();
    const router = new ToolRouter<DocumentContext>();
    registerReadBundle(registry, router);

    expect(router.size).toBe(READ_HANDLERS.length);
    for (const handler of READ_HANDLERS) expect(router.has(handler.name)).toBe(true);
  });

  it('router + registry agree on the per-tool name set (drift gate)', () => {
    const registry = createCanonicalRegistry();
    const router = new ToolRouter<DocumentContext>();
    registerReadBundle(registry, router);

    const routerNames = new Set(router.names());
    const registryNames = new Set((registry.get(READ_BUNDLE_NAME)?.tools ?? []).map((t) => t.name));
    expect(routerNames).toEqual(registryNames);
  });

  it('registered tool count stays within the I-9 budget (30)', () => {
    expect(READ_TOOL_DEFINITIONS.length).toBeLessThanOrEqual(30);
  });

  it('refuses double-registration on the router', () => {
    const registry = createCanonicalRegistry();
    const router = new ToolRouter<DocumentContext>();
    registerReadBundle(registry, router);
    expect(() => registerReadBundle(registry, router)).toThrow(/duplicate tool name/);
  });

  it('throws when the target registry has no read bundle to merge into', () => {
    const registry = new BundleRegistry(); // empty; no canonical seed
    const router = new ToolRouter<DocumentContext>();
    expect(() => registerReadBundle(registry, router)).toThrow(/unknown bundle "read"/);
  });

  it('declares READ_BUNDLE_NAME === "read" (matches the skill catalog)', () => {
    expect(READ_BUNDLE_NAME).toBe('read');
  });

  it('every handler declares bundle === "read" (tool-bundles §Enforcement invariant)', () => {
    for (const handler of READ_HANDLERS) {
      expect(handler.bundle).toBe(READ_BUNDLE_NAME);
    }
  });
});
