// packages/engine/src/handlers/validate/register.test.ts

import { describe, expect, it } from 'vitest';
import { BundleRegistry, createCanonicalRegistry } from '../../bundles/registry.js';
import { ToolRouter } from '../../router/router.js';
import type { DocumentContext } from '../../router/types.js';
import {
  VALIDATE_BUNDLE_NAME,
  VALIDATE_HANDLERS,
  VALIDATE_TOOL_DEFINITIONS,
  registerValidateBundle,
} from './register.js';

describe('registerValidateBundle', () => {
  it('populates the validate bundle with matching tool defs', () => {
    const registry = createCanonicalRegistry();
    const router = new ToolRouter<DocumentContext>();
    registerValidateBundle(registry, router);
    const tools = registry.get(VALIDATE_BUNDLE_NAME)?.tools ?? [];
    expect(tools.map((t) => t.name)).toEqual(VALIDATE_TOOL_DEFINITIONS.map((t) => t.name));
  });

  it('registers every handler on the router', () => {
    const registry = createCanonicalRegistry();
    const router = new ToolRouter<DocumentContext>();
    registerValidateBundle(registry, router);
    expect(router.size).toBe(VALIDATE_HANDLERS.length);
    for (const h of VALIDATE_HANDLERS) expect(router.has(h.name)).toBe(true);
  });

  it('router ↔ registry name sets agree', () => {
    const registry = createCanonicalRegistry();
    const router = new ToolRouter<DocumentContext>();
    registerValidateBundle(registry, router);
    const registryNames = new Set(
      (registry.get(VALIDATE_BUNDLE_NAME)?.tools ?? []).map((t) => t.name),
    );
    expect(new Set(router.names())).toEqual(registryNames);
  });

  it('every handler declares bundle === "validate"', () => {
    for (const h of VALIDATE_HANDLERS) expect(h.bundle).toBe(VALIDATE_BUNDLE_NAME);
  });

  it('tool count ≤ 30 (I-9)', () => {
    expect(VALIDATE_TOOL_DEFINITIONS.length).toBeLessThanOrEqual(30);
  });

  it('throws when the target registry has no validate bundle', () => {
    const registry = new BundleRegistry();
    const router = new ToolRouter<DocumentContext>();
    expect(() => registerValidateBundle(registry, router)).toThrow(/unknown bundle "validate"/);
  });
});
