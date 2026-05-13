// packages/marketplace-conversion/src/events/conversion-event.ts
// T-544 — `ConversionEvent` discriminated-union types per ADR-013
// §D4 / §D10. Three triggers drive the conversion library:
//
//   'trial-to-paid'   — tenant opts in mid-trial (before expiresAt)
//   'trial-expired'   — trial entitlement past expiresAt with no
//                       intervening paid subscription
//   'lapsed-recovered' — lapsed paid entitlement returns to active
//                        (payment retry / dunning success)
//
// The shape is intentionally minimal — the planner adds context
// (currentEntitlementStatus, stripeCustomerId, stripePriceId) at
// plan-time so the event itself stays cheap to serialize for the
// telemetry dashboard (T-541).
//
// Determinism perimeter: outside (server-side).

/**
 * Conversion-trigger discriminator. Aligns with the entitlement
 * lifecycle in ADR-013 §D4: trial-to-paid + trial-expired branch
 * off the `'trial'` status; lapsed-recovered branches off
 * `'lapsed' → 'active'` via `subscription-renewed` intent
 * (T-537 transitions.ts).
 */
export type ConversionEventKind = 'trial-to-paid' | 'trial-expired' | 'lapsed-recovered';

/**
 * A single conversion-trigger event. Emitted by:
 *
 * - The trial-policy evaluator (T-505 `evaluateTrialPolicy`) when
 *   `'trial-expired'` is observed.
 * - The marketplace UI when a tenant clicks "Upgrade now" mid-trial
 *   (`'trial-to-paid'`).
 * - The Stripe webhook layer (T-537) when a `subscription-renewed`
 *   intent flips a lapsed entitlement back to active
 *   (`'lapsed-recovered'`).
 *
 * Consumed by `planConversion` + `ConversionMetricsTracker`.
 */
export interface ConversionEvent {
  readonly kind: ConversionEventKind;
  readonly tenantId: string;
  readonly sku: string;
  /** ISO 8601 timestamp at which the event was observed. */
  readonly at: string;
  /**
   * Free-form key/value metadata threaded through to the Stripe
   * checkout-session creation call + the metrics tracker. The
   * planner does not interpret the contents.
   */
  readonly metadata: Record<string, string>;
}

/**
 * Type-guard for narrowing a `ConversionEvent` to a specific
 * `kind`. Provided so consumers can switch on the discriminator
 * without re-typing the union check.
 */
export function isConversionEventKind<K extends ConversionEventKind>(
  event: ConversionEvent,
  kind: K,
): event is ConversionEvent & { readonly kind: K } {
  return event.kind === kind;
}
