# @stageflip/app-api

## 0.1.0

### Minor Changes

- 219f8ec: T-229: `apps/api` — Hono API with Firebase-Admin + MCP-JWT auth.

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

- e40ee8c: T-231: Cloud Run deployment — API service + render-worker job.

  `apps/api` is now fully composed: `createApp(config)` builds a Hono
  app with `/healthz`, `/auth/mcp-session`, and `/v1/*` protected by
  the T-229 middleware. `src/bin.ts` is the Cloud Run container
  entrypoint — reads `STAGEFLIP_JWT_SECRET`, `PORT`, initialises
  Firebase Admin, handles `SIGTERM`/`SIGINT` gracefully.

  New `apps/render-worker` — Cloud Run Job image. Reads a JSON render
  payload from `CLOUD_RUN_TASK_PAYLOAD` (or stdin), validates against
  a discriminated union Zod schema (html5-zip | video), and will
  dispatch to `@stageflip/export-*` (dispatch implementation is a
  T-231 follow-up).

  Two production Dockerfiles (multi-stage, node:22-alpine, non-root
  runtime user, pnpm deploy for clean `dist/` + prod `node_modules`).

  `.github/workflows/deploy.yml` runs on main + `workflow_dispatch`.
  A preflight `check-secrets` job inspects `GCP_WORKLOAD_IDENTITY_PROVIDER`
  - `GCP_SERVICE_ACCOUNT`; absent those, deploy skips with a
    workflow notice. When both are set, the matrix builds + pushes to
    Artifact Registry + deploys each service (Cloud Run service for
    api, Cloud Run job for render-worker). No long-lived service-
    account keys — federated auth via Workload Identity Federation.

  Tests: 22 api (server integration added), 6 render-worker (job
  schema), 15 infra (Dockerfile shape + deploy-workflow shape).
  Full `docker build` runs in the deploy workflow.

### Patch Changes

- Updated dependencies [e7b91d0]
- Updated dependencies [2e1e7d6]
- Updated dependencies [36d0c5d]
  - @stageflip/mcp-server@0.1.0
