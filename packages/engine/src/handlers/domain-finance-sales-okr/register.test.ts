// packages/engine/src/handlers/domain-finance-sales-okr/register.test.ts

import { describe, expect, it } from 'vitest';
import { BundleRegistry, createCanonicalRegistry } from '../../bundles/registry.js';
import { ToolRouter } from '../../router/router.js';
import type { MutationContext } from '../../router/types.js';
import {
  DOMAIN_BUNDLE_NAME,
  DOMAIN_HANDLERS,
  DOMAIN_TOOL_DEFINITIONS,
  registerDomainBundle,
} from './register.js';

describe('registerDomainBundle', () => {
  it('populates the bundle with matching tool defs', () => {
    const registry = createCanonicalRegistry();
    const router = new ToolRouter<MutationContext>();
    registerDomainBundle(registry, router);
    const tools = registry.get(DOMAIN_BUNDLE_NAME)?.tools ?? [];
    expect(tools.map((t) => t.name)).toEqual(DOMAIN_TOOL_DEFINITIONS.map((t) => t.name));
  });

  it('registers every handler on the router', () => {
    const registry = createCanonicalRegistry();
    const router = new ToolRouter<MutationContext>();
    registerDomainBundle(registry, router);
    expect(router.size).toBe(DOMAIN_HANDLERS.length);
    for (const h of DOMAIN_HANDLERS) expect(router.has(h.name)).toBe(true);
  });

  it('router ↔ registry name sets agree (drift gate)', () => {
    const registry = createCanonicalRegistry();
    const router = new ToolRouter<MutationContext>();
    registerDomainBundle(registry, router);
    const registryNames = new Set(
      (registry.get(DOMAIN_BUNDLE_NAME)?.tools ?? []).map((t) => t.name),
    );
    expect(new Set(router.names())).toEqual(registryNames);
  });

  it('every handler declares bundle === "domain-finance-sales-okr"', () => {
    for (const h of DOMAIN_HANDLERS) expect(h.bundle).toBe(DOMAIN_BUNDLE_NAME);
  });

  it('tool count stays within the I-9 budget (≤30)', () => {
    expect(DOMAIN_TOOL_DEFINITIONS.length).toBeLessThanOrEqual(30);
  });

  it('ships exactly 27 tools (9 per sub-domain)', () => {
    expect(DOMAIN_TOOL_DEFINITIONS.length).toBe(27);
    expect(DOMAIN_HANDLERS.length).toBe(27);
  });

  it('throws when the target registry has no bundle', () => {
    const registry = new BundleRegistry();
    const router = new ToolRouter<MutationContext>();
    expect(() => registerDomainBundle(registry, router)).toThrow(
      /unknown bundle "domain-finance-sales-okr"/,
    );
  });
});
