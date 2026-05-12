# Audience-backend SLA load test — operator runbook (T-477)

K6 load-test script driving **1000 concurrent voters** against a deployed
audience-backend to verify the **ADR-009 §D4 SLA target** (p50 < 200 ms,
p95 < 500 ms end-to-end voter-tap → presenter-screen latency).

The script lives at `scripts/loadtest/audience-sla.k6.ts`. It runs
against a **deployed backend** — not an in-process service. Run it
manually before each release that touches the audience pipeline, or via
the `audience-sla-loadtest` GitHub Actions workflow (manual trigger
only; not on PRs).

T-475 covers in-process latency at 10 / 50 / 100 voters via vitest;
T-477 stretches to the 1000-voter SLA edge via K6.

---

## 1. Provisioning the target backend

The load test drives a real audience-backend instance. Provisioning is
**ops-owned**; this script does **not** spin up infrastructure. Defer to
the existing deployment runbook (Cloud Run + Firestore + the Phase 12
`apps/audience-backend` deployment manifest).

Minimum target topology:

- One Cloud Run service hosting `apps/api` (or `apps/audience-backend`
  if split per the T-474 deployment split).
- Firestore in the same project for vote persistence (T-474).
- The deployed URL accessible from the K6 runner (CI runner or ops
  workstation). For HTTPS, the URL form is
  `https://audience-staging.example.com`.

Confirm the backend is healthy before starting:

```sh
curl -fsS "${BACKEND_URL}/v1/audience/sessions/${SESSION_ID}/state" \
  | jq '.tenantId, .closedAt'
```

A `200` response with `closedAt: null` means the session is open and
ready to accept voters.

---

## 2. Tenant prep

Ensure the test tenant has audience-feature settings that admit 1000
voters at the 0.5 Hz vote rate (= 500 Hz aggregate ingest, plus
headroom):

```jsonc
// TenantSettings.features.audience
{
  "enabled": true,
  "maxConcurrentVotersPerSession": 1100,  // 1.1× target headroom
  "maxIngestRateHz": 600                  // 500 Hz target + 20% buffer
}
```

If `maxConcurrentVotersPerSession` is below the VU target, the 1001st
joiner will be rejected with `409 capacity_cap` and the K6 script will
log `join status is 200` check failures. If `maxIngestRateHz` is below
the aggregate rate, votes will be rate-limited at the WebSocket layer
and `vote_ack_latency` will spike (failing the p(95) threshold).

Update via the tenant-settings admin path or directly in Firestore:

```sh
# Example, via your tenant-settings admin tool. Adapt to your shop.
tenant-admin set-audience \
  --tenant <tenant-id> \
  --enabled true \
  --max-concurrent-voters 1100 \
  --max-ingest-rate-hz 600
```

---

## 3. Pre-flight checklist

Run through this list BEFORE invoking K6:

- [ ] **Tenant rate limit set** — `maxConcurrentVotersPerSession ≥ 1100`,
      `maxIngestRateHz ≥ 600`.
- [ ] **Session pre-opened** — `POST /v1/audience/sessions` has created
      `<SESSION_ID>` with `closedAt: null`. Confirmed via `GET .../state`.
- [ ] **Monitoring up** — Cloud Run dashboard, Firestore dashboard, and
      whatever WS-layer metrics endpoint the deployment exposes are open
      in browser tabs.
- [ ] **Alert thresholds noted** — write down the alerting thresholds
      that fire during the run so on-call doesn't get paged. Suggested
      mute window: the 40-min run duration + 10 min cooldown.
- [ ] **K6 binary available** — `k6 version` on the runner reports
      `v0.50+` (TS support).
- [ ] **`BACKEND_URL` resolvable from the runner** — `curl -fsS
      $BACKEND_URL/v1/audience/sessions/$SESSION_ID/state` returns 200.
- [ ] **`@types/k6` installed** for editor type-check (optional —
      runtime resolves the modules itself).

---

## 4. Run

The full 1000-VU run is **40 minutes wall clock** (5 min ramp-up + 30
min hold + 5 min ramp-down).

