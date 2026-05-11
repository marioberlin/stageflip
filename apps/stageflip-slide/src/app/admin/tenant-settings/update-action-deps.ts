// apps/stageflip-slide/src/app/admin/tenant-settings/update-action-deps.ts
// T-411e — non-action helpers for the server action. Lives in its own
// module because `'use server'` files (next/server-action contract) may
// only export async functions; this file holds the `Required<...>`
// dependency container + test hook.

import type { TenantSettingsStore } from '@stageflip/storage';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { type AdminActor, resolveAdminActorOrTestOverride } from '../../../lib/admin-auth';
import { getStore } from './store';

/**
 * Test-injectable dependencies. Production runtime uses the defaults;
 * tests call `setUpdateActionDeps(...)` to swap any subset.
 */
export interface UpdateActionDeps {
  resolveActor?(): Promise<AdminActor | null>;
  store?: TenantSettingsStore;
  now?(): string;
  /** Override the redirect sink — tests stub this to capture the URL. */
  redirectFn?(url: string): never;
  /** Override the revalidate sink — tests stub this to capture the path. */
  revalidate?(path: string): void;
}

export interface ResolvedUpdateActionDeps {
  resolveActor(): Promise<AdminActor | null>;
  store: TenantSettingsStore;
  now(): string;
  redirectFn(url: string): never;
  revalidate(path: string): void;
}

let deps: ResolvedUpdateActionDeps = freshDefaults();

function freshDefaults(): ResolvedUpdateActionDeps {
  return {
    resolveActor: resolveAdminActorOrTestOverride,
    store: getStore(),
    now: () => new Date().toISOString(),
    redirectFn: redirect,
    revalidate: revalidatePath,
  };
}

export function getUpdateActionDeps(): ResolvedUpdateActionDeps {
  return deps;
}

/** Test hook: swap any subset of deps. Pass an empty object to reset to defaults. */
export function setUpdateActionDeps(next: UpdateActionDeps): void {
  const fresh = freshDefaults();
  deps = {
    resolveActor: next.resolveActor ?? fresh.resolveActor,
    store: next.store ?? fresh.store,
    now: next.now ?? fresh.now,
    redirectFn: next.redirectFn ?? fresh.redirectFn,
    revalidate: next.revalidate ?? fresh.revalidate,
  };
}
