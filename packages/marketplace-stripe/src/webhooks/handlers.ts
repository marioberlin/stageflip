// packages/marketplace-stripe/src/webhooks/handlers.ts
// T-537 — Pure event-to-mutation translation. Given a parsed
// `WebhookEvent` + the configured `SkuMap`, `handleWebhookEvent`
// returns the `EntitlementMutation` the marketplace registry should
// apply, or `null` when the event is irrelevant / malformed.
//
// This module is pure — no I/O, no entitlement-store mutation. The
// concrete persistence happens upstream in T-543 (`TenantEntitlementsStore`
// writer); T-537 only computes WHAT to write.
//
// Determinism perimeter: outside (server-side).

import type { EntitlementStatus } from '../entitlements/transitions.js';
import type { SkuMap } from '../pricing/sku-map.js';

/**
 * A parsed Stripe webhook event. Mirrors the top-level shape of the
 * production envelope; `data.object` is the resource that triggered
 * the event (a session, subscription, or invoice).
 */
export interface WebhookEvent {
  readonly id: string;
  readonly type: string;
  readonly data: { readonly object: unknown };
}

/**
 * Mutation the registry applies to a single `TenantEntitlement` row.
 * `tenantId` resolves from event metadata (every checkout session
 * carries `{ tenantId, sku }` per ADR-013 §D4); `sku` resolves from
 * the SKU map (priceId lookup).
 */
export interface EntitlementMutation {
  readonly sku: string;
  readonly tenantId: string;
  readonly newStatus: EntitlementStatus;
  /** ISO-8601 expiry for the next billing cycle, when known. */
  readonly expiresAt?: string;
}

interface CheckoutSessionObject {
  readonly mode?: string;
  readonly metadata?: Record<string, string> | null;
  readonly subscription?: string | null;
  readonly customer?: string | null;
}

interface SubscriptionObject {
  readonly id?: string;
  readonly status?: string;
  readonly customer?: string | null;
  readonly metadata?: Record<string, string> | null;
  readonly current_period_end?: number | null;
  readonly items?: {
    readonly data?: readonly {
      readonly price?: { readonly id?: string | null } | null;
    }[];
  } | null;
}

interface InvoiceObject {
  readonly metadata?: Record<string, string> | null;
  readonly subscription?: string | null;
  readonly customer?: string | null;
  readonly lines?: {
    readonly data?: readonly {
      readonly price?: { readonly id?: string | null } | null;
      readonly metadata?: Record<string, string> | null;
    }[];
  } | null;
  readonly attempt_count?: number;
  readonly next_payment_attempt?: number | null;
}

/**
 * Translate a single Stripe webhook event into the corresponding
 * `EntitlementMutation`, or return `null` when:
 *   - the event type is one we don't handle,
 *   - the event payload is missing required fields,
 *   - the priceId / sku is not in `skuMap` (third-party pack),
 *   - the metadata is missing `tenantId`.
 *
 * The function NEVER throws — malformed input yields `null`.
 */
export function handleWebhookEvent(
  event: WebhookEvent,
  skuMap: SkuMap,
): EntitlementMutation | null {
  if (event === null || typeof event !== 'object') {
    return null;
  }
  if (typeof event.type !== 'string' || typeof event.id !== 'string') {
    return null;
  }
  const obj = event.data?.object;
  if (obj === null || typeof obj !== 'object') {
    return null;
  }
  switch (event.type) {
    case 'checkout.session.completed':
      return handleCheckoutCompleted(obj as CheckoutSessionObject, skuMap);
    case 'customer.subscription.updated':
      return handleSubscriptionUpdated(obj as SubscriptionObject, skuMap);
    case 'customer.subscription.deleted':
      return handleSubscriptionDeleted(obj as SubscriptionObject, skuMap);
    case 'invoice.payment_failed':
      return handleInvoicePaymentFailed(obj as InvoiceObject, skuMap);
    default:
      return null;
  }
}

function handleCheckoutCompleted(
  session: CheckoutSessionObject,
  _skuMap: SkuMap,
): EntitlementMutation | null {
  const metadata = session.metadata ?? null;
  if (metadata === null) {
    return null;
  }
  const tenantId = metadata.tenantId;
  const sku = metadata.sku;
  if (typeof tenantId !== 'string' || tenantId.length === 0) {
    return null;
  }
  if (typeof sku !== 'string' || sku.length === 0) {
    return null;
  }
  return { sku, tenantId, newStatus: 'active' };
}

