// packages/pack-trial/src/state.ts
// T-505 — Trial-policy state machine. Maps a `TenantEntitlement`-shaped
// input + the current epoch millis to one of three states:
//   'none'           — no entitlement, or not a trial entitlement
//   'trial-active'   — trial entitlement currently valid
//   'trial-expired' — trial entitlement past its expiresAt
//
// The function is pure: same input → same output. It accepts a
// structural subset of `TenantEntitlement` so callers don't have to
// import the loader's concrete type just to evaluate trial state.

/**
 * Three-state trial policy result. Consumed by the engine's clip-mount
 * gate, the loader's install-time gate, and the renderer-core
 * watermark integration (downstream of T-505).
 */
export type TrialPolicyState = 'none' | 'trial-active' | 'trial-expired';

/**
 * Input shape for `evaluateTrialPolicy`. Structural subset of
 * `TenantEntitlement` — only `status` and the optional `expiresAt` are
 * read.
 */
export interface TrialEvaluationInput {
  /** Tenant entitlement, or null if no entitlement on file. */
  readonly entitlement: { readonly status: string; readonly expiresAt?: string } | null;
  /** Current epoch millis. */
  readonly nowMs: number;
}

/**
 * Evaluate a tenant entitlement against the trial-policy rules.
 *
 * Returns `'none'` for the null case and for non-trial statuses
 * (`active` / `lapsed` / `revoked` / `pending`). Returns
 * `'trial-active'` for a `status: 'trial'` entitlement whose
 * `expiresAt` is missing, unparseable, or in the future. Returns
 * `'trial-expired'` for a `status: 'trial'` entitlement whose
 * `expiresAt` is in the past.
 *
 * Unparseable `expiresAt` degrades to `'trial-active'` rather than
 * throwing — the trial fails open at the policy layer; the renderer
 * still emits the watermark, and the engine still emits
 * `LF-LICENSE-TRIAL-ACTIVE` so the host can surface the bad data.
 */
export function evaluateTrialPolicy(input: TrialEvaluationInput): TrialPolicyState {
  if (input.entitlement === null) return 'none';
  if (input.entitlement.status !== 'trial') return 'none';
  if (input.entitlement.expiresAt === undefined) return 'trial-active';
  const expiresMs = Date.parse(input.entitlement.expiresAt);
  if (Number.isNaN(expiresMs)) return 'trial-active';
  return input.nowMs >= expiresMs ? 'trial-expired' : 'trial-active';
}
