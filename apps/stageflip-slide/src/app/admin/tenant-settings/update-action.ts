// apps/stageflip-slide/src/app/admin/tenant-settings/update-action.ts
// T-411e — Next 15 server action that persists a tenant's
// `features.interactive` posture. Composes:
//
//   - resolveActor() (default: resolveAdminActorOrTestOverride)
//   - canSetInteractive(...)              (@stageflip/app-api)
//   - tenantSettingsSchema.parse(...)     (@stageflip/storage)
//   - store.putTenantSettings(...)        (apps/stageflip-slide/.../store.ts)
//
// Invariants:
//   - On invalid input → redirect ?error=invalid_input
//   - On null actor    → redirect ?error=unauthenticated
//   - On predicate denial → redirect ?error=forbidden&reason=<reason>
//   - On allowed write → revalidatePath + redirect ?status=updated
//
// All redirects target the same admin route so the page re-renders with
// the latest persisted state. The action lives outside CLAUDE.md §3
// (admin UI; not clip / runtime code), so `new Date().toISOString()` for
// `updatedAt` is allowed.
//
// Per the Next 15 server-action contract, this module's only export is
// the async action itself. Test-injectable deps live in the sibling
// `update-action-deps.ts` module.

'use server';

import { type InteractiveValue, canSetInteractive } from '@stageflip/app-api';
import { type TenantSettings, tenantSettingsSchema } from '@stageflip/storage';
import { z } from 'zod';

import { getUpdateActionDeps } from './update-action-deps';

const ADMIN_ROUTE = '/admin/tenant-settings';

const interactiveValueSchema = z.enum(['disabled', 'preview', 'ga']);

const updateInputSchema = z
  .object({
    tenantId: z.string().min(1),
    value: interactiveValueSchema,
  })
  .strict();

/** The server action invoked by the page's `<form action={...}>`. */
export async function updateTenantInteractiveAction(formData: FormData): Promise<void> {
  const deps = getUpdateActionDeps();
  const raw = {
    tenantId: formData.get('tenantId'),
    value: formData.get('value'),
  };
  const parsed = updateInputSchema.safeParse(raw);
  if (!parsed.success) {
    deps.redirectFn(redirectUrl({ error: 'invalid_input' }));
    return;
  }
  const { tenantId, value: nextValue } = parsed.data;

  const actor = await deps.resolveActor();
  if (actor === null) {
    deps.redirectFn(redirectUrl({ error: 'unauthenticated', tenantId }));
    return;
  }

  const existing = await deps.store.getTenantSettings(tenantId);
  const currentValue: InteractiveValue = existing?.features.interactive ?? 'disabled';

  const decision = canSetInteractive(actor, tenantId, currentValue, nextValue);
  if (!decision.allowed) {
    deps.redirectFn(redirectUrl({ error: 'forbidden', reason: decision.reason, tenantId }));
    return;
  }

  const row: TenantSettings = tenantSettingsSchema.parse({
    tenantId,
    features: { interactive: nextValue },
    updatedAt: deps.now(),
    updatedBy: actor.sub,
  });
  await deps.store.putTenantSettings(row);
  deps.revalidate(ADMIN_ROUTE);
  deps.redirectFn(redirectUrl({ status: 'updated', tenantId }));
}

interface RedirectQuery {
  error?: 'invalid_input' | 'unauthenticated' | 'forbidden';
  status?: 'updated';
  reason?: string;
  tenantId?: string;
}

function redirectUrl(query: RedirectQuery): string {
  const params = new URLSearchParams();
  if (query.tenantId) params.set('tenantId', query.tenantId);
  if (query.error) params.set('error', query.error);
  if (query.status) params.set('status', query.status);
  if (query.reason) params.set('reason', query.reason);
  const qs = params.toString();
  return qs.length > 0 ? `${ADMIN_ROUTE}?${qs}` : ADMIN_ROUTE;
}
