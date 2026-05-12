---
'stageflip': patch
---

T-477 — audience-backend SLA load test (K6 script + workflow scaffold).

Adds `scripts/loadtest/audience-sla.k6.ts` — a K6 script driving 1000
concurrent voters against a deployed audience-backend per ADR-009 §D4
SLA target. Scenario: ramping-vus 0 → 1000 over 5 min, hold for 30 min,
ramp down to 0 over 5 min. Per-VU iteration mints a voter token via
`POST /v1/audience/sessions/<id>/join`, opens a WebSocket to
`/v1/audience/ws/<id>`, submits one vote every 2 s for 60 s, and
measures end-to-end vote-ack latency via a custom `vote_ack_latency`
Trend. Thresholds: `p(50)<200ms`, `p(95)<500ms`,
`http_req_duration{name:join}: p(95)<250ms`, `vote_ack_timeout_rate <
1%`.

Pure helpers (`parseThresholds`, `synthesizeBatchSnapshot`) live in
`scripts/loadtest/audience-sla.ts` with vitest coverage; the K6 script
itself is `k6 inspect`-validated at PR review (K6 ships its own Goja
runtime). Adds `scripts/loadtest/audience-sla-README.md` runbook
(provisioning, tenant prep, run, interpret, pre-flight) and a
manual-trigger `.github/workflows/audience-sla-loadtest.yml` workflow
(not on PRs — expensive + requires deployed target). Adds
`pnpm audience-sla-loadtest:smoke` for 10-VU / 30-s local validation.

Operational tooling only; no package source changes. P15 δ closeout
task #6.
