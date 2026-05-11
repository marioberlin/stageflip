// apps/api/src/routes/tenant-settings.ts
// T-411b — TenantSettings HTTP routes (per parent §D-T411-3 + §D-T411-6).
//
// Three procedures, mounted under /v1/tenant-settings:
//
//   GET  /v1/tenant-settings/:tenantId               → tenantSettings.get
//   POST /v1/tenant-settings/:tenantId/interactive   → tenantSettings.setInteractive
//   GET  /v1/tenant-settings                         → tenantSettings.list
//
// Default-deny semantics (parent §D-T411-5): an absent tenant row maps to
// `features.interactive: 'disabled'`. The storage layer (T-411a) returns
// null for absent rows; this route synthesises the default on read without
// persisting. The first allowed write materialises the row.
//
// Authorization (parent §D-T411-6) is enforced via `canSetInteractive` for
// `setInteractive` and an inline superadmin check for `list`. Routes sit
// behind `authMiddleware` per the existing `/v1/*` convention in
// `server.ts`.
//
// The route is a Hono subrouter, not a tRPC router (the codebase has no
// tRPC root). See docs/tasks/T-411b.md "Deviation from parent spec".

import { zValidator } from '@hono/zod-validator';
import { Hono } from 'hono';
import { z } from 'zod';

import {
  type TenantSettings,
  type TenantSettingsStore,
  tenantSettingsSchema,
} from '@stageflip/storage';

import {
  type AuthorizationActor,
  type InteractiveValue,
  canSetInteractive,
} from '../auth/can-set-interactive.js';
import type { AuthVariables } from '../auth/middleware.js';
import type { Principal } from '../auth/verify.js';

const interactiveValueSchema = z.enum(['disabled', 'preview', 'ga']);

const setInteractiveBodySchema = z
  .object({
    value: interactiveValueSchema,
  })
  .strict();

export interface TenantSettingsRouteDeps {
  /** Concrete TenantSettingsStore (in-memory / Postgres / Firebase). */
  readonly store: TenantSettingsStore;
  /** Injectable clock for `updatedAt`; defaults to `() => new Date().toISOString()`. */
  now?(): string;
  /** `updatedBy` value used when synthesising default-deny payloads on `get`. */
  systemActor?: string;
}

/**
 * Build the `/v1/tenant-settings` Hono subrouter. Caller mounts it on the
 * root app; the existing `authMiddleware` on `/v1/*` populates
 * `c.var.principal` so the handlers can read the actor.
 */
export function createTenantSettingsRoute(
  deps: TenantSettingsRouteDeps,
): Hono<{ Variables: AuthVariables }> {
  const now = deps.now ?? (() => new Date().toISOString());
  const systemActor = deps.systemActor ?? 'system';
  const app = new Hono<{ Variables: AuthVariables }>();

  // GET /:tenantId — read; auto-synthesises default-deny on absent row.
  app.get('/:tenantId', async (c) => {
    const tenantId = c.req.param('tenantId');
    if (!tenantId) {
      return c.json({ error: 'invalid_request', message: 'missing tenantId' }, 400);
    }
    const principal = c.var.principal;
    const denial = denyReadIfCrossTenant(principal, tenantId);
    if (denial) return c.json(denial.body, denial.status);

    const row = await deps.store.getTenantSettings(tenantId);
    if (row !== null) {
      return c.json(row);
    }
    // Synthesise default-deny per parent §D-T411-5; do NOT persist.
    const synthesised: TenantSettings = {
      tenantId,
      features: { interactive: 'disabled' },
      updatedAt: now(),
      updatedBy: systemActor,
    };
    return c.json(synthesised);
  });

  // POST /:tenantId/interactive — set posture; authorization-gated.
  app.post('/:tenantId/interactive', zValidator('json', setInteractiveBodySchema), async (c) => {
    const tenantId = c.req.param('tenantId');
    if (!tenantId) {
      return c.json({ error: 'invalid_request', message: 'missing tenantId' }, 400);
    }
    const { value: nextValue } = c.req.valid('json');
    const principal = c.var.principal;
    const actor = principalToActor(principal);

    // Determine current value (default-deny synthesis if absent) so the
    // predicate sees the right "from" cell.
    const existing = await deps.store.getTenantSettings(tenantId);
    const currentValue: InteractiveValue = existing?.features.interactive ?? 'disabled';

    const decision = canSetInteractive(actor, tenantId, currentValue, nextValue);
    if (!decision.allowed) {
      return c.json({ error: 'forbidden', reason: decision.reason }, 403);
    }

    const updated: TenantSettings = tenantSettingsSchema.parse({
      tenantId,
      features: { interactive: nextValue },
      updatedAt: now(),
      updatedBy: principal.sub,
    });
    await deps.store.putTenantSettings(updated);
    return c.json(updated);
  });

  // GET / — list; superadmin only.
  app.get('/', async (c) => {
    const principal = c.var.principal;
    const actor = principalToActor(principal);
    if (actor.role !== 'superadmin') {
      return c.json({ error: 'forbidden', reason: 'list requires superadmin' }, 403);
    }
    const rows = await deps.store.listTenantSettings();
    return c.json({ tenantSettings: rows });
  });

  return app;
}

/**
 * Project the API's `Principal` discriminated union onto the
 * authorization-predicate's `AuthorizationActor` shape. McpPrincipal
 * carries `org` + `role`; FirebasePrincipal does not, so it gets a
 * conservative empty `org` + `'viewer'` role (default-deny under the
 * predicate).
 */
function principalToActor(principal: Principal): AuthorizationActor {
  if (principal.kind === 'mcp-session') {
    return { role: principal.role, org: principal.org };
  }
  return { role: 'viewer', org: '' };
}

interface ReadDenial {
  readonly status: 403;
  readonly body: { readonly error: 'forbidden'; readonly reason: string };
}

/**
 * Read authorization: any actor may read their own tenant; superadmin may
 * read any tenant; everyone else is denied cross-tenant reads. (Read is
 * cheaper than write and not gated by `canSetInteractive`.)
 */
function denyReadIfCrossTenant(principal: Principal, tenantId: string): ReadDenial | undefined {
  const actor = principalToActor(principal);
  if (actor.role === 'superadmin') return undefined;
  if (actor.org === tenantId) return undefined;
  return {
    status: 403,
    body: {
      error: 'forbidden',
      reason: `cross-tenant read: actor.org "${actor.org}" cannot read tenant "${tenantId}"`,
    },
  };
}
