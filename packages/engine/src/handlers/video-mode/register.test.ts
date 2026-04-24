// packages/engine/src/handlers/video-mode/register.test.ts
// Drift-gate tests for registerVideoModeBundle (T-185).

import { describe, expect, it } from 'vitest';

import { BundleRegistry, createCanonicalRegistry } from '../../bundles/registry.js';
import { ToolRouter } from '../../router/router.js';
import type { DocumentContext } from '../../router/types.js';
import {
  VIDEO_MODE_BUNDLE_NAME,
  VIDEO_MODE_HANDLERS,
  VIDEO_MODE_TOOL_DEFINITIONS,
} from './handlers.js';
import { registerVideoModeBundle } from './register.js';

describe('registerVideoModeBundle', () => {
  it('populates the video-mode bundle on the registry with matching tool defs', () => {
    const registry = createCanonicalRegistry();
    const router = new ToolRouter<DocumentContext>();
    expect(registry.get(VIDEO_MODE_BUNDLE_NAME)?.tools).toHaveLength(0);

    registerVideoModeBundle(registry, router);

    expect(registry.get(VIDEO_MODE_BUNDLE_NAME)?.tools).toHaveLength(
      VIDEO_MODE_TOOL_DEFINITIONS.length,
    );
    expect(registry.get(VIDEO_MODE_BUNDLE_NAME)?.tools.map((t) => t.name)).toEqual(
      VIDEO_MODE_TOOL_DEFINITIONS.map((t) => t.name),
    );
  });

  it('registers every handler on the router', () => {
    const registry = createCanonicalRegistry();
    const router = new ToolRouter<DocumentContext>();
    registerVideoModeBundle(registry, router);

    expect(router.size).toBe(VIDEO_MODE_HANDLERS.length);
    for (const handler of VIDEO_MODE_HANDLERS) expect(router.has(handler.name)).toBe(true);
  });

  it('router + registry agree on the per-tool name set (drift gate)', () => {
    const registry = createCanonicalRegistry();
    const router = new ToolRouter<DocumentContext>();
    registerVideoModeBundle(registry, router);

    const routerNames = new Set(router.names());
    const registryNames = new Set(
      (registry.get(VIDEO_MODE_BUNDLE_NAME)?.tools ?? []).map((t) => t.name),
    );
    expect(routerNames).toEqual(registryNames);
  });

  it('registered tool count stays within the I-9 budget (30)', () => {
    expect(VIDEO_MODE_TOOL_DEFINITIONS.length).toBeLessThanOrEqual(30);
  });

  it('refuses double-registration on the router', () => {
    const registry = createCanonicalRegistry();
    const router = new ToolRouter<DocumentContext>();
    registerVideoModeBundle(registry, router);
    expect(() => registerVideoModeBundle(registry, router)).toThrow(/duplicate tool name/);
  });

  it('throws when the target registry has no video-mode bundle to merge into', () => {
    const registry = new BundleRegistry();
    const router = new ToolRouter<DocumentContext>();
    expect(() => registerVideoModeBundle(registry, router)).toThrow(/unknown bundle "video-mode"/);
  });

  it('declares VIDEO_MODE_BUNDLE_NAME === "video-mode"', () => {
    expect(VIDEO_MODE_BUNDLE_NAME).toBe('video-mode');
  });

  it('every handler declares bundle === "video-mode"', () => {
    for (const handler of VIDEO_MODE_HANDLERS) {
      expect(handler.bundle).toBe(VIDEO_MODE_BUNDLE_NAME);
    }
  });
});
