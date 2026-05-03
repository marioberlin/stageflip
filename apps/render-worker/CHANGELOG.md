# @stageflip/app-render-worker

## 0.1.0

### Minor Changes

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

- Updated dependencies [c332968]
- Updated dependencies [5bad3e5]
- Updated dependencies [bab709d]
- Updated dependencies [d5f0751]
- Updated dependencies [c0f1b01]
- Updated dependencies [9310860]
  - @stageflip/export-html5-zip@0.1.0
  - @stageflip/export-video@0.1.0
