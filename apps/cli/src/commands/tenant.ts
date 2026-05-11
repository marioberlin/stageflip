// apps/cli/src/commands/tenant.ts
// T-411b — `stageflip tenant set-interactive` command. Calls the API
// procedure `tenantSettings.setInteractive` over HTTP using the user's
// existing MCP session JWT (carried in STAGEFLIP_API_TOKEN by convention;
// production deployments source it from the file token store created in
// auth.ts — wiring that path is a follow-up).
//
// Authorization is enforced server-side by `canSetInteractive` (see
// apps/api/src/auth/can-set-interactive.ts). The CLI does not duplicate
// the predicate; it surfaces the server's response.

import type { CliRunContext } from '../types.js';

const VALID_VALUES = ['disabled', 'preview', 'ga'] as const;
type InteractiveValue = (typeof VALID_VALUES)[number];

const DEFAULT_API_URL = 'https://api.stageflip.dev';

/**
 * HTTP-call shape the CLI hands to its injected client. Single method to
 * keep the test seam tiny; supports the only call this command makes.
 */
export interface TenantHttpRequest {
  readonly method: 'POST';
  readonly url: string;
  readonly token: string;
  readonly body: unknown;
}

export interface TenantHttpResponse {
  readonly status: number;
  readonly body: unknown;
}

export type TenantHttpClient = (req: TenantHttpRequest) => Promise<TenantHttpResponse>;

export interface TenantCommandDeps {
  /** Inject a custom HTTP client (tests pass a stub). */
  createClient?(): TenantHttpClient;
}

/**
 * Build the `tenant` command handlers. Returned as an object so future
 * subcommands (`tenant get`, `tenant list`) can plug in alongside
 * without changing the call sites.
 */
export function createTenantCommands(deps: TenantCommandDeps = {}) {
  const createClient = deps.createClient ?? defaultClient;

  async function runSetInteractive(ctx: CliRunContext): Promise<number> {
    const tenant = stringFlag(ctx.flags.tenant);
    if (!tenant) {
      ctx.env.error('tenant set-interactive: --tenant <id> is required');
      return 1;
    }
    const value = stringFlag(ctx.flags.value);
    if (!value) {
      ctx.env.error('tenant set-interactive: --value <disabled|preview|ga> is required');
      return 1;
    }
    if (!isInteractiveValue(value)) {
      ctx.env.error(
        `tenant set-interactive: invalid --value "${value}". Expected one of: disabled, preview, ga`,
      );
      return 1;
    }

    const apiUrl = (ctx.env.env.STAGEFLIP_API_URL ?? DEFAULT_API_URL).replace(/\/+$/, '');
    const url = `${apiUrl}/v1/tenant-settings/${encodeURIComponent(tenant)}/interactive`;
    const body = { value };

    if (ctx.flags['dry-run'] === true) {
      ctx.env.log(`tenant set-interactive: dry-run — would POST ${url}`);
      ctx.env.log(`tenant set-interactive: body ${JSON.stringify(body)}`);
      return 0;
    }

    const token = ctx.env.env.STAGEFLIP_API_TOKEN;
    if (!token) {
      ctx.env.error(
        'tenant set-interactive: STAGEFLIP_API_TOKEN is required (run `stageflip login` and export the token, or pass --dry-run)',
      );
      return 1;
    }

    let res: TenantHttpResponse;
    try {
      res = await createClient()({ method: 'POST', url, token, body });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      ctx.env.error(`tenant set-interactive: request failed — ${message}`);
      return 1;
    }

    if (res.status === 200) {
      ctx.env.log(`tenant set-interactive: ok — ${JSON.stringify(res.body)}`);
      return 0;
    }
    if (res.status === 403) {
      const reason =
        typeof res.body === 'object' && res.body !== null && 'reason' in res.body
          ? String((res.body as { reason: unknown }).reason)
          : 'forbidden';
      ctx.env.error(`tenant set-interactive: forbidden — ${reason}`);
      return 1;
    }
    ctx.env.error(
      `tenant set-interactive: unexpected status ${res.status} — ${JSON.stringify(res.body)}`,
    );
    return 1;
  }

  return { runSetInteractive };
}

function stringFlag(value: string | boolean | undefined): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function isInteractiveValue(value: string): value is InteractiveValue {
  return (VALID_VALUES as readonly string[]).includes(value);
}

function defaultClient(): TenantHttpClient {
  return async ({ method, url, token, body }) => {
    const res = await fetch(url, {
      method,
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    let parsed: unknown;
    try {
      parsed = await res.json();
    } catch {
      parsed = null;
    }
    return { status: res.status, body: parsed };
  };
}
