// packages/marketplace-stripe/src/handler.ts
// T-537 — `composeWebhookHandler(deps)` assembles a single end-to-end
// webhook entry-point: verify signature → dedup via idempotency store
// → translate event into `EntitlementMutation` → return.
//
// The handler is INTENTIONALLY stateless w.r.t. entitlements — the
// caller (T-543 marketplace tier-system writer) is responsible for
// applying the returned mutation to the durable
// `TenantEntitlementsStore`. T-537 only computes the mutation.
//
// Determinism perimeter: outside (server-side).

import type { SkuMap } from './pricing/sku-map.js';
import type { EntitlementMutation, WebhookEvent } from './webhooks/handlers.js';
import { handleWebhookEvent } from './webhooks/handlers.js';
import type { IdempotencyStore } from './webhooks/idempotency.js';
import { verifyStripeSignature } from './webhooks/signature.js';

/** Dependencies injected at server boot. */
export interface StripeWebhookDeps {
  readonly skuMap: SkuMap;
  readonly idempotency: IdempotencyStore;
  readonly webhookSecret: string;
}

/** Minimal request shape — body is the raw JSON string Stripe POSTed. */
export interface WebhookRequest {
  readonly headers: Record<string, string>;
  readonly body: string;
}

/** Result of a single webhook invocation. */
export interface WebhookResult {
  readonly status: number;
  /** Present only when status === 200 AND the event yielded a mutation. */
  readonly mutation?: EntitlementMutation;
  /** Set on non-2xx for callers that surface to observability. */
  readonly reason?: string;
}

/** Composed webhook handler signature. */
export type WebhookHandler = (req: WebhookRequest) => Promise<WebhookResult>;

const STRIPE_SIGNATURE_HEADER = 'stripe-signature';

/**
 * Build a single `WebhookHandler` that:
 *   1. Reads `stripe-signature` from headers (case-insensitive) and
 *      verifies via {@link verifyStripeSignature}. Bad/missing sig → 400.
 *   2. Parses the JSON body. Unparseable → 400.
 *   3. Short-circuits on duplicate event id (`seen` returns true) →
 *      200 with no mutation (Stripe stops retrying).
 *   4. Marks the event id seen.
 *   5. Translates via {@link handleWebhookEvent}; returns 200 with
 *      mutation (or no mutation, for unknown / unhandled event types).
 *
 * Exceptions during translation are caught and surfaced as 500 — the
 * idempotency mark already happened, so Stripe's retry won't re-process.
 * (Tradeoff documented; T-550 may add a compensating "unmark on failure"
 * path if this turns out to bite.)
 */
export function composeWebhookHandler(deps: StripeWebhookDeps): WebhookHandler {
  return async (req) => {
    const sigHeader = req.headers[STRIPE_SIGNATURE_HEADER] ?? req.headers['Stripe-Signature'] ?? '';
    if (typeof sigHeader !== 'string' || sigHeader.length === 0) {
      return { status: 400, reason: 'missing-stripe-signature' };
    }
    if (!verifyStripeSignature(req.body, sigHeader, deps.webhookSecret)) {
      return { status: 400, reason: 'invalid-stripe-signature' };
    }
    let event: WebhookEvent;
    try {
      const parsed: unknown = JSON.parse(req.body);
      if (parsed === null || typeof parsed !== 'object') {
        return { status: 400, reason: 'body-not-object' };
      }
      const candidate = parsed as { id?: unknown; type?: unknown; data?: unknown };
      if (typeof candidate.id !== 'string' || typeof candidate.type !== 'string') {
        return { status: 400, reason: 'body-missing-fields' };
      }
      event = parsed as WebhookEvent;
    } catch {
      return { status: 400, reason: 'body-not-json' };
    }
    if (await deps.idempotency.seen(event.id)) {
      // Already processed — ack with 200 so Stripe stops retrying.
      return { status: 200 };
    }
    await deps.idempotency.markSeen(event.id);
    try {
      const mutation = handleWebhookEvent(event, deps.skuMap);
      if (mutation === null) {
        return { status: 200 };
      }
      return { status: 200, mutation };
    } catch (err) {
      return { status: 500, reason: `handler-threw: ${(err as Error).message}` };
    }
  };
}
