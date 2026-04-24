// packages/mcp-server/src/auth/flow.ts
// T-223 — OAuth 2.0 Authorization Code + PKCE flow orchestrator. The
// concrete identity provider (Google Workspace, GitHub, Okta) is
// abstracted behind `AuthProvider` so the plugin can pick per-deploy.
// Real providers land in T-224; this task ships the interface + a
// mock implementation exercised by the flow tests.
//
// Flow:
//   1. Generate PKCE verifier + derive S256 challenge.
//   2. Build the provider's authorization URL (challenge embedded).
//   3. Redirect the user (CLI: open in browser; interactive: inline).
//   4. Receive the authcode via the redirect handler.
//   5. Exchange code + verifier for provider tokens.
//   6. Our API mints a stageflip session JWT from the provider's
//      id token.
//   7. Verify the JWT (catches secret misconfig early).
//   8. Persist `{ jwt, refreshToken, expiresAt, issuer, profile }` to
//      the local token store.

import { verifyMcpSessionJwt } from './jwt.js';
import { derivePkceChallenge, generatePkceVerifier } from './pkce.js';
import type { StoredToken, TokenStore } from './store.js';

export interface AuthorizationUrlArgs {
  readonly codeChallenge: string;
  readonly codeChallengeMethod: 'S256';
}

export interface ExchangeCodeArgs {
  readonly code: string;
  readonly codeVerifier: string;
}

export interface ExchangeCodeResult {
  readonly accessToken: string;
  readonly refreshToken: string;
  /** Opaque id-token payload handed to `mintSessionJwt`. */
  readonly idToken: string;
}

export interface MintSessionJwtArgs {
  readonly idToken: string;
  readonly accessToken: string;
}

/**
 * Pluggable identity-provider surface. Concrete implementations wrap
 * Google / GitHub / Okta / etc. The `mintSessionJwt` step goes through
 * `apps/api` — the provider's id-token is not what MCP sessions
 * consume; our API converts it into a stageflip-signed session JWT.
 */
export interface AuthProvider {
  readonly issuer: string;
  /** Produce a full authorization URL for the user to visit. */
  authorizationUrl(args: AuthorizationUrlArgs): string;
  /** Exchange the authcode (plus PKCE verifier) for provider tokens. */
  exchange(args: ExchangeCodeArgs): Promise<ExchangeCodeResult>;
  /**
   * Ship the provider's id-token to our API; receive back a signed
   * stageflip session JWT.
   */
  mintSessionJwt(args: MintSessionJwtArgs): Promise<string>;
}

/**
 * Mock IdP for tests. Callers override the `exchange` + `mintSessionJwt`
 * steps; URL building is a deterministic stub.
 */
export class MockAuthProvider implements AuthProvider {
  readonly issuer: string;
  private readonly baseAuthUrl: string;
  readonly exchange: AuthProvider['exchange'];
  readonly mintSessionJwt: AuthProvider['mintSessionJwt'];

  constructor(args: {
    issuer: string;
    baseAuthUrl?: string;
    exchange: AuthProvider['exchange'];
    mintSessionJwt: AuthProvider['mintSessionJwt'];
  }) {
    this.issuer = args.issuer;
    this.baseAuthUrl = args.baseAuthUrl ?? 'https://idp.example.test/authorize';
    this.exchange = args.exchange;
    this.mintSessionJwt = args.mintSessionJwt;
  }

  authorizationUrl(args: AuthorizationUrlArgs): string {
    const url = new URL(this.baseAuthUrl);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('code_challenge', args.codeChallenge);
    url.searchParams.set('code_challenge_method', args.codeChallengeMethod);
    return url.toString();
  }
}

export interface RunAuthFlowArgs {
  readonly provider: AuthProvider;
  readonly store: TokenStore;
  /**
   * Present the URL to the user (browser open, inline prompt, etc.)
   * and return the authcode the redirect callback received.
   */
  readonly redirectHandler: (url: string) => Promise<string>;
  /** Profile name for the token store; single-profile installs pass `"default"`. */
  readonly profile: string;
  /**
   * If provided, the minted JWT is verified against this secret before
   * being written to the store. Production callers always set this.
   * Left optional for tests that want to skip verification.
   */
  readonly verifySecret?: string;
  /** Override `Date.now()` for deterministic tests. */
  readonly now?: () => number;
}

export interface RunAuthFlowResult {
  readonly profile: string;
  readonly token: StoredToken;
}

/**
 * Drive the OAuth round-trip. Returns the persisted token; consumers can
 * also call `store.load()` later from an arbitrary process.
 */
export async function runAuthFlow(args: RunAuthFlowArgs): Promise<RunAuthFlowResult> {
  const { provider, store, redirectHandler, profile, verifySecret } = args;
  const now = args.now ?? (() => Date.now());

  const codeVerifier = generatePkceVerifier();
  const codeChallenge = derivePkceChallenge(codeVerifier);

  const authUrl = provider.authorizationUrl({
    codeChallenge,
    codeChallengeMethod: 'S256',
  });

  let code: string;
  try {
    code = await redirectHandler(authUrl);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`OAuth redirect handler failed: ${message}`);
  }

  const { accessToken, refreshToken, idToken } = await provider.exchange({
    code,
    codeVerifier,
  });

  const jwt = await provider.mintSessionJwt({ idToken, accessToken });

  if (verifySecret !== undefined) {
    // Throws on bad signature / expired / wrong typ — surface immediately
    // so operators catch secret misconfiguration at login time rather than
    // first tool-call time.
    const verified = await verifyMcpSessionJwt({ secret: verifySecret, token: jwt });
    if (verified.exp * 1000 <= now()) {
      throw new Error('OAuth flow returned an already-expired JWT');
    }
  }

  const token: StoredToken = {
    jwt,
    refreshToken,
    // Rough placeholder expiresAt — real consumers should prefer the
    // JWT's own `exp` via `verifyMcpSessionJwt`. We keep this for the
    // typical "does the stored token look expired" fast path.
    expiresAt: Math.floor(now() / 1000) + 3600,
    issuer: provider.issuer,
    profile,
  };

  await store.save(token);

  return { profile, token };
}
