// apps/stageflip-slide/src/lib/admin-auth.ts
// T-411e — actor-resolver stub for the admin UI (per spec §D-T411e-3).
//
// v1 contract: read three optional environment variables
// (`STAGEFLIP_ADMIN_ROLE`, `STAGEFLIP_ADMIN_ORG`, `STAGEFLIP_ADMIN_SUB`)
// and project them onto an `AdminActor`. Returns `null` if any of the
// three is missing — the page treats `null` as "unauthenticated".
//
// Production deployments REPLACE this module by reading the verified
// session principal from a cookie / JWT and projecting it onto
// `AdminActor`. The shape is the contract; the source is deployment
// configuration.
//
// This file lives outside the determinism-gated paths (CLAUDE.md §3),
// so `process.env` reads are allowed.

/**
 * Authorization actor as observed by the admin UI. Mirrors
 * `AuthorizationActor` from `@stageflip/app-api` (the predicate's input
 * shape) plus the `sub` field used as `updatedBy` on writes.
 */
export interface AdminActor {
  readonly role: 'viewer' | 'editor' | 'admin' | 'owner' | 'superadmin' | (string & {});
  readonly org: string;
  readonly sub: string;
}

/**
 * Resolve the current actor from environment-variable stubs. Production
 * replaces this with a session-cookie / JWT reader (see file header).
 *
 * Returns `null` if any of the three required env vars is missing.
 */
export async function resolveAdminActor(): Promise<AdminActor | null> {
  const role = process.env.STAGEFLIP_ADMIN_ROLE;
  const org = process.env.STAGEFLIP_ADMIN_ORG;
  const sub = process.env.STAGEFLIP_ADMIN_SUB;
  if (!role || !org || !sub) return null;
  return { role, org, sub };
}

/**
 * Test-only override: set the actor that `resolveAdminActor` returns
 * regardless of env-var state. Used by component + action tests so they
 * don't have to mutate `process.env`. Pass `null` to clear the override
 * (the resolver falls back to env vars).
 */
let testOverride: AdminActor | null | undefined = undefined;

export function setAdminActorForTest(actor: AdminActor | null | undefined): void {
  testOverride = actor;
}

export async function resolveAdminActorOrTestOverride(): Promise<AdminActor | null> {
  if (testOverride !== undefined) return testOverride;
  return resolveAdminActor();
}
