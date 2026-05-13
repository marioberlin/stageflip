// packages/marketplace-conversion/src/planner/conversion-planner.ts
// T-544 — `planConversion` computes the recommended action +
// expected terminal entitlement status for a single
// `ConversionEvent`. The planner is pure: it knows nothing about
// Stripe, the entitlement store, or wall-clock time. Callers feed
// the resolved entitlement status + Stripe identifiers in; the
// planner returns the Stripe-API-call shape the deployment layer
// (T-550) executes.
//
// Determinism perimeter: outside (server-side).

import { type ChurnRecoveryStrategy, DEFAULT_CHURN_STRATEGY } from '../churn/strategy.js';
import type { ConversionEvent } from '../events/conversion-event.js';

/**
 * Entitlement-status union the planner consumes. Mirrors
 * `@stageflip/marketplace-stripe` + `@stageflip/pack-loader` /
 * ADR-013 §D4. `null` means the tenant has no entitlement row for
 * the sku at all (fresh upgrade path).
 */
export type ConversionEntitlementStatus = 'active' | 'lapsed' | 'revoked' | 'pending' | 'trial';

/** Inputs to a single `planConversion` invocation. */
export interface ConversionPlannerInput {
  readonly event: ConversionEvent;
  readonly currentEntitlementStatus: ConversionEntitlementStatus | null;
  readonly stripeCustomerId: string | null;
  readonly stripePriceId: string;
  /**
   * Optional retry attempt count for `'lapsed-recovered'` planning —
   * used as the `retryCount` argument to the strategy's
   * `nextBackoff`. Defaults to zero (first attempt). Ignored for
   * other event kinds.
   */
  readonly retryCount?: number;
}

/**
 * Recommended next action. The deployment layer (T-550) maps the
 * variants to concrete Stripe-API + entitlement-store calls.
 */
export type ConversionAction =
  | {
      readonly kind: 'create-checkout-session';
      readonly priceId: string;
      readonly customerId: string | null;
      readonly metadata: Record<string, string>;
    }
  | { readonly kind: 'noop'; readonly reason: string }
  | { readonly kind: 'churn-recovery-retry'; readonly backoffMs: number };

/**
 * Planner output. `expectedTerminalStatus` is what the entitlement
 * SHOULD be once the action runs to completion — the deployment
 * layer compares the observed-after-action status against this and
 * surfaces drift to the T-541 telemetry dashboard.
 */
export interface ConversionPlannerOutput {
  readonly action: ConversionAction;
  readonly expectedTerminalStatus: 'active' | 'lapsed' | 'revoked' | 'pending';
}

/**
 * Plan the conversion flow.
 *
 * Decision table (see also ADR-013 §D4 + §D10):
 *
 *   event=trial-to-paid + status=trial             → create-checkout-session, expect active
 *   event=trial-to-paid + status=active            → noop ("already-active")
 *   event=trial-to-paid + status=lapsed/revoked    → create-checkout-session, expect active
 *   event=trial-to-paid + status=pending           → noop ("pending-stripe")
 *   event=trial-to-paid + status=null              → create-checkout-session, expect active
 *
 *   event=trial-expired + status=active            → noop ("already-converted")
 *   event=trial-expired + status=trial             → create-checkout-session, expect active
 *   event=trial-expired + status=null              → create-checkout-session, expect active
 *   event=trial-expired + status=lapsed/revoked    → create-checkout-session, expect active
 *   event=trial-expired + status=pending           → noop ("pending-stripe")
 *
 *   event=lapsed-recovered + status=active         → noop ("already-active")
 *   event=lapsed-recovered + status=lapsed         → churn-recovery-retry (backoff)
 *   event=lapsed-recovered + status=revoked        → churn-recovery-retry until cap, then noop
 *   event=lapsed-recovered + status=pending        → noop ("pending-stripe")
 *   event=lapsed-recovered + status=trial          → noop ("trial-sibling")
 *   event=lapsed-recovered + status=null           → noop ("no-entitlement")
 */
export function planConversion(
  input: ConversionPlannerInput,
  strategy: ChurnRecoveryStrategy = DEFAULT_CHURN_STRATEGY,
): ConversionPlannerOutput {
  const { event, currentEntitlementStatus, stripeCustomerId, stripePriceId } = input;

  switch (event.kind) {
    case 'trial-to-paid':
    case 'trial-expired':
      return planUpgrade(event, currentEntitlementStatus, stripeCustomerId, stripePriceId);
    case 'lapsed-recovered':
      return planLapsedRecovered(input, strategy);
  }
}

function planUpgrade(
  event: ConversionEvent,
  status: ConversionEntitlementStatus | null,
  customerId: string | null,
  priceId: string,
): ConversionPlannerOutput {
  if (status === 'active') {
    return {
      action: {
        kind: 'noop',
        reason: event.kind === 'trial-to-paid' ? 'already-active' : 'already-converted',
      },
      expectedTerminalStatus: 'active',
    };
  }

  if (status === 'pending') {
    return {
      action: { kind: 'noop', reason: 'pending-stripe' },
      expectedTerminalStatus: 'pending',
    };
  }

  // trial / lapsed / revoked / null → fresh checkout session.
  return {
    action: {
      kind: 'create-checkout-session',
      priceId,
      customerId,
      metadata: {
        ...event.metadata,
        conversionEventKind: event.kind,
        tenantId: event.tenantId,
        sku: event.sku,
      },
    },
    expectedTerminalStatus: 'active',
  };
}

function planLapsedRecovered(
  input: ConversionPlannerInput,
  strategy: ChurnRecoveryStrategy,
): ConversionPlannerOutput {
  const { currentEntitlementStatus, retryCount } = input;

  if (currentEntitlementStatus === 'active') {
    return {
      action: { kind: 'noop', reason: 'already-active' },
      expectedTerminalStatus: 'active',
    };
  }

  if (currentEntitlementStatus === 'pending') {
    return {
      action: { kind: 'noop', reason: 'pending-stripe' },
      expectedTerminalStatus: 'pending',
    };
  }

  if (currentEntitlementStatus === 'trial') {
    return {
      action: { kind: 'noop', reason: 'trial-sibling' },
      expectedTerminalStatus: 'active',
    };
  }

  if (currentEntitlementStatus === null) {
    return {
      action: { kind: 'noop', reason: 'no-entitlement' },
      expectedTerminalStatus: 'revoked',
    };
  }

  // currentEntitlementStatus is 'lapsed' or 'revoked' — drive the
  // dunning retry. Stop after maxRetries.
  const attempt = retryCount ?? 0;
  if (attempt >= strategy.maxRetries) {
    return {
      action: { kind: 'noop', reason: 'churn-final' },
      expectedTerminalStatus: currentEntitlementStatus === 'revoked' ? 'revoked' : 'lapsed',
    };
  }

  return {
    action: {
      kind: 'churn-recovery-retry',
      backoffMs: strategy.nextBackoff(attempt),
    },
    expectedTerminalStatus: 'active',
  };
}
