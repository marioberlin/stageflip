// packages/plugin/src/google-auth.test.ts
// T-224 — GoogleAuthProvider implements the AuthProvider seam from
// @stageflip/mcp-server against Google OIDC endpoints. Tests mock
// the HTTP surface so CI never calls accounts.google.com.

import { describe, expect, it, vi } from 'vitest';

import { createGoogleAuthProvider } from './google-auth.js';

const CONFIG = {
  clientId: 'client-abc.apps.googleusercontent.com',
  redirectUri: 'https://stageflip.dev/oauth/callback',
  apiMintUrl: 'https://api.stageflip.dev/auth/mcp-session',
} as const;

function okJson<T>(body: T): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

describe('GoogleAuthProvider.authorizationUrl', () => {
  it('targets Google OIDC with the mandated Google query params + PKCE challenge', () => {
    const provider = createGoogleAuthProvider(CONFIG);
    const url = new URL(
      provider.authorizationUrl({ codeChallenge: 'abc', codeChallengeMethod: 'S256' }),
    );
    expect(url.origin + url.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth');
    expect(url.searchParams.get('client_id')).toBe(CONFIG.clientId);
    expect(url.searchParams.get('redirect_uri')).toBe(CONFIG.redirectUri);
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('scope')).toMatch(/openid.+email.+profile/);
    expect(url.searchParams.get('code_challenge')).toBe('abc');
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.searchParams.get('access_type')).toBe('offline');
  });

  it('emits issuer "google" for the token store tag', () => {
    const provider = createGoogleAuthProvider(CONFIG);
    expect(provider.issuer).toBe('google');
  });
});

describe('GoogleAuthProvider.exchange', () => {
  it('POSTs form-encoded body to Google token endpoint with code + verifier', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      okJson({
        access_token: 'at',
        refresh_token: 'rt',
        id_token: 'id',
        expires_in: 3600,
      }),
    );
    const provider = createGoogleAuthProvider({ ...CONFIG, fetchFn: fetchMock });

    const result = await provider.exchange({ code: 'the-code', codeVerifier: 'the-verifier' });
    expect(result).toEqual({ accessToken: 'at', refreshToken: 'rt', idToken: 'id' });

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(String(url)).toBe('https://oauth2.googleapis.com/token');
    expect(init?.method).toBe('POST');
    expect(
      String(init?.headers && (init.headers as Record<string, string>)['content-type']),
    ).toContain('application/x-www-form-urlencoded');
    const body = new URLSearchParams(String(init?.body));
    expect(body.get('code')).toBe('the-code');
    expect(body.get('code_verifier')).toBe('the-verifier');
    expect(body.get('client_id')).toBe(CONFIG.clientId);
    expect(body.get('grant_type')).toBe('authorization_code');
  });

  it('throws a descriptive error when Google returns a non-200', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ error: 'invalid_grant' }), {
        status: 400,
        headers: { 'content-type': 'application/json' },
      }),
    );
    const provider = createGoogleAuthProvider({ ...CONFIG, fetchFn: fetchMock });
    await expect(provider.exchange({ code: 'c', codeVerifier: 'v' })).rejects.toThrow(
      /invalid_grant|400|token exchange/i,
    );
  });
});

describe('GoogleAuthProvider.mintSessionJwt', () => {
  it('POSTs the id_token + access_token to the StageFlip API mint endpoint', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(okJson({ jwt: 'minted.jwt.here' }));
    const provider = createGoogleAuthProvider({ ...CONFIG, fetchFn: fetchMock });

    const jwt = await provider.mintSessionJwt({ idToken: 'id', accessToken: 'at' });
    expect(jwt).toBe('minted.jwt.here');

    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(String(url)).toBe(CONFIG.apiMintUrl);
    expect(init?.method).toBe('POST');
    const body = JSON.parse(String(init?.body)) as { idToken: string; accessToken: string };
    expect(body.idToken).toBe('id');
    expect(body.accessToken).toBe('at');
  });

  it('throws when the mint endpoint returns no jwt field', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(okJson({}));
    const provider = createGoogleAuthProvider({ ...CONFIG, fetchFn: fetchMock });
    await expect(provider.mintSessionJwt({ idToken: 'id', accessToken: 'at' })).rejects.toThrow(
      /jwt|mint|response/i,
    );
  });
});
