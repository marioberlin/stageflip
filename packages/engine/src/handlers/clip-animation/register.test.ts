// packages/engine/src/handlers/clip-animation/register.test.ts

import { describe, expect, it } from 'vitest';
import { BundleRegistry, createCanonicalRegistry } from '../../bundles/registry.js';
import { ToolRouter } from '../../router/router.js';
import type { MutationContext } from '../../router/types.js';
import {
  CLIP_ANIMATION_BUNDLE_NAME,
  CLIP_ANIMATION_HANDLERS,
  CLIP_ANIMATION_TOOL_DEFINITIONS,
  registerClipAnimationBundle,
} from './register.js';

describe('registerClipAnimationBundle', () => {
  it('populates the clip-animation bundle with matching tool defs', () => {
    const registry = createCanonicalRegistry();
    const router = new ToolRouter<MutationContext>();
    registerClipAnimationBundle(registry, router);
    const tools = registry.get(CLIP_ANIMATION_BUNDLE_NAME)?.tools ?? [];
    expect(tools.map((t) => t.name)).toEqual(CLIP_ANIMATION_TOOL_DEFINITIONS.map((t) => t.name));
  });

  it('registers every handler on the router', () => {
    const registry = createCanonicalRegistry();
    const router = new ToolRouter<MutationContext>();
    registerClipAnimationBundle(registry, router);
    expect(router.size).toBe(CLIP_ANIMATION_HANDLERS.length);
    for (const h of CLIP_ANIMATION_HANDLERS) expect(router.has(h.name)).toBe(true);
  });

  it('router ↔ registry name sets agree (drift gate)', () => {
    const registry = createCanonicalRegistry();
    const router = new ToolRouter<MutationContext>();
    registerClipAnimationBundle(registry, router);
    const registryNames = new Set(
      (registry.get(CLIP_ANIMATION_BUNDLE_NAME)?.tools ?? []).map((t) => t.name),
    );
    expect(new Set(router.names())).toEqual(registryNames);
  });

  it('every handler declares bundle === "clip-animation"', () => {
    for (const h of CLIP_ANIMATION_HANDLERS) expect(h.bundle).toBe(CLIP_ANIMATION_BUNDLE_NAME);
  });

  it('tool count stays within the I-9 budget (≤30)', () => {
    expect(CLIP_ANIMATION_TOOL_DEFINITIONS.length).toBeLessThanOrEqual(30);
  });

  it('throws when the target registry has no clip-animation bundle', () => {
    const registry = new BundleRegistry();
    const router = new ToolRouter<MutationContext>();
    expect(() => registerClipAnimationBundle(registry, router)).toThrow(
      /unknown bundle "clip-animation"/,
    );
  });
});
