// packages/engine/src/handlers/create-mutate/register.test.ts

import { describe, expect, it } from 'vitest';
import { BundleRegistry, createCanonicalRegistry } from '../../bundles/registry.js';
import { ToolRouter } from '../../router/router.js';
import type { MutationContext } from '../../router/types.js';
import {
  CREATE_MUTATE_BUNDLE_NAME,
  CREATE_MUTATE_HANDLERS,
  CREATE_MUTATE_TOOL_DEFINITIONS,
  registerCreateMutateBundle,
} from './register.js';

describe('registerCreateMutateBundle', () => {
  it('populates the create-mutate bundle with matching tool defs', () => {
    const registry = createCanonicalRegistry();
    const router = new ToolRouter<MutationContext>();
    registerCreateMutateBundle(registry, router);

    const tools = registry.get(CREATE_MUTATE_BUNDLE_NAME)?.tools ?? [];
    expect(tools.map((t) => t.name)).toEqual(CREATE_MUTATE_TOOL_DEFINITIONS.map((t) => t.name));
  });

  it('registers every handler on the router', () => {
    const registry = createCanonicalRegistry();
    const router = new ToolRouter<MutationContext>();
    registerCreateMutateBundle(registry, router);

    expect(router.size).toBe(CREATE_MUTATE_HANDLERS.length);
    for (const handler of CREATE_MUTATE_HANDLERS) {
      expect(router.has(handler.name)).toBe(true);
    }
  });

  it('router ↔ registry name sets agree (drift gate)', () => {
    const registry = createCanonicalRegistry();
    const router = new ToolRouter<MutationContext>();
    registerCreateMutateBundle(registry, router);

    const registryNames = new Set(
      (registry.get(CREATE_MUTATE_BUNDLE_NAME)?.tools ?? []).map((t) => t.name),
    );
    expect(new Set(router.names())).toEqual(registryNames);
  });

  it('every handler declares bundle === "create-mutate"', () => {
    for (const handler of CREATE_MUTATE_HANDLERS) {
      expect(handler.bundle).toBe(CREATE_MUTATE_BUNDLE_NAME);
    }
  });

  it('tool count stays within the I-9 budget (≤30)', () => {
    expect(CREATE_MUTATE_TOOL_DEFINITIONS.length).toBeLessThanOrEqual(30);
  });

  it('throws when the target registry has no create-mutate bundle to merge into', () => {
    const registry = new BundleRegistry();
    const router = new ToolRouter<MutationContext>();
    expect(() => registerCreateMutateBundle(registry, router)).toThrow(
      /unknown bundle "create-mutate"/,
    );
  });
});
