// apps/stageflip-slide/src/app/admin/tenant-settings/page.test.tsx
// T-411e — role-gated render tests for the admin page (per spec
// §D-T411e-7 / AC #19–#24).
//
// The page is a Next 15 React Server Component (async function). We
// invoke it directly to obtain the rendered tree, then drive
// @testing-library/react's render on it. The page's only inputs are
// `searchParams` (Promise) and the resolved actor (test-overridden via
// `setAdminActorForTest`). Store state is overridden via
// `setStoreForTest` so each test runs against a fresh InMemory.

import { InMemoryTenantSettingsStore } from '@stageflip/storage';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { type AdminActor, setAdminActorForTest } from '../../../lib/admin-auth';
import TenantSettingsAdminPage from './page';
import { setStoreForTest } from './store';

async function renderPage(opts: {
  actor: AdminActor | null;
  store?: InMemoryTenantSettingsStore;
  searchParams?: Record<string, string>;
}): Promise<void> {
  setAdminActorForTest(opts.actor);
  setStoreForTest(opts.store);
  const node = await TenantSettingsAdminPage({
    searchParams: Promise.resolve(opts.searchParams ?? {}),
  });
  render(node);
}

beforeEach(() => {
  setAdminActorForTest(undefined);
  setStoreForTest(undefined);
});

afterEach(() => {
  cleanup();
  setAdminActorForTest(undefined);
  setStoreForTest(undefined);
});