```sh
k6 run scripts/loadtest/audience-sla.k6.ts \
  --env BACKEND_URL=https://audience-staging.example.com \
  --env SESSION_ID=load-test-session \
  --out json=audience-sla-$(date -u +%Y%m%dT%H%M%SZ).json
```

Tuning knobs (all env vars):

- `BACKEND_URL` — required.
- `SESSION_ID` — defaults to `load-test-session`.
- `VU_TARGET` — defaults to `1000`. Set lower for a partial-load
  rehearsal (e.g. `VU_TARGET=100` for a 30-min hold at 100 VUs).

For a quick local smoke (10 VUs × 30 s — no deployed backend gating, but
the script itself runs against whatever `BACKEND_URL` you point it at):

```sh
pnpm audience-sla-loadtest:smoke -- --env BACKEND_URL=http://localhost:8787
```

Workflow form (preferred for production-targeted runs — leaves an audit
trail + uploads the results JSON as an artifact):

```sh
gh workflow run audience-sla-loadtest.yml \
  -f backend_url=https://audience-staging.example.com \
  -f vu_target=1000
```

---

## 5. Interpret results

K6 prints a summary table at the end of the run. The SLA gate is
encoded in `options.thresholds`; any threshold breach exits with a
non-zero status.

### Pass criteria

| Metric | Threshold | Source |
|---|---|---|
| `vote_ack_latency` p(50) | < 200 ms | ADR-009 §D4 |
| `vote_ack_latency` p(95) | < 500 ms | ADR-009 §D4 |
| `vote_ack_timeout_rate` | < 1 % | budget for transient drops |
| `http_req_duration{name:join}` p(95) | < 250 ms | join must not block at scale |

If all thresholds pass and `vote_ack_count` is at least ~ `VU_TARGET ×
30 min × 0.5 Hz × 0.95 = 855,000` (5% slack for ramp-up/ramp-down
fractional votes), the SLA is verified for the v1 1000-voter target.

### Failure modes

- **Threshold breach on `vote_ack_latency` p(95) > 500 ms** — the
  audience-backend is the bottleneck. Inspect Cloud Run CPU usage and
  Firestore write latency. Likely follow-up: ADR-009 §D4 says the v2
  10k-voter target requires a Pub/Sub-fronted ingestion path; that's
  out of v1 scope but the trigger for the architecture is this metric.
- **`http_req_duration{name:join}` p(95) breach** — voter-token mint
  rate is too low. Check the per-IP rate-limit configuration on the
  `/join` endpoint (T-458). The K6 runner may be sending from a small
  IP range and hitting `429 rate_limited`; either widen the IP-axis
  limit for the test or run K6 from multiple regions.
- **`vote_ack_timeout_rate > 1%`** — the backend is dropping ack
  responses. Inspect WebSocket capacity (Cloud Run max-instances + per-
  instance connection cap). Most likely culprit: WS connection eviction
  under memory pressure.
- **Firestore write throttle** — Firestore in default config throttles
  document writes to ~ 500/sec/document; at 500 Hz aggregate vote
  ingest the per-session aggregation document is the hotspot. Mitigation
  is in T-474 (sharded aggregation); confirm the deployment is on a
  T-474+ build.

### Saving + sharing results

The `--out json=...` flag writes a line-delimited JSON file (one record
per metric sample). For a human-readable summary, K6 also writes a
`summary.json` if you pass `--summary-export`. The workflow form
uploads both as `results.json` to the workflow-run artifacts.

---

## 6. Scope boundaries

This load test is **strict scope** (per T-477 spec):

- ✅ K6 script + this runbook + workflow scaffold.
- ❌ NOT an infrastructure-provisioning tool. The deployed target is
  ops-owned.
- ❌ NOT auto-triggered on every PR — too expensive + requires a deployed
  target. Pre-release gate only.
- ❌ NOT a Pub/Sub-fronted 10k-voter test — ADR-009 §D4 future SLA, out
  of v1 scope.
- ❌ NOT a vendor-adapter regression suite — that's T-485.
- ❌ NOT a real-network latency simulator — K6 runs from controlled CI /
  ops infrastructure; voter-network variance is captured at deploy-
  time monitoring.

If T-477's run surfaces a regression that fails the SLA, file a
follow-up task with the specific metric + breach value attached.
