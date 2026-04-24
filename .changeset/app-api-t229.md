---
"@stageflip/app-api": minor
---

T-229: `apps/api` — Hono API with Firebase-Admin + MCP-JWT auth.

The API service ships three building blocks:

- `createPrincipalVerifier` — accepts a Bearer token and resolves
  to either an `mcp-session` (T-223 JWT) or a `firebase` principal.
  MCP path runs first (cheap, in-process); structural failures
  fall through to Firebase; expired MCP tokens return 401 without
  falling through. `UnauthorizedError.reason` distinguishes
  missing / malformed / expired / invalid-signature /
  verification-failed.
- `authMiddleware` — Hono middleware that attaches the verified
  principal to `c.var.principal` and returns a structured 401 on
  failure. Optional `allow(principal)` guard yields 403.
- `createMcpSessionRoute` — the `/auth/mcp-session` mint endpoint
  T-224's `createGoogleAuthProvider` POSTs to. Verifies the Google
  id-token via injected Firebase verifier, resolves to a StageFlip
  principal (user + org + role + allowedBundles), mints a short-
  lived MCP session JWT.

Composition (listen port + graceful shutdown) is deliberately not
in this package — Cloud Run wiring is T-231.

18 unit tests across verify (7) + middleware (6) + mint endpoint
(5). Firebase Admin is mocked in every test; CI never hits
accounts.google.com.

Also fixes a bug in `scripts/check-licenses.ts` — dual-licensed
packages like `node-forge@1.4.0` (`BSD-3-Clause OR GPL-2.0`) were
flagged forbidden because the classifier ORed allowed + forbidden
tokens together. The classifier now splits on OR (the licensor's
offer to us), classifies each branch independently, and accepts
the package if ANY branch is fully allowed.
