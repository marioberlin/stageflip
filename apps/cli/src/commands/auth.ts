// apps/cli/src/commands/auth.ts
// T-225 — login / logout / whoami. Wraps T-223 runAuthFlow +
// createFileTokenStore + T-224 createGoogleAuthProvider. The
// `redirectHandler` opens the browser; the injected flow seams make
// the whole thing mockable in tests.

import { spawn } from 'node:child_process';

import {
  type AuthProvider,
  type TokenStore,
  createFileTokenStore,
  defaultTokenStorePath,
  runAuthFlow,
  verifyMcpSessionJwt,
} from '@stageflip/mcp-server';
import { createGoogleAuthProvider } from '@stageflip/plugin';

import type { CliRunContext } from '../types.js';

export interface AuthCommandDeps {
  readonly createProvider?: (env: CliRunContext['env']) => AuthProvider;
  readonly openBrowser?: (url: string) => Promise<string>;
  readonly createStore?: (env: CliRunContext['env']) => TokenStore;
}

export function createAuthCommands(deps: AuthCommandDeps = {}) {
  const createProvider = deps.createProvider ?? defaultProvider;
  const openBrowser = deps.openBrowser ?? defaultOpenBrowser;
  const createStore = deps.createStore ?? defaultStore;

  async function runLogin(ctx: CliRunContext): Promise<number> {
    const store = createStore(ctx.env);
    const provider = createProvider(ctx.env);
    try {
      const result = await runAuthFlow({
        provider,
        store,
        redirectHandler: openBrowser,
        profile: String(ctx.flags.profile ?? 'default'),
      });
      ctx.env.log(`logged in — profile "${result.profile}" (issuer: ${result.token.issuer})`);
      return 0;
    } catch (err) {
      ctx.env.error(`login failed: ${err instanceof Error ? err.message : String(err)}`);
      return 1;
    }
  }

  async function runLogout(ctx: CliRunContext): Promise<number> {
    const store = createStore(ctx.env);
    await store.clear();
    ctx.env.log('logged out — local token store cleared');
    return 0;
  }

  async function runWhoami(ctx: CliRunContext): Promise<number> {
    const store = createStore(ctx.env);
    const token = await store.load();
    if (!token) {
      ctx.env.error('not logged in — run `stageflip login`');
      return 1;
    }
    const secret = ctx.env.env.STAGEFLIP_JWT_SECRET;
    if (secret) {
      try {
        const verified = await verifyMcpSessionJwt({ secret, token: token.jwt });
        ctx.env.log(`${verified.sub}  org=${verified.org}  role=${verified.role}`);
        ctx.env.log(`issuer=${token.issuer}  profile=${token.profile}`);
        return 0;
      } catch (err) {
        ctx.env.error(
          `token verification failed: ${err instanceof Error ? err.message : String(err)}`,
        );
        return 1;
      }
    }
    // Best-effort: print the stored metadata without verifying the claim.
    ctx.env.log(`issuer=${token.issuer}  profile=${token.profile}  expiresAt=${token.expiresAt}`);
    ctx.env.log('(set STAGEFLIP_JWT_SECRET to verify the JWT body)');
    return 0;
  }

  return { runLogin, runLogout, runWhoami };
}

function defaultProvider(env: CliRunContext['env']): AuthProvider {
  return createGoogleAuthProvider({
    clientId: env.env.STAGEFLIP_GOOGLE_CLIENT_ID ?? '',
    redirectUri: env.env.STAGEFLIP_OAUTH_REDIRECT ?? 'http://localhost:7654/oauth/callback',
    apiMintUrl: env.env.STAGEFLIP_MINT_URL ?? 'https://api.stageflip.dev/auth/mcp-session',
  });
}

function defaultStore(env: CliRunContext['env']): TokenStore {
  return createFileTokenStore({ path: defaultTokenStorePath(env.env.HOME) });
}

async function defaultOpenBrowser(url: string): Promise<string> {
  // Fire-and-forget: open the OS browser; caller is expected to paste
  // the authcode back. The CLI's "paste authcode" prompt lands in
  // T-225 follow-up — the stub returns a placeholder that makes any
  // real flow fail noisily rather than pretend to succeed.
  const opener =
    process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';
  try {
    spawn(opener, [url], { detached: true, stdio: 'ignore' }).unref();
  } catch {
    // ignore — the URL is already printed for the user
  }
  throw new Error(
    'interactive authcode-paste loop not yet wired — set STAGEFLIP_OAUTH_REDIRECT_HANDLER or run a non-interactive test env',
  );
}
