---
"@stageflip/mcp-server": minor
---

T-223: MCP auth flow — OAuth → JWT → local config.

New surfaces under `@stageflip/mcp-server`:

- `issueMcpSessionJwt` / `verifyMcpSessionJwt` — HS256-signed session
  JWTs with `typ: mcp-session`, `iss: stageflip`, standard `sub`/`exp`/
  `iat` plus `org`, `role`, `allowedBundles`.
- `createFileTokenStore` — persists `~/.config/stageflip/auth.json` at
  mode 0600; `defaultTokenStorePath` honours `XDG_CONFIG_HOME` / `APPDATA` /
  `STAGEFLIP_AUTH_FILE`. Keytar was deliberately rejected — its Linux
  backend (`libsecret`) is LGPL-3.0; OS-keychain integration is a
  Phase-12 follow-up.
- `generatePkceVerifier` / `derivePkceChallenge` — RFC 7636 helpers
  (43–128 char verifier, base64url S256 challenge).
- `AuthProvider` interface + `MockAuthProvider` + `runAuthFlow` — drives
  the Authorization-Code + PKCE round-trip through a pluggable IdP.
  Concrete providers land in T-224.
- `guardMcpSession` + `UnauthorizedError` — verifies the bearer JWT on
  an MCP request and returns `{ principal, allowedBundles }` for the
  adapter's bundle-gate to consume.

30 unit tests across five modules (jwt, store, pkce, flow, guard). All
gates green. Real OAuth round-trips never hit in CI — every test uses
`MockAuthProvider`.
