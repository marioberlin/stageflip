// packages/engine/src/handlers/display-mode/register.test.ts
// Drift-gate tests for registerDisplayModeBundle (T-206).

import { describe, expect, it } from 'vitest';

import { BundleRegistry, createCanonicalRegistry } from '../../bundles/registry.js';
import { ToolRouter } from '../../router/router.js';
import type { DocumentContext } from '../../router/types.js';
import {
  DISPLAY_MODE_BUNDLE_NAME,
  DISPLAY_MODE_HANDLERS,
  DISPLAY_MODE_TOOL_DEFINITIONS,
} from './handlers.js';
import { registerDisplayModeBundle } from './register.js';

describe('registerDisplayModeBundle', () => {
  it('populates the display-mode bundle on the registry with matching tool defs', () => {
    const registry = createCanonicalRegistry();
    const router = new ToolRouter<DocumentContext>();
    expect(registry.get(DISPLAY_MODE_BUNDLE_NAME)?.tools).toHaveLength(0);

    registerDisplayModeBundle(registry, router);

    expect(registry.get(DISPLAY_MODE_BUNDLE_NAME)?.tools).toHaveLength(
      DISPLAY_MODE_TOOL_DEFINITIONS.length,
    );
    expect(registry.get(DISPLAY_MODE_BUNDLE_NAME)?.tools.map((t) => t.name)).toEqual(
      DISPLAY_MODE_TOOL_DEFINITIONS.map((t) => t.name),
    );
  });

  it('registers every handler on the router', () => {
    const registry = createCanonicalRegistry();
    const router = new ToolRouter<DocumentContext>();
    registerDisplayModeBundle(registry, router);

    expect(router.size).toBe(DISPLAY_MODE_HANDLERS.length);
    for (const handler of DISPLAY_MODE_HANDLERS) expect(router.has(handler.name)).toBe(true);
  });

  it('router + registry agree on the per-tool name set (drift gate)', () => {
    const registry = createCanonicalRegistry();
    const router = new ToolRouter<DocumentContext>();
    registerDisplayModeBundle(registry, router);

    const routerNames = new Set(router.names());
    const registryNames = new Set(
      (registry.get(DISPLAY_MODE_BUNDLE_NAME)?.tools ?? []).map((t) => t.name),
    );
    expect(routerNames).toEqual(registryNames);
  });

  it('registered tool count stays within the I-9 budget (30)', () => {
    expect(DISPLAY_MODE_TOOL_DEFINITIONS.length).toBeLessThanOrEqual(30);
  });

  it('refuses double-registration on the router', () => {
    const registry = createCanonicalRegistry();
    const router = new ToolRouter<DocumentContext>();
    registerDisplayModeBundle(registry, router);
    expect(() => registerDisplayModeBundle(registry, router)).toThrow(/duplicate tool name/);
  });

  it('throws when the target registry has no display-mode bundle to merge into', () => {
    const registry = new BundleRegistry();
    const router = new ToolRouter<DocumentContext>();
    expect(() => registerDisplayModeBundle(registry, router)).toThrow(
      /unknown bundle "display-mode"/,
    );
  });

  it('declares DISPLAY_MODE_BUNDLE_NAME === "display-mode"', () => {
    expect(DISPLAY_MODE_BUNDLE_NAME).toBe('display-mode');
  });

  it('every handler declares bundle === "display-mode"', () => {
    for (const handler of DISPLAY_MODE_HANDLERS) {
      expect(handler.bundle).toBe(DISPLAY_MODE_BUNDLE_NAME);
    }
  });
});
