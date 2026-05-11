// apps/cli/src/commands/tenant.test.ts
// T-411b — `stageflip tenant set-interactive` command tests. Follows the
// render.test.ts capture-buffer CliEnv pattern. The HTTP client is injected
// so no real network is touched.

import { describe, expect, it, vi } from 'vitest';

import type { CliEnv, CliRunContext } from '../types.js';
import { type TenantHttpClient, createTenantCommands } from './tenant.js';

function makeEnv(envVars: Record<string, string | undefined> = {}): {
  env: CliEnv;
  logs: string[];
  errors: string[];
} {
  const logs: string[] = [];
  const errors: string[] = [];
  return {
    logs,
    errors,
    env: {
      cwd: '/tmp/fake',
      env: envVars,
      log: (l) => logs.push(l),
      error: (l) => errors.push(l),
      exit: () => {
        throw new Error('unexpected exit');
      },
    },
  };
}

function makeCtx(
  flags: Record<string, string | boolean | undefined>,
  envVars: Record<string, string | undefined> = {},
): { ctx: CliRunContext; logs: string[]; errors: string[] } {
  const env = makeEnv(envVars);
  return {
    ctx: { env: env.env, args: [], flags },
    logs: env.logs,
    errors: env.errors,
  };
}

function client(impl: TenantHttpClient): { createClient: () => TenantHttpClient } {
  return { createClient: () => impl };
}

describe('runSetInteractive — argument validation', () => {
  it('errors when --tenant is missing', async () => {
    const { runSetInteractive } = createTenantCommands();
    const { ctx, errors } = makeCtx({ value: 'preview' });
    const code = await runSetInteractive(ctx);
    expect(code).toBe(1);
    expect(errors[0]).toMatch(/--tenant/i);
  });

  it('errors when --value is missing', async () => {
    const { runSetInteractive } = createTenantCommands();
    const { ctx, errors } = makeCtx({ tenant: 'tenant-a' });
    const code = await runSetInteractive(ctx);
    expect(code).toBe(1);
    expect(errors[0]).toMatch(/--value/i);
  });

  it('errors when --value is invalid', async () => {
    const { runSetInteractive } = createTenantCommands();
    const { ctx, errors } = makeCtx({ tenant: 'tenant-a', value: 'bogus' });
    const code = await runSetInteractive(ctx);
    expect(code).toBe(1);
    expect(errors[0]).toMatch(/disabled.*preview.*ga/i);
  });
});

describe('runSetInteractive — --dry-run', () => {
  it('prints the would-be call and returns 0 without invoking the client', async () => {
    const fn = vi.fn();
    const { runSetInteractive } = createTenantCommands(client(fn));
    const { ctx, logs } = makeCtx(
      { tenant: 'tenant-a', value: 'preview', 'dry-run': true },
      { STAGEFLIP_API_URL: 'https://api.example' },
    );
    const code = await runSetInteractive(ctx);
    expect(code).toBe(0);
    expect(fn).not.toHaveBeenCalled();
    expect(logs.join('\n')).toMatch(/dry-run/i);
    expect(logs.join('\n')).toMatch(/tenant-a/);
    expect(logs.join('\n')).toMatch(/preview/);
    expect(logs.join('\n')).toMatch(/https:\/\/api\.example/);
  });
});

describe('runSetInteractive — happy path', () => {
  it('POSTs to the right URL with the right body and prints the response', async () => {
    const fn = vi.fn(async () => ({
      status: 200,
      body: {
        tenantId: 'tenant-a',
        features: { interactive: 'preview' },
        updatedAt: '2026-05-11T01:23:45.678Z',
        updatedBy: 'user-1',
      },
    }));
    const { runSetInteractive } = createTenantCommands(client(fn));
    const { ctx, logs } = makeCtx(
      { tenant: 'tenant-a', value: 'preview' },
      {
        STAGEFLIP_API_URL: 'https://api.example',
        STAGEFLIP_API_TOKEN: 'tok-abc',
      },
    );
    const code = await runSetInteractive(ctx);
    expect(code).toBe(0);
    expect(fn).toHaveBeenCalledWith({
      method: 'POST',
      url: 'https://api.example/v1/tenant-settings/tenant-a/interactive',
      token: 'tok-abc',
      body: { value: 'preview' },
    });
    const out = logs.join('\n');
    expect(out).toMatch(/preview/);
    expect(out).toMatch(/tenant-a/);
  });

  it('uses the default API URL when STAGEFLIP_API_URL is unset', async () => {
    const fn = vi.fn(async () => ({ status: 200, body: { ok: true } }));
    const { runSetInteractive } = createTenantCommands(client(fn));
    const { ctx } = makeCtx(
      { tenant: 'tenant-a', value: 'disabled' },
      { STAGEFLIP_API_TOKEN: 'tok' },
    );
    await runSetInteractive(ctx);
    const call = fn.mock.calls[0]?.[0];
    expect(call?.url).toMatch(/^https:\/\/api\.stageflip\.dev\//);
  });
});

describe('runSetInteractive — error paths', () => {
  it('reports a 403 forbidden with the server-supplied reason', async () => {
    const fn = vi.fn(async () => ({
      status: 403,
      body: { error: 'forbidden', reason: 'transitions involving "ga" require superadmin' },
    }));
    const { runSetInteractive } = createTenantCommands(client(fn));
    const { ctx, errors } = makeCtx(
      { tenant: 'tenant-a', value: 'ga' },
      { STAGEFLIP_API_URL: 'https://api.example', STAGEFLIP_API_TOKEN: 'tok' },
    );
    const code = await runSetInteractive(ctx);
    expect(code).toBe(1);
    const err = errors.join('\n');
    expect(err).toMatch(/forbidden/i);
    expect(err).toMatch(/superadmin/i);
  });

  it('reports a 5xx error with status + body summary', async () => {
    const fn = vi.fn(async () => ({ status: 500, body: { error: 'internal' } }));
    const { runSetInteractive } = createTenantCommands(client(fn));
    const { ctx, errors } = makeCtx(
      { tenant: 'tenant-a', value: 'preview' },
      { STAGEFLIP_API_URL: 'https://api.example', STAGEFLIP_API_TOKEN: 'tok' },
    );
    const code = await runSetInteractive(ctx);
    expect(code).toBe(1);
    expect(errors.join('\n')).toMatch(/500/);
  });

  it('reports network errors from the client without crashing', async () => {
    const fn = vi.fn(async () => {
      throw new Error('ECONNREFUSED');
    });
    const { runSetInteractive } = createTenantCommands(client(fn));
    const { ctx, errors } = makeCtx(
      { tenant: 'tenant-a', value: 'preview' },
      { STAGEFLIP_API_URL: 'https://api.example', STAGEFLIP_API_TOKEN: 'tok' },
    );
    const code = await runSetInteractive(ctx);
    expect(code).toBe(1);
    expect(errors.join('\n')).toMatch(/ECONNREFUSED/);
  });

  it('errors when STAGEFLIP_API_TOKEN is unset (and not --dry-run)', async () => {
    const fn = vi.fn(async () => ({ status: 200, body: {} }));
    const { runSetInteractive } = createTenantCommands(client(fn));
    const { ctx, errors } = makeCtx({ tenant: 'tenant-a', value: 'preview' }, {});
    const code = await runSetInteractive(ctx);
    expect(code).toBe(1);
    expect(errors.join('\n')).toMatch(/STAGEFLIP_API_TOKEN/);
    expect(fn).not.toHaveBeenCalled();
  });
});
