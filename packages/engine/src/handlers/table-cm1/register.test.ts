// packages/engine/src/handlers/table-cm1/register.test.ts

import { describe, expect, it } from 'vitest';
import { BundleRegistry, createCanonicalRegistry } from '../../bundles/registry.js';
import { ToolRouter } from '../../router/router.js';
import type { MutationContext } from '../../router/types.js';
import {
  TABLE_CM1_BUNDLE_NAME,
  TABLE_CM1_HANDLERS,
  TABLE_CM1_TOOL_DEFINITIONS,
  registerTableCm1Bundle,
} from './register.js';

describe('registerTableCm1Bundle', () => {
  it('populates the table-cm1 bundle with matching tool defs', () => {
    const registry = createCanonicalRegistry();
    const router = new ToolRouter<MutationContext>();
    registerTableCm1Bundle(registry, router);
    const tools = registry.get(TABLE_CM1_BUNDLE_NAME)?.tools ?? [];
    expect(tools.map((t) => t.name)).toEqual(TABLE_CM1_TOOL_DEFINITIONS.map((t) => t.name));
  });

  it('registers every handler on the router', () => {
    const registry = createCanonicalRegistry();
    const router = new ToolRouter<MutationContext>();
    registerTableCm1Bundle(registry, router);
    expect(router.size).toBe(TABLE_CM1_HANDLERS.length);
    for (const h of TABLE_CM1_HANDLERS) expect(router.has(h.name)).toBe(true);
  });

  it('router ↔ registry name sets agree (drift gate)', () => {
    const registry = createCanonicalRegistry();
    const router = new ToolRouter<MutationContext>();
    registerTableCm1Bundle(registry, router);
    const registryNames = new Set(
      (registry.get(TABLE_CM1_BUNDLE_NAME)?.tools ?? []).map((t) => t.name),
    );
    expect(new Set(router.names())).toEqual(registryNames);
  });

  it('every handler declares bundle === "table-cm1"', () => {
    for (const h of TABLE_CM1_HANDLERS) expect(h.bundle).toBe(TABLE_CM1_BUNDLE_NAME);
  });

  it('tool count stays within the I-9 budget (≤30)', () => {
    expect(TABLE_CM1_TOOL_DEFINITIONS.length).toBeLessThanOrEqual(30);
  });

  it('throws when the target registry has no table-cm1 bundle', () => {
    const registry = new BundleRegistry();
    const router = new ToolRouter<MutationContext>();
    expect(() => registerTableCm1Bundle(registry, router)).toThrow(/unknown bundle "table-cm1"/);
  });
});
