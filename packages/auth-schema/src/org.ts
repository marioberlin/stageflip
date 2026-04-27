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
//     mutating org records.

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
 * Stub — filled in by T-271 commit 2 (`feat(auth-schema): region immutability
 * guard`). Returns a placeholder `ok` so the implementation can land
 * incrementally; the test suite pins the real behaviour.
 */
export function validateRegionTransition(
  _prev: Pick<Org, 'region'>,
  _next: Pick<Org, 'region'>,
): RegionTransitionResult {
  throw new Error('validateRegionTransition — not implemented (T-271 commit 2 pending)');
}
