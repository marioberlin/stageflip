// apps/stageflip-slide/src/lib/admin-auth.test.ts
// T-411e — env-var stub coverage for the admin actor resolver.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  resolveAdminActor,
  resolveAdminActorOrTestOverride,
  setAdminActorForTest,
} from './admin-auth';

const ENV_KEYS = ['STAGEFLIP_ADMIN_ROLE', 'STAGEFLIP_ADMIN_ORG', 'STAGEFLIP_ADMIN_SUB'] as const;

function clearEnv(): void {
  for (const key of ENV_KEYS) delete process.env[key];
}

describe('resolveAdminActor (env-var stub)', () => {
  beforeEach(clearEnv);
  afterEach(() => {
    clearEnv();
    setAdminActorForTest(undefined);
  });

  it('returns null when no env vars are set', async () => {
    expect(await resolveAdminActor()).toBeNull();
  });

  it('returns null when only role is set', async () => {
    process.env.STAGEFLIP_ADMIN_ROLE = 'admin';
    expect(await resolveAdminActor()).toBeNull();
  });

  it('returns null when only role + org are set', async () => {
    process.env.STAGEFLIP_ADMIN_ROLE = 'admin';
    process.env.STAGEFLIP_ADMIN_ORG = 'tenant-x';
    expect(await resolveAdminActor()).toBeNull();
  });

  it('returns the parsed actor when all three env vars are set', async () => {
    process.env.STAGEFLIP_ADMIN_ROLE = 'superadmin';
    process.env.STAGEFLIP_ADMIN_ORG = 'tenant-y';
    process.env.STAGEFLIP_ADMIN_SUB = 'user-42';
    expect(await resolveAdminActor()).toStrictEqual({
      role: 'superadmin',
      org: 'tenant-y',
      sub: 'user-42',
    });
  });

  it('test-override short-circuits the env-var read (override wins when set)', async () => {
    process.env.STAGEFLIP_ADMIN_ROLE = 'admin';
    process.env.STAGEFLIP_ADMIN_ORG = 'env-org';
    process.env.STAGEFLIP_ADMIN_SUB = 'env-user';
    setAdminActorForTest({ role: 'viewer', org: 'override-org', sub: 'override-user' });
    expect(await resolveAdminActorOrTestOverride()).toStrictEqual({
      role: 'viewer',
      org: 'override-org',
      sub: 'override-user',
    });
  });

  it('test-override of null forces unauthenticated even with env vars set', async () => {
    process.env.STAGEFLIP_ADMIN_ROLE = 'admin';
    process.env.STAGEFLIP_ADMIN_ORG = 'env-org';
    process.env.STAGEFLIP_ADMIN_SUB = 'env-user';
    setAdminActorForTest(null);
    expect(await resolveAdminActorOrTestOverride()).toBeNull();
  });

  it('clearing the test-override falls back to env vars', async () => {
    setAdminActorForTest({ role: 'admin', org: 'a', sub: 'b' });
    setAdminActorForTest(undefined);
    process.env.STAGEFLIP_ADMIN_ROLE = 'editor';
    process.env.STAGEFLIP_ADMIN_ORG = 'env-org';
    process.env.STAGEFLIP_ADMIN_SUB = 'env-user';
    expect(await resolveAdminActorOrTestOverride()).toStrictEqual({
      role: 'editor',
      org: 'env-org',
      sub: 'env-user',
    });
  });
});
