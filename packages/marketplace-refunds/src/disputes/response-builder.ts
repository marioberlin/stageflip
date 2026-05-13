// packages/marketplace-refunds/src/disputes/response-builder.ts
// T-545 — `buildDisputeEvidence` assembles the evidence payload the
// deployment layer (T-550) posts to Stripe's `Dispute.update`
// endpoint when responding to a chargeback. The builder is pure: it
// receives the dispute event + tenant-side context (entitlement
// history, usage metrics, optional billing details) and returns the
// `DisputeEvidence` envelope. Stripe's SDK fields map 1:1 to the
// envelope keys.
//
// Determinism perimeter: outside (server-side).

import type { DisputeEvent } from './handler.js';

/**
 * Optional tenant-side billing context. The caller may have a
 * resolved customer record (name, email, address) — when absent,
 * the corresponding evidence fields are emitted as `null`. Stripe
 * accepts `null` for any unsupplied field.
 */
export interface DisputeCustomerInfo {
  readonly customerName: string | null;
  readonly customerEmail: string | null;
  readonly billingAddress: string | null;
  readonly customerCommunication: string | null;
}

/** Usage metrics summary used to demonstrate product delivery. */
export interface DisputeUsageMetrics {
  readonly installCount: number;
  readonly activationCount: number;
  readonly clipMountCount: number;
}

/** Stripe-shaped evidence envelope. */
export interface DisputeEvidence {
  readonly customerName: string | null;
  readonly customerEmail: string | null;
  readonly billingAddress: string | null;
  /** Date the customer first received the product (ISO 8601). */
  readonly serviceDate: string;
  /** Narrative documentation describing what was delivered. */
  readonly serviceDocumentation: string;
  /** Transcript / email thread of customer communication. */
  readonly customerCommunication: string | null;
  /** Receipt narrative (charge id + amount + sku). */
  readonly receipt: string;
}

/** Options for `buildDisputeEvidence`. */
export interface BuildDisputeEvidenceOpts {
  readonly event: DisputeEvent;
  /**
   * Entitlement history rows for the disputed sku, oldest-first.
   * Strings are free-form audit lines from the entitlement store
   * (e.g. `'2026-01-01 trial-granted'`, `'2026-01-08 active'`). The
   * builder joins them into the `serviceDocumentation` narrative.
   */
  readonly entitlementHistory: readonly string[];
  readonly usageMetrics: DisputeUsageMetrics;
  readonly customerInfo?: DisputeCustomerInfo;
}

/**
 * Compose the Stripe evidence payload. The builder's job is to
 * format tenant-side context into Stripe-shaped strings; it makes
 * no decisions about whether to submit (`handleDispute` made that
 * call upstream).
 *
 * Field mapping:
 *
 *   serviceDate              ← event.createdAt (date Stripe opened
 *                              the dispute; closest proxy for
 *                              "delivery confirmed")
 *   serviceDocumentation     ← entitlementHistory joined + usage
 *                              summary
 *   receipt                  ← `chargeId / amount / sku`
 *   customer{Name,Email,...} ← customerInfo (or null)
 */
export function buildDisputeEvidence(opts: BuildDisputeEvidenceOpts): DisputeEvidence {
  const { event, entitlementHistory, usageMetrics, customerInfo } = opts;

  const historyText =
    entitlementHistory.length === 0
      ? 'No entitlement history recorded.'
      : entitlementHistory.join('\n');

  const usageText = [
    `installs=${usageMetrics.installCount}`,
    `activations=${usageMetrics.activationCount}`,
    `clipMounts=${usageMetrics.clipMountCount}`,
  ].join(', ');

  const serviceDocumentation = [
    `sku=${event.sku}`,
    `tenant=${event.tenantId}`,
    `usage: ${usageText}`,
    'entitlement-history:',
    historyText,
  ].join('\n');

  const dollars = (event.amountCents / 100).toFixed(2);
  const receipt = `charge=${event.chargeId} amount=$${dollars} sku=${event.sku}`;

  return {
    customerName: customerInfo?.customerName ?? null,
    customerEmail: customerInfo?.customerEmail ?? null,
    billingAddress: customerInfo?.billingAddress ?? null,
    serviceDate: event.createdAt,
    serviceDocumentation,
    customerCommunication: customerInfo?.customerCommunication ?? null,
    receipt,
  };
}
