# tests/load — K6 load tests (T-269)

K6-based load tests for the three load-bearing surfaces of StageFlip:

| Scenario | What it loads | Threshold (full) |
|---|---|---|
| `collab-sync.js` | Yjs delta fan-out via WebSocket | P95 round-trip < 200 ms |
| `render-submit.js` | BullMQ queue ingress (`POST /api/render`) | P95 accept < 100 ms; err < 0.5 % |
| `api-mixed.js` | 60/30/10 read/write/auth mix | no 5xx; honours 429 + Retry-After |

Two run profiles share the same scenarios:

| Profile | Trigger | Params | Duration |
|---|---|---|---|
| `smoke` | CI on `tests/load/**` change | 10 VUs each | 60 s × 3 |
| `full` | `pnpm load:full` (manual) | 50 VUs each | 5 min × 3 |

## Install K6

K6 is a Go binary, not an npm package. Install per host:

```bash
# macOS
brew install k6

# Linux (Debian / Ubuntu)
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update && sudo apt-get install k6

# CI: handled by .github/workflows/load-smoke.yml via grafana/setup-k6-action@v1
```

Verify: `k6 version`.

## Required env vars (full-load against staging)

| Var | Purpose |
|---|---|
| `STAGEFLIP_LOAD_TARGET` | base URL of the staging tenant (e.g. `https://staging.stageflip.local`) |
| `STAGEFLIP_LOAD_AUTH_TOKEN` | JWT or api-key with admin scope on the test org |
| `STAGEFLIP_LOAD_ORG_ID` | orgId seeded with load-test data |
| `STAGEFLIP_LOAD_PROFILE` | `smoke` (default) or `full` |
| `STAGEFLIP_LOAD_DOC_ID` | optional; defaults to `loaddoc-0000` |
| `STAGEFLIP_LOAD_USERS` | seeder; default 50 |
| `STAGEFLIP_LOAD_DOCUMENTS` | seeder; default 100 |

## Operator runbook

```bash
# 1. Seed the staging tenant (idempotent — safe to re-run).
export STAGEFLIP_LOAD_TARGET=https://staging.stageflip.local
export STAGEFLIP_LOAD_AUTH_TOKEN=<admin-token>
export STAGEFLIP_LOAD_ORG_ID=org-load
pnpm load:seed

# 2. Run the full-load scenarios. Each emits a JSON summary under
#    tests/load/runs/<timestamp>.json (gitignored).
pnpm load:full

# 3. Cleanup when finished. Idempotent.
pnpm load:cleanup
```

Smoke runs work locally without a staging tenant — every K6 HTTP / WS call
will fail (no DNS), but the scenarios + threshold shape can be validated:

```bash
pnpm load:smoke
```

For pure structural validation (no network, no VUs), use:

```bash
k6 archive tests/load/scenarios/api-mixed.js
```

This is what CI runs as the always-on gate.

## Output location

`tests/load/runs/*.json` (per-run summary; gitignored).
The CI smoke workflow uploads them as a 7-day GitHub artifact named
`load-smoke-summaries-<sha>` (live runs) or `load-smoke-archives-<sha>`
(archive-only runs).

## Operator notes

- **Retry-after handling**: every HTTP request goes through
  `helpers.requestWithRetryAfter`, which honours T-263's wire shape
  (`{ code: 'RATE_LIMITED', tier, retryAfterSeconds }`) and the
  `Retry-After` header. Bounded at 3 retries with min 1 s / max 30 s
  per sleep to prevent tight-loop DDoS of the staging tenant.
- **Determinism scan**: `tests/load/**` is exempt (D-T269-5). The K6
  scenarios use `Math.random()` for action selection — by design.
- **Auth + tenancy**: `helpers.authHeaders({ token, orgId })` emits the
  T-262 wire shape (`Authorization: Bearer <tok>` + `X-Org-Id`).

## File layout

```
tests/load/
  README.md                  # this file
  package.json               # @stageflip/tests-load workspace
  tsconfig.json              # TS config for helpers + tests
  vitest.config.ts           # vitest with v8 coverage
  helpers.js                 # K6 helpers (auth, retry-after wrapper)
  auth.js                    # auth-header builder
  retry-after.js             # 429 parser (header + body)
  thresholds.js              # per-scenario K6 threshold config
  seed.ts                    # idempotent seeder (Node, not K6)
  cleanup.ts                 # idempotent cleanup (Node)
  cli/
    seed-cli.ts              # `pnpm load:seed`
    cleanup-cli.ts           # `pnpm load:cleanup`
  scenarios/
    collab-sync.js           # K6 WS scenario
    render-submit.js         # K6 HTTP queue ingress
    api-mixed.js             # K6 60/30/10 mix
  runs/                      # JSON summaries; gitignored
  *.test.ts                  # vitest unit tests for TS helpers
  *.d.ts                     # hand-authored types for the JS modules
```

## Related skills

- `skills/stageflip/concepts/observability/SKILL.md` — load-test results
  feed the same OTel pipeline as production traces.
- `skills/stageflip/concepts/rate-limits/SKILL.md` — wire shape honoured
  by `requestWithRetryAfter`.
- `skills/stageflip/concepts/auth/SKILL.md` — header conventions used
  by `authHeaders`.