describe('TenantSettingsAdminPage — role-gated render', () => {
  describe('superadmin (AC #19, #20)', () => {
    it('sees the update form for own tenant (default)', async () => {
      await renderPage({
        actor: { role: 'superadmin', org: 'admin-org', sub: 'admin-1' },
      });
      expect(screen.getByTestId('tenant-settings-form')).toBeTruthy();
      expect(screen.getByTestId('tenant-settings-select')).toBeTruthy();
      expect(screen.getByTestId('tenant-settings-submit')).toBeTruthy();
    });

    it('sees the update form for another tenant via ?tenantId=...', async () => {
      await renderPage({
        actor: { role: 'superadmin', org: 'admin-org', sub: 'admin-1' },
        searchParams: { tenantId: 'tenant-other' },
      });
      expect(screen.getByTestId('tenant-settings-form')).toBeTruthy();
      // Page header surfaces the picked tenant.
      expect(screen.getByTestId('tenant-settings-current').textContent).toContain('tenant-other');
    });

    it('sees ga as a selectable option (not disabled)', async () => {
      await renderPage({
        actor: { role: 'superadmin', org: 'admin-org', sub: 'admin-1' },
      });
      const gaOption = screen
        .getByTestId('tenant-settings-select')
        .querySelector('option[value="ga"]') as HTMLOptionElement | null;
      expect(gaOption).not.toBeNull();
      expect(gaOption?.disabled).toBe(false);
    });
  });

  describe('tenant_admin / owner (AC #21, #22)', () => {
    it('admin sees the update form for own tenant', async () => {
      await renderPage({
        actor: { role: 'admin', org: 'tenant-x', sub: 'u1' },
      });
      expect(screen.getByTestId('tenant-settings-form')).toBeTruthy();
    });

    it('owner sees the update form for own tenant', async () => {
      await renderPage({
        actor: { role: 'owner', org: 'tenant-x', sub: 'u2' },
      });
      expect(screen.getByTestId('tenant-settings-form')).toBeTruthy();
    });

    it('tenant_admin gets 403 message + no form for cross-tenant request', async () => {
      await renderPage({
        actor: { role: 'admin', org: 'tenant-x', sub: 'u1' },
        searchParams: { tenantId: 'tenant-y' },
      });
      expect(screen.getByTestId('tenant-settings-cross-tenant-denied')).toBeTruthy();
      expect(screen.queryByTestId('tenant-settings-form')).toBeNull();
    });

    it('tenant_admin sees ga option as disabled (HTML hint; server enforces)', async () => {
      await renderPage({
        actor: { role: 'admin', org: 'tenant-x', sub: 'u1' },
      });
      const gaOption = screen
        .getByTestId('tenant-settings-select')
        .querySelector('option[value="ga"]') as HTMLOptionElement | null;
      expect(gaOption?.disabled).toBe(true);
    });
  });

  describe('viewer / editor (AC #23)', () => {
    it('viewer sees read-only view for own tenant; no form', async () => {
      await renderPage({
        actor: { role: 'viewer', org: 'tenant-x', sub: 'u1' },
      });
      expect(screen.queryByTestId('tenant-settings-form')).toBeNull();
      expect(screen.getByTestId('tenant-settings-readonly')).toBeTruthy();
    });

    it('editor sees read-only view; no form', async () => {
      await renderPage({
        actor: { role: 'editor', org: 'tenant-x', sub: 'u1' },
      });
      expect(screen.queryByTestId('tenant-settings-form')).toBeNull();
      expect(screen.getByTestId('tenant-settings-readonly')).toBeTruthy();
    });

    it('viewer is denied cross-tenant view', async () => {
      await renderPage({
        actor: { role: 'viewer', org: 'tenant-x', sub: 'u1' },
        searchParams: { tenantId: 'tenant-y' },
      });
      expect(screen.getByTestId('tenant-settings-cross-tenant-denied')).toBeTruthy();
      expect(screen.queryByTestId('tenant-settings-form')).toBeNull();
    });
  });

  describe('unauthenticated (AC #24)', () => {
    it('null actor → 401 message; no form', async () => {
      await renderPage({ actor: null });
      expect(screen.getByTestId('tenant-settings-unauthenticated')).toBeTruthy();
      expect(screen.queryByTestId('tenant-settings-form')).toBeNull();
    });
  });

  describe('default-deny synthesis (AC #8)', () => {
    it('shows current value `disabled` and a "no row persisted" hint when store is empty', async () => {
      await renderPage({
        actor: { role: 'superadmin', org: 'admin-org', sub: 'admin-1' },
        searchParams: { tenantId: 'never-seen-tenant' },
      });
      expect(screen.getByTestId('tenant-settings-current-value').textContent).toBe('disabled');
      expect(screen.getByTestId('tenant-settings-current').textContent).toContain('default-deny');
    });

    it('shows the persisted value + updatedAt + updatedBy when row exists', async () => {
      const store = new InMemoryTenantSettingsStore();
      await store.putTenantSettings({
        tenantId: 'tenant-x',
        features: { interactive: 'preview' },
        updatedAt: '2026-05-01T12:34:56.000Z',
        updatedBy: 'past-admin',
      });
      await renderPage({
        actor: { role: 'admin', org: 'tenant-x', sub: 'u1' },
        store,
      });
      expect(screen.getByTestId('tenant-settings-current-value').textContent).toBe('preview');
      const dl = screen.getByTestId('tenant-settings-current').textContent ?? '';
      expect(dl).toContain('2026-05-01T12:34:56.000Z');
      expect(dl).toContain('past-admin');
    });
  });

  describe('status / error feedback (AC #11, #14)', () => {
    it('renders the success status banner when ?status=updated', async () => {
      await renderPage({
        actor: { role: 'admin', org: 'tenant-x', sub: 'u1' },
        searchParams: { status: 'updated' },
      });
      expect(screen.getByTestId('tenant-settings-status')).toBeTruthy();
    });

    it('renders the error banner when ?error=forbidden&reason=...', async () => {
      await renderPage({
        actor: { role: 'admin', org: 'tenant-x', sub: 'u1' },
        searchParams: {
          error: 'forbidden',
          reason: 'transitions involving "ga" require superadmin',
        },
      });
      const errorEl = screen.getByTestId('tenant-settings-error');
      expect(errorEl.textContent).toContain('forbidden');
      expect(errorEl.textContent).toContain('require superadmin');
    });
  });

  describe('SKILL link (AC #11)', () => {
    it('renders a reference to the concept SKILL', async () => {
      await renderPage({
        actor: { role: 'admin', org: 'tenant-x', sub: 'u1' },
      });
      const main = screen.getByTestId('tenant-settings-page').textContent ?? '';
      expect(main).toContain('skills/stageflip/concepts/tenant-settings/SKILL.md');
    });
  });
});
