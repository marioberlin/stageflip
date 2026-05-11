// apps/stageflip-slide/src/app/admin/tenant-settings/update-action.test.ts
// T-411e — server-action coverage. Validates redirect targets +
// persistence behavior across the four outcome cells:
//   1. invalid input         → ?error=invalid_input
//   2. unauthenticated       → ?error=unauthenticated
//   3. forbidden transition  → ?error=forbidden&reason=...
//   4. allowed write         → ?status=updated  (+ persistence + revalidate)

import { InMemoryTenantSettingsStore } from '@stageflip/storage';
import { afterEach, describe, expect, it } from 'vitest';
import type { AdminActor } from '../../../lib/admin-auth';
import { updateTenantInteractiveAction } from './update-action';
import { setUpdateActionDeps } from './update-action-deps';

interface CapturedRedirect {
  url: string;
}

interface CapturedRevalidate {
  path: string;
}

function makeFormData(entries: Record<string, string | undefined>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(entries)) {
    if (value !== undefined) fd.set(key, value);
  }
  return fd;
}

function setup(opts: { actor: AdminActor | null; store?: InMemoryTenantSettingsStore }): {
  redirects: CapturedRedirect[];
  revalidates: CapturedRevalidate[];
  store: InMemoryTenantSettingsStore;
} {
  const redirects: CapturedRedirect[] = [];
  const revalidates: CapturedRevalidate[] = [];
  const store = opts.store ?? new InMemoryTenantSettingsStore();
  setUpdateActionDeps({
    resolveActor: async () => opts.actor,
    store,
    now: () => '2026-05-11T00:00:00.000Z',
    redirectFn: (url: string) => {
      redirects.push({ url });
      // Next's `redirect` throws — emulate so the action's control flow
      // mirrors production. Tests catch the thrown sentinel.
      throw new Error(`__redirect__:${url}`);
    },
    revalidate: (path: string) => {
      revalidates.push({ path });
    },
  });
  return { redirects, revalidates, store };
}

async function runAction(formData: FormData): Promise<Error | null> {
  try {
    await updateTenantInteractiveAction(formData);
    return null;
  } catch (err) {
    if (err instanceof Error && err.message.startsWith('__redirect__:')) return err;
    throw err;
  }
}

afterEach(() => {
  // Reset to defaults so subsequent tests / suites are not contaminated.
  setUpdateActionDeps({});
});

