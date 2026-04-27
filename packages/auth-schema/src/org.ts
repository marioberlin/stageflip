// packages/auth-schema/src/org.ts
// Organisation record — `orgs/{orgId}` in Firestore (T-262 AC #2).
// Plan is enumerated; region is filled in by T-271 EU residency.
//
// T-271 introduces:
//   - `regionSchema` — `'us' | 'eu'` enum (replacing the previous open
//     `z.string().optional()`).
//   - Default `'us'` so persisted records pre-T-271 (no `region` field) keep
//     loading after schema migration.
//   - `validateRegionTransition(prev, next)` — the application-side immutability
//     guard. Zod cannot natively express "this field is immutable across
//     updates"; the helper is the security primitive enforced by callers
//     mutating org records (T-271 AC #8).

import { z } from 'zod';

export const planSchema = z.enum(['free', 'team', 'business', 'enterprise']);

/**
 * Tenant data residency region. `'us'` covers the `(default)` Firestore
 * database (multi-region `nam5`). `'eu'` covers the `eu-west` named database
 * (`europe-west3`, Frankfurt) provisioned for GDPR data-residency orgs.
 */
export const regionSchema = z.enum(['us', 'eu']);

export const orgSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  /** Lowercase slug — `[a-z0-9-]+`. Used for tenant-friendly URLs. */
  slug: z.string().regex(/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/),
  createdAt: z.number().int().nonnegative(),
  ownerId: z.string().min(1),
  plan: planSchema,
  /**
   * Tenant data residency. Defaults to `'us'` for back-compat with org records
   * persisted before T-271 (which had no `region` field). Mutation across the
   * `'us' ↔ 'eu'` boundary is rejected by {@link validateRegionTransition} —
   * Zod itself cannot express cross-update immutability.
   */
  region: regionSchema.default('us'),
});

export type Org = z.infer<typeof orgSchema>;
export type OrgPlan = z.infer<typeof planSchema>;
export type Region = z.infer<typeof regionSchema>;

/** Result of {@link validateRegionTransition}. */
export type RegionTransitionResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly error: string };

/**
 * Application-side immutability guard for `org.region` (T-271 AC #8). Zod
 * cannot natively express "this field is immutable across updates", so callers
 * that mutate org records (Cloud Functions, admin scripts) MUST run the
 * candidate `next` record through this helper before persisting and reject the
 * write on `{ ok: false }`.
 *
 * Cross-region migration is a manual operational procedure (see
 * `docs/ops/data-residency.md`); this guard is the security primitive that
 * prevents accidental in-place mutation. It is also mirrored at the rules
 * layer (`firebase/firestore.rules` and `firebase/firestore-eu.rules`) — both
 * databases reject client-side writes to `org.region`, but the rules cannot
 * see the prior value, so the application-side guard is what prevents an
 * admin SDK call (which bypasses rules) from flipping the field by mistake.
 *
 * @returns `{ ok: true }` if the region is unchanged; `{ ok: false, error }`
 * otherwise. The error message names both regions to aid operator triage.
 */
export function validateRegionTransition(
  prev: Pick<Org, 'region'>,
  next: Pick<Org, 'region'>,
): RegionTransitionResult {
  if (prev.region === next.region) {
    return { ok: true };
  }
  return {
    ok: false,
    error: `org.region is immutable post-creation: cannot change ${prev.region} → ${next.region}. Manual migration required (see docs/ops/data-residency.md).`,
  };
}