function handleSubscriptionUpdated(
  sub: SubscriptionObject,
  skuMap: SkuMap,
): EntitlementMutation | null {
  const resolved = resolveSkuFromSubscription(sub, skuMap);
  if (resolved === null) {
    return null;
  }
  const status = sub.status ?? null;
  if (status === null) {
    return null;
  }
  const expiresAt = formatExpiresAt(sub.current_period_end);
  // Stripe subscription status -> entitlement intent.
  switch (status) {
    case 'active':
    case 'trialing':
      return resolved.tenantId === null
        ? null
        : expiresAt === null
          ? { sku: resolved.sku, tenantId: resolved.tenantId, newStatus: 'active' }
          : {
              sku: resolved.sku,
              tenantId: resolved.tenantId,
              newStatus: 'active',
              expiresAt,
            };
    case 'past_due':
    case 'unpaid':
      return resolved.tenantId === null
        ? null
        : { sku: resolved.sku, tenantId: resolved.tenantId, newStatus: 'lapsed' };
    case 'canceled':
    case 'incomplete_expired':
      return resolved.tenantId === null
        ? null
        : { sku: resolved.sku, tenantId: resolved.tenantId, newStatus: 'revoked' };
    case 'incomplete':
      // Checkout completed but first payment hasn't settled. Keep
      // pending — no mutation needed (registry default is pending).
      return null;
    default:
      return null;
  }
}

function handleSubscriptionDeleted(
  sub: SubscriptionObject,
  skuMap: SkuMap,
): EntitlementMutation | null {
  const resolved = resolveSkuFromSubscription(sub, skuMap);
  if (resolved === null || resolved.tenantId === null) {
    return null;
  }
  return { sku: resolved.sku, tenantId: resolved.tenantId, newStatus: 'revoked' };
}

function handleInvoicePaymentFailed(
  invoice: InvoiceObject,
  skuMap: SkuMap,
): EntitlementMutation | null {
  // Stripe retries the dunning sequence; we only flip to `lapsed` on
  // the FINAL failure (no `next_payment_attempt`). Earlier failures
  // are observability events handled by `customer.subscription.updated`
  // (which transitions Stripe-side status to `past_due` ⇒ lapsed).
  if (invoice.next_payment_attempt !== null && invoice.next_payment_attempt !== undefined) {
    return null;
  }
  const tenantId = invoice.metadata?.tenantId ?? null;
  if (typeof tenantId !== 'string' || tenantId.length === 0) {
    return null;
  }
  // Resolve sku via lines[].price.id or metadata.sku.
  const lineSku =
    invoice.lines?.data?.[0]?.metadata?.sku ??
    (invoice.lines?.data?.[0]?.price?.id
      ? (skuMap.lookupByPriceId(invoice.lines.data[0].price.id)?.sku ?? null)
      : null) ??
    invoice.metadata?.sku ??
    null;
  if (typeof lineSku !== 'string' || lineSku.length === 0) {
    return null;
  }
  return { sku: lineSku, tenantId, newStatus: 'lapsed' };
}

interface ResolvedSku {
  readonly sku: string;
  readonly tenantId: string | null;
}

function resolveSkuFromSubscription(sub: SubscriptionObject, skuMap: SkuMap): ResolvedSku | null {
  const tenantId = sub.metadata?.tenantId ?? null;
  // Primary: subscription metadata.sku
  const metaSku = sub.metadata?.sku ?? null;
  if (typeof metaSku === 'string' && metaSku.length > 0) {
    return { sku: metaSku, tenantId: typeof tenantId === 'string' ? tenantId : null };
  }
  // Fallback: priceId reverse-lookup
  const firstPriceId = sub.items?.data?.[0]?.price?.id ?? null;
  if (typeof firstPriceId === 'string' && firstPriceId.length > 0) {
    const m = skuMap.lookupByPriceId(firstPriceId);
    if (m !== null) {
      return { sku: m.sku, tenantId: typeof tenantId === 'string' ? tenantId : null };
    }
  }
  return null;
}

function formatExpiresAt(unixSeconds: number | null | undefined): string | null {
  if (unixSeconds === null || unixSeconds === undefined) {
    return null;
  }
  if (!Number.isFinite(unixSeconds) || unixSeconds <= 0) {
    return null;
  }
  return new Date(unixSeconds * 1000).toISOString();
}
