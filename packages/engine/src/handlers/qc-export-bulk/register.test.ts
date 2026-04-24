// packages/engine/src/handlers/qc-export-bulk/register.test.ts

import { describe, expect, it } from 'vitest';
import { BundleRegistry, createCanonicalRegistry } from '../../bundles/registry.js';
import { ToolRouter } from '../../router/router.js';
import type { MutationContext } from '../../router/types.js';
import {
  QC_EXPORT_BULK_BUNDLE_NAME,
  QC_EXPORT_BULK_HANDLERS,
  QC_EXPORT_BULK_TOOL_DEFINITIONS,
  registerQcExportBulkBundle,
} from './register.js';

describe('registerQcExportBulkBundle', () => {
  it('populates the qc-export-bulk bundle with matching tool defs', () => {
    const registry = createCanonicalRegistry();
    const router = new ToolRouter<MutationContext>();
    registerQcExportBulkBundle(registry, router);
    const tools = registry.get(QC_EXPORT_BULK_BUNDLE_NAME)?.tools ?? [];
    expect(tools.map((t) => t.name)).toEqual(QC_EXPORT_BULK_TOOL_DEFINITIONS.map((t) => t.name));
  });

  it('registers every handler on the router', () => {
    const registry = createCanonicalRegistry();
    const router = new ToolRouter<MutationContext>();
    registerQcExportBulkBundle(registry, router);
    expect(router.size).toBe(QC_EXPORT_BULK_HANDLERS.length);
    for (const h of QC_EXPORT_BULK_HANDLERS) expect(router.has(h.name)).toBe(true);
  });

  it('router ↔ registry name sets agree (drift gate)', () => {
    const registry = createCanonicalRegistry();
    const router = new ToolRouter<MutationContext>();
    registerQcExportBulkBundle(registry, router);
    const registryNames = new Set(
      (registry.get(QC_EXPORT_BULK_BUNDLE_NAME)?.tools ?? []).map((t) => t.name),
    );
    expect(new Set(router.names())).toEqual(registryNames);
  });

  it('every handler declares bundle === "qc-export-bulk"', () => {
    for (const h of QC_EXPORT_BULK_HANDLERS) expect(h.bundle).toBe(QC_EXPORT_BULK_BUNDLE_NAME);
  });

  it('tool count stays within the I-9 budget (≤30)', () => {
    expect(QC_EXPORT_BULK_TOOL_DEFINITIONS.length).toBeLessThanOrEqual(30);
  });

  it('throws when the target registry has no qc-export-bulk bundle', () => {
    const registry = new BundleRegistry();
    const router = new ToolRouter<MutationContext>();
    expect(() => registerQcExportBulkBundle(registry, router)).toThrow(
      /unknown bundle "qc-export-bulk"/,
    );
  });
});
