// tests/load/auth.js
// AC #10 — K6 helper that builds Authorization + X-Org-Id headers per T-262.
//
// Convention (T-262 / D-T262-2):
//   Authorization: Bearer <jwt-or-api-key>
//   X-Org-Id: <orgId>
//
// JWTs and API keys travel under the same `Bearer` scheme — T-262
// resolve-principal disambiguates them via prefix detection. We do not need
// to know the kind here. The `kind` field is accepted for documentation
// purposes only.
//
// This file has zero K6 imports so unit tests (auth.test.ts) can import it
// directly via vitest. helpers.js re-exports `authHeaders` from here.

/**
 * @param {{ token: string, orgId: string, kind?: 'jwt' | 'apiKey' }} opts
 * @returns {Record<string, string>}
 */
export function authHeaders(opts) {
  // `kind` is accepted but not used to alter the wire shape — both JWTs and
  // api-keys use Bearer per T-262 resolve-principal.
  void opts.kind;
  return {
    Authorization: `Bearer ${opts.token}`,
    'X-Org-Id': opts.orgId,
    'Content-Type': 'application/json',
  };
}
