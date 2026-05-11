// apps/stageflip-slide/src/app/admin/tenant-settings/page.tsx
// T-411e — minimal admin UI for the per-tenant `features.interactive`
// posture. Server component reads the current settings via the
// process-local TenantSettingsStore (T-411a) and renders an HTML form
// whose action calls `updateTenantInteractiveAction` (server action).
//
// Authorization gating per spec §D-T411e-4:
//   - superadmin           → update form for any tenant
//   - admin / owner        → update form for own tenant only
//   - other                → read-only view
//   - unauthenticated      → 401-shaped message
//
// Posture per spec §D-T411e-5: native HTML, ~10 lines of inline CSS, no
// design system. The downstream UX-polish task replaces the rendered
// HTML with a designed surface — the server action and authorization
// gating remain reusable.

import type { ReactElement } from 'react';
import { resolveAdminActorOrTestOverride } from '../../../lib/admin-auth';
import { getStore } from './store';
import { updateTenantInteractiveAction } from './update-action';

const ALL_VALUES = ['disabled', 'preview', 'ga'] as const;
type InteractiveValue = (typeof ALL_VALUES)[number];

interface PageSearchParams {
  tenantId?: string;
  error?: string;
  reason?: string;
  status?: string;
}

interface PageProps {
  // Next 15 passes searchParams as a Promise on App-Router pages.
  searchParams?: Promise<PageSearchParams>;
}

// Next.js App Router requires a default export for route components.
// biome-ignore lint/style/noDefaultExport: Next.js page contract.
export default async function TenantSettingsAdminPage(props: PageProps): Promise<ReactElement> {
  const sp = (await props.searchParams) ?? {};
  const actor = await resolveAdminActorOrTestOverride();

  // 401 — no actor resolvable.
  if (actor === null) {
    return renderShell(
      <section data-testid="tenant-settings-unauthenticated">
        <h1>Tenant settings</h1>
        <p>
          <strong>401 — not authenticated.</strong> Set
          <code> STAGEFLIP_ADMIN_ROLE</code>, <code>STAGEFLIP_ADMIN_ORG</code>, and
          <code> STAGEFLIP_ADMIN_SUB</code> for local development, or sign in via your
          deployment&rsquo;s session flow.
        </p>
      </section>,
    );
  }

  const tenantId = sp.tenantId ?? actor.org;

  // 403 — cross-tenant read for non-superadmin.
  if (actor.role !== 'superadmin' && actor.org !== tenantId) {
    return renderShell(
      <section data-testid="tenant-settings-cross-tenant-denied">
        <h1>Tenant settings</h1>
        <p>
          <strong>403 — cross-tenant access denied.</strong> Actor org
          <code> {actor.org} </code> cannot view tenant <code>{tenantId}</code>.
        </p>
      </section>,
    );
  }

  const row = await getStore().getTenantSettings(tenantId);
  const currentValue: InteractiveValue = row?.features.interactive ?? 'disabled';
  const isDefaultDeny = row === null;
  const canUpdate = actor.role === 'superadmin' || actor.role === 'admin' || actor.role === 'owner';

  return renderShell(
    <section data-testid="tenant-settings-page">
      <h1>
        Tenant settings &mdash; <code>features.interactive</code>
      </h1>
      <p data-testid="tenant-settings-actor">
        Acting as <code>{actor.sub}</code> (role: <code>{actor.role}</code>, org:
        <code> {actor.org}</code>).
      </p>

      <dl data-testid="tenant-settings-current">
        <dt>Tenant ID</dt>
        <dd>
          <code>{tenantId}</code>
          {isDefaultDeny ? <span> (no row persisted &mdash; showing default-deny)</span> : null}
        </dd>
        <dt>Current value</dt>
        <dd data-testid="tenant-settings-current-value">
          <code>{currentValue}</code>
        </dd>
        {row ? (
          <>
            <dt>Last updated</dt>
            <dd>
              <code>{row.updatedAt}</code> by <code>{row.updatedBy}</code>
            </dd>
          </>
        ) : null}
      </dl>

      {sp.status === 'updated' ? (
        <output data-testid="tenant-settings-status">Updated.</output>
      ) : null}
      {sp.error ? (
        <p data-testid="tenant-settings-error">
          Error: <code>{sp.error}</code>
          {sp.reason ? <span> &mdash; {sp.reason}</span> : null}
        </p>
      ) : null}

      {canUpdate ? (
        <form action={updateTenantInteractiveAction} data-testid="tenant-settings-form">
          <input type="hidden" name="tenantId" value={tenantId} />
          <label htmlFor="value">Set posture</label>
          <select
            id="value"
            name="value"
            defaultValue={currentValue}
            data-testid="tenant-settings-select"
          >
            {ALL_VALUES.map((v) => {
              // Tenant-admin cannot set ga; gray it out (HTML-level only — server
              // action enforces). Superadmin sees all three enabled.
              const disabled = actor.role !== 'superadmin' && v === 'ga';
              return (
                <option key={v} value={v} disabled={disabled}>
                  {v}
                  {disabled ? ' (superadmin only)' : ''}
                </option>
              );
            })}
          </select>
          <button type="submit" data-testid="tenant-settings-submit">
            Update
          </button>
        </form>
      ) : (
        <p data-testid="tenant-settings-readonly">
          Read-only view. Update requires <code>admin</code>, <code>owner</code>, or
          <code> superadmin</code> role.
        </p>
      )}

      <p>
        Concept reference:
        <code> skills/stageflip/concepts/tenant-settings/SKILL.md </code>
        (T-411 spec: <code>docs/tasks/T-411.md</code>).
      </p>
      <p>
        <em>Minimal CRUD slice (T-411e). UX polish deferred per T-411 §D-T411-7.</em>
      </p>
    </section>,
  );
}

/**
 * Wrap the body with the inline-CSS shell. Per spec §D-T411e-5, ~10
 * lines of CSS for spacing + readability — no design system.
 */
function renderShell(body: ReactElement): ReactElement {
  return (
    <>
      <style>{`
        main.tenant-settings-admin { font-family: system-ui, sans-serif; max-width: 48rem; padding: 1.5rem; line-height: 1.5; }
        main.tenant-settings-admin h1 { font-size: 1.4rem; margin-bottom: 1rem; }
        main.tenant-settings-admin form { display: flex; flex-direction: column; gap: 0.5rem; max-width: 20rem; margin-top: 1rem; padding: 1rem; border: 1px solid #ccc; }
        main.tenant-settings-admin button { padding: 0.5rem 1rem; cursor: pointer; }
        main.tenant-settings-admin code { background: #f4f4f4; padding: 0 0.25rem; }
        main.tenant-settings-admin dl { display: grid; grid-template-columns: 10rem 1fr; gap: 0.25rem 1rem; }
        main.tenant-settings-admin dt { font-weight: 600; }
      `}</style>
      <main className="tenant-settings-admin">{body}</main>
    </>
  );
}
