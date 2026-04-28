// tests/load/scenarios/render-submit.js
// AC #2 — N parallel HTTP POSTs to /api/render. Asserts queue-accept
// P95 < 100 ms (full) / 150 ms (smoke), error rate < 0.5% (full) / 1% (smoke).
//
// Smoke profile (CI): 10 VUs × 60 s, ~30 req/s aggregate.
// Full profile (ops): 50 VUs × 5 min, ~30 req/s sustained.
//
// We do NOT wait for the render to complete — only that the queue accepts
// the job (T-269 OOS: render-farm worker capacity, T-266-era).

import { check } from 'k6';
import { Rate } from 'k6/metrics';

import { authHeaders, requestWithRetryAfter } from '../helpers.js';
import { renderSubmitFull, renderSubmitSmoke } from '../thresholds.js';

const PROFILE = (__ENV.STAGEFLIP_LOAD_PROFILE || 'smoke').toLowerCase();
const TARGET = __ENV.STAGEFLIP_LOAD_TARGET || 'https://staging.stageflip.local';
const TOKEN = __ENV.STAGEFLIP_LOAD_AUTH_TOKEN || 'dev-token';
const ORG_ID = __ENV.STAGEFLIP_LOAD_ORG_ID || 'org-load';

const errorRate = new Rate('http_req_failed');

export const options =
  PROFILE === 'full'
    ? {
        scenarios: {
          submit: {
            executor: 'constant-arrival-rate',
            rate: 30,
            timeUnit: '1s',
            duration: '5m',
            preAllocatedVUs: 50,
            maxVUs: 100,
          },
        },
        thresholds: renderSubmitFull,
      }
    : {
        scenarios: {
          submit: {
            executor: 'constant-arrival-rate',
            rate: 5,
            timeUnit: '1s',
            duration: '60s',
            preAllocatedVUs: 10,
            maxVUs: 20,
          },
        },
        thresholds: renderSubmitSmoke,
      };

export default function renderSubmitScenario() {
  const url = `${TARGET}/api/render`;
  const body = JSON.stringify({
    docId: 'loaddoc-0000',
    profile: 'preview',
    fps: 30,
    duration: 1,
  });
  // Bearer + X-Org-Id headers built via the shared helper (matches
  // api-mixed.js); `requestWithRetryAfter` honors T-263 429 + Retry-After.
  const params = {
    headers: authHeaders({ token: TOKEN, orgId: ORG_ID }),
    tags: { scenario: 'render-submit' },
  };
  const res = requestWithRetryAfter('POST', url, body, params);
  errorRate.add(res.status >= 400);
  check(res, {
    'render-submit accepted (2xx)': (r) => r.status >= 200 && r.status < 300,
  });
  // K6 also auto-records http_req_duration / http_req_failed; the
  // threshold names in thresholds.js match those built-ins.
}
