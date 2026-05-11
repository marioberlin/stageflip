// packages/storage/src/tenant-settings.ts
// TenantSettings — Zod schema + types per T-411 D-T411-2 / T-411a D-T411a-2.
// Single-row-per-tenant configuration governing tenant-level frontier
// enablement (the `features.interactive` 3-state toggle from
// docs/decisions/ADR-005-frontier-clip-catalogue.md §D3).
//
// v1 surface is deliberately minimal: a tenant id, a `features` bag with one
// enum, and audit attribution (who-last-changed, when). Future widening
// (audit-log retention; per-permission-kind grants; SSO config) is non-breaking
// — additional optional fields on `features`, sibling fields on the outer
// object. See docs/tasks/T-411.md "Out of scope".

import { z } from 'zod';

/**
 * T-443 — Per-tenant AI-generation budget. Single-currency per tenant;
 * the in-memory `TenantCostTrackerStore` does NOT cross-convert.
 * `currency` is ISO-4217 alpha-3 (e.g., `'USD'`, `'EUR'`); regex enforces.
 * `periodEnd` is the ISO-datetime upper bound of the current budget
 * period (exclusive — see `TenantCostTrackerStore.getPeriodTotal`).
 * `monthlyAmount` may be `0` (config-exhausted tenant) but never
 * negative.
 */
export const aiBudgetSchema = z
  .object({
    monthlyAmount: z.number().nonnegative().finite(),
    currency: z.string().regex(/^[A-Z]{3}$/, 'currency must be ISO-4217 alpha-3'),
    periodEnd: z.string().datetime(),
  })
  .strict();

export type AiBudget = z.infer<typeof aiBudgetSchema>;

/**
 * Per-tenant frontier-enablement settings.
 *
 * `features.interactive` posture:
 *   - `'disabled'`  — interactive runtime tier is denied for this tenant
 *                     (default-deny per T-411 D-T411-5; the storage layer
 *                     returns null for absent rows and the API layer
 *                     materialises this default).
 *   - `'preview'`   — html / browser-live-preview targets may live-mount;
 *                     on-device-display targets stay on staticFallback.
 *   - `'ga'`        — all targets may live-mount.
 *
 * `aiBudget` (T-443) is optional — absent means "no enforced budget";
 * `costBudget` envelopes on tool results are omitted in that case.
 *
 * Both the outer object and the nested `features` object are `.strict()` so
 * unknown keys at either level are rejected at parse time.
 */
export const tenantSettingsSchema = z
  .object({
    tenantId: z.string().min(1),
    features: z
      .object({
        interactive: z.enum(['disabled', 'preview', 'ga']),
      })
      .strict(),
    aiBudget: aiBudgetSchema.optional(),
    updatedAt: z.string().datetime(),
    updatedBy: z.string().min(1),
  })
  .strict();

export type TenantSettings = z.infer<typeof tenantSettingsSchema>;
