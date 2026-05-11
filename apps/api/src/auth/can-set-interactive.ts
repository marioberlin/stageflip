// apps/api/src/auth/can-set-interactive.ts
// T-411b — authorization predicate for `tenantSettings.setInteractive`. Pure
// function; covers the two-role model from parent T-411 §D-T411-6 mapped onto
// the existing McpSessionRole namespace ('admin' | 'owner' = tenant_admin
// equivalents; 'superadmin' is a new role recognised here as a string).
//
// Decision matrix (D-T411b-2):
//
//   superadmin          → any tenant, any → any (incl. 'ga')
//   admin / owner       → own tenant only, 'disabled' ↔ 'preview'; 'ga' denied
//   editor / viewer     → always denied
//   unknown role        → denied
//
// Tenants are identified by org id in v1 (every org IS a tenant in the T-411
// sense); cross-tenant calls (actor.org !== tenantId) are denied for any
// non-superadmin actor.

/** The three legal `features.interactive` values per ADR-005 §D3. */
export type InteractiveValue = 'disabled' | 'preview' | 'ga';

/**
 * Authorization actor as observed by the predicate. The `role` field is
 * a plain string so the v1 `'superadmin'` role (not yet in
 * McpSessionRole) can be passed through without a type-system change;
 * unrecognised roles fall through to the default-deny branch.
 */
export interface AuthorizationActor {
  readonly role: 'viewer' | 'editor' | 'admin' | 'owner' | 'superadmin' | (string & {});
  readonly org: string;
}

/** Result of the predicate: allowed, or denied with a structured reason. */
export type AuthorizationDecision =
  | { readonly allowed: true }
  | { readonly allowed: false; readonly reason: string };

/**
 * Decide whether `actor` may transition `tenantId`'s `features.interactive`
 * from `currentValue` to `nextValue`. Pure function — same inputs always
 * return the same decision; no I/O.
 */
export function canSetInteractive(
  actor: AuthorizationActor,
  tenantId: string,
  currentValue: InteractiveValue,
  nextValue: InteractiveValue,
): AuthorizationDecision {
  // Superadmin: unrestricted across all tenants and all values.
  if (actor.role === 'superadmin') {
    return { allowed: true };
  }

  // Tenant-admin equivalents: 'admin' and 'owner' on the existing
  // McpSessionRole namespace. Anything else is denied outright.
  const isTenantAdmin = actor.role === 'admin' || actor.role === 'owner';
  if (!isTenantAdmin) {
    return {
      allowed: false,
      reason: `role "${actor.role}" cannot change tenant settings`,
    };
  }

  // Tenant-admin: own tenant only.
  if (actor.org !== tenantId) {
    return {
      allowed: false,
      reason: `cross-tenant: actor.org "${actor.org}" cannot change tenant "${tenantId}"`,
    };
  }

  // Tenant-admin: 'ga' is superadmin-only (parent §D-T411-6: GA enablement
  // requires the security-review sign-off; a tenant admin clicking a button
  // cannot bypass it).
  if (nextValue === 'ga' || currentValue === 'ga') {
    return {
      allowed: false,
      reason: 'transitions involving "ga" require superadmin',
    };
  }

  // Tenant-admin: 'disabled' ↔ 'preview' (incl. same-cell no-ops).
  return { allowed: true };
}