describe('updateTenantInteractiveAction', () => {
  describe('invalid input (AC #25)', () => {
    it('redirects with ?error=invalid_input when tenantId missing', async () => {
      const { redirects } = setup({
        actor: { role: 'superadmin', org: 'tenant-x', sub: 'u1' },
      });
      await runAction(makeFormData({ value: 'preview' }));
      expect(redirects).toHaveLength(1);
      expect(redirects[0]?.url).toBe('/admin/tenant-settings?error=invalid_input');
    });

    it('redirects with ?error=invalid_input when value is not in enum', async () => {
      const { redirects } = setup({
        actor: { role: 'superadmin', org: 'tenant-x', sub: 'u1' },
      });
      await runAction(makeFormData({ tenantId: 'tenant-x', value: 'bogus' }));
      expect(redirects).toHaveLength(1);
      expect(redirects[0]?.url).toBe('/admin/tenant-settings?error=invalid_input');
    });

    it('redirects with ?error=invalid_input when tenantId is empty string', async () => {
      const { redirects } = setup({
        actor: { role: 'superadmin', org: 'tenant-x', sub: 'u1' },
      });
      await runAction(makeFormData({ tenantId: '', value: 'preview' }));
      expect(redirects).toHaveLength(1);
      expect(redirects[0]?.url).toBe('/admin/tenant-settings?error=invalid_input');
    });
  });

  describe('unauthenticated (AC #26)', () => {
    it('redirects with ?error=unauthenticated when actor is null', async () => {
      const { redirects } = setup({ actor: null });
      await runAction(makeFormData({ tenantId: 'tenant-x', value: 'preview' }));
      expect(redirects).toHaveLength(1);
      expect(redirects[0]?.url).toBe(
        '/admin/tenant-settings?tenantId=tenant-x&error=unauthenticated',
      );
    });
  });

  describe('forbidden (AC #27)', () => {
    it('redirects with ?error=forbidden when tenant_admin tries to set ga', async () => {
      const { redirects, store } = setup({
        actor: { role: 'admin', org: 'tenant-x', sub: 'u1' },
      });
      await runAction(makeFormData({ tenantId: 'tenant-x', value: 'ga' }));
      expect(redirects).toHaveLength(1);
      const url = redirects[0]?.url ?? '';
      expect(url).toContain('error=forbidden');
      expect(url).toContain('tenantId=tenant-x');
      expect(url).toContain('reason=');
      // Did NOT persist.
      expect(await store.getTenantSettings('tenant-x')).toBeNull();
    });

    it('redirects with ?error=forbidden when tenant_admin tries cross-tenant write', async () => {
      const { redirects, store } = setup({
        actor: { role: 'admin', org: 'tenant-x', sub: 'u1' },
      });
      await runAction(makeFormData({ tenantId: 'tenant-y', value: 'preview' }));
      expect(redirects).toHaveLength(1);
      const url = redirects[0]?.url ?? '';
      expect(url).toContain('error=forbidden');
      expect(url).toContain('tenantId=tenant-y');
      expect(await store.getTenantSettings('tenant-y')).toBeNull();
    });

    it('redirects with ?error=forbidden when viewer tries to write', async () => {
      const { redirects, store } = setup({
        actor: { role: 'viewer', org: 'tenant-x', sub: 'u1' },
      });
      await runAction(makeFormData({ tenantId: 'tenant-x', value: 'preview' }));
      expect(redirects).toHaveLength(1);
      expect(redirects[0]?.url).toContain('error=forbidden');
      expect(await store.getTenantSettings('tenant-x')).toBeNull();
    });
  });

  describe('allowed write (AC #28)', () => {
    it('persists the row, revalidates, and redirects with ?status=updated for tenant_admin disabled→preview', async () => {
      const { redirects, revalidates, store } = setup({
        actor: { role: 'admin', org: 'tenant-x', sub: 'u1' },
      });
      await runAction(makeFormData({ tenantId: 'tenant-x', value: 'preview' }));
      expect(redirects).toHaveLength(1);
      expect(redirects[0]?.url).toBe('/admin/tenant-settings?tenantId=tenant-x&status=updated');
      expect(revalidates).toEqual([{ path: '/admin/tenant-settings' }]);
      const row = await store.getTenantSettings('tenant-x');
      expect(row).toStrictEqual({
        tenantId: 'tenant-x',
        features: { interactive: 'preview' },
        updatedAt: '2026-05-11T00:00:00.000Z',
        updatedBy: 'u1',
      });
    });

    it('persists for superadmin setting ga on any tenant', async () => {
      const { redirects, store } = setup({
        actor: { role: 'superadmin', org: 'admin-org', sub: 'admin-1' },
      });
      await runAction(makeFormData({ tenantId: 'tenant-z', value: 'ga' }));
      expect(redirects[0]?.url).toBe('/admin/tenant-settings?tenantId=tenant-z&status=updated');
      const row = await store.getTenantSettings('tenant-z');
      expect(row?.features.interactive).toBe('ga');
      expect(row?.updatedBy).toBe('admin-1');
    });

    it('overwrites an existing row in place', async () => {
      const store = new InMemoryTenantSettingsStore();
      await store.putTenantSettings({
        tenantId: 'tenant-x',
        features: { interactive: 'preview' },
        updatedAt: '2026-01-01T00:00:00.000Z',
        updatedBy: 'old-actor',
      });
      const { redirects } = setup({
        actor: { role: 'admin', org: 'tenant-x', sub: 'u1' },
        store,
      });
      await runAction(makeFormData({ tenantId: 'tenant-x', value: 'disabled' }));
      expect(redirects[0]?.url).toBe('/admin/tenant-settings?tenantId=tenant-x&status=updated');
      const row = await store.getTenantSettings('tenant-x');
      expect(row).toStrictEqual({
        tenantId: 'tenant-x',
        features: { interactive: 'disabled' },
        updatedAt: '2026-05-11T00:00:00.000Z',
        updatedBy: 'u1',
      });
    });
  });
});
