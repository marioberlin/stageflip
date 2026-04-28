// tests/load/auth.d.ts
// Hand-authored types for auth.js (consumed by auth.test.ts).

export interface AuthHeaderOpts {
  token: string;
  orgId: string;
  kind?: 'jwt' | 'apiKey';
}

export function authHeaders(opts: AuthHeaderOpts): Record<string, string>;
