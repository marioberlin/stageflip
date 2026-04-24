// packages/plugin/src/google-auth.ts
// T-224 — GoogleAuthProvider. Implements the AuthProvider seam from
// @stageflip/mcp-server against Google's OIDC endpoints.
//
// Why Google? apps/api already uses Firebase (Google-backed), so the
// identity universe + consent screen is already procured on Google;
// adding GitHub/Okta later is a drop-in against the same interface.
//
// Contract (T-223 AuthProvider):
//   - `authorizationUrl(args)` → Google OIDC authorize URL with the
//     PKCE challenge + scope("openid email profile") + access_type=offline.
//   - `exchange({ code, codeVerifier })` → POST to oauth2.googleapis.com/token.
//   - `mintSessionJwt({ idToken, accessToken })` → POST to apps/api's
//     mint endpoint, which validates the id-token, looks up the
//     stageflip user + org, and returns a session JWT signed by our
//     shared secret (see T-223 jwt.ts).

import type {
  AuthProvider,
  AuthorizationUrlArgs,
  ExchangeCodeArgs,
  ExchangeCodeResult,
  MintSessionJwtArgs,
} from '@stageflip/mcp-server';

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const SCOPES = ['openid', 'email', 'profile'].join(' ');

export interface GoogleAuthProviderConfig {
  readonly clientId: string;
  readonly redirectUri: string;
  /** StageFlip API endpoint that exchanges a Google id-token for a session JWT. */
  readonly apiMintUrl: string;
  /** Override for tests — defaults to the global `fetch`. */
  readonly fetchFn?: typeof fetch;
}

export function createGoogleAuthProvider(config: GoogleAuthProviderConfig): AuthProvider {
  const fetchFn = config.fetchFn ?? fetch;

  return {
    issuer: 'google',

    authorizationUrl(args: AuthorizationUrlArgs): string {
      const url = new URL(GOOGLE_AUTH_URL);
      url.searchParams.set('client_id', config.clientId);
      url.searchParams.set('redirect_uri', config.redirectUri);
      url.searchParams.set('response_type', 'code');
      url.searchParams.set('scope', SCOPES);
      url.searchParams.set('access_type', 'offline');
      url.searchParams.set('code_challenge', args.codeChallenge);
      url.searchParams.set('code_challenge_method', args.codeChallengeMethod);
      return url.toString();
    },

    async exchange(args: ExchangeCodeArgs): Promise<ExchangeCodeResult> {
      const body = new URLSearchParams({
        code: args.code,
        code_verifier: args.codeVerifier,
        client_id: config.clientId,
        redirect_uri: config.redirectUri,
        grant_type: 'authorization_code',
      });
      const response = await fetchFn(GOOGLE_TOKEN_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      });
      if (!response.ok) {
        const detail = await response.text().catch(() => '');
        throw new Error(
          `Google token exchange failed: ${response.status} ${response.statusText} ${detail}`.trim(),
        );
      }
      const parsed = (await response.json()) as {
        access_token?: string;
        refresh_token?: string;
        id_token?: string;
      };
      if (!parsed.access_token || !parsed.id_token) {
        throw new Error('Google token exchange: missing access_token or id_token');
      }
      return {
        accessToken: parsed.access_token,
        refreshToken: parsed.refresh_token ?? '',
        idToken: parsed.id_token,
      };
    },

    async mintSessionJwt(args: MintSessionJwtArgs): Promise<string> {
      const response = await fetchFn(config.apiMintUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ idToken: args.idToken, accessToken: args.accessToken }),
      });
      if (!response.ok) {
        const detail = await response.text().catch(() => '');
        throw new Error(
          `StageFlip mint endpoint failed: ${response.status} ${response.statusText} ${detail}`.trim(),
        );
      }
      const parsed = (await response.json()) as { jwt?: string };
      if (!parsed.jwt) {
        throw new Error('StageFlip mint endpoint: response missing jwt field');
      }
      return parsed.jwt;
    },
  };
}
