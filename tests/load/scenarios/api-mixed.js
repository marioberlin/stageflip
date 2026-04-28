// tests/load/scenarios/api-mixed.js
// AC #3 — realistic 60/30/10 mix (read/write/auth) at 50 req/s for 5 min,
// asserts no 5xx, respects 429 + Retry-After per T-263 wire shape.
//
// Smoke profile (CI): 10 VUs × 60 s, ~10 req/s aggregate.
// Full profile (ops): 50 VUs × 5 min, ~50 req/s sustained.

import { check } from 'k6';
import { Rate } from 'k6/metrics';

import { authHeaders, requestWithRetryAfter } from '../helpers.js';
import { apiMixedFull, apiMixedSmoke } from '../thresholds.js';

const PROFILE = (__ENV.STAGEFLIP_LOAD_PROFILE || 'smoke').toLowerCase();
const TARGET = __ENV.STAGEFLIP_LOAD_TARGET || 'https://staging.stageflip.local';
const TOKEN = __ENV.STAGEFLIP_LOAD_AUTH_TOKEN || 'dev-token';
const ORG_ID = __ENV.STAGEFLIP_LOAD_ORG_ID || 'org-load';

// 5xx-only error rate — 429s are expected and handled via retry-after,
// so they MUST NOT count as failures here (AC #11).
const fiveXxRate = new Rate('http_5xx_rate');

export const options =
  PROFILE === 'full'
    ? {
        scenarios: {
          mixed: {
            executor: 'constant-arrival-rate',
            rate: 50,
            timeUnit: '1s',
            duration: '5m',
            preAllocatedVUs: 50,
            maxVUs: 100,
          },
        },
        thresholds: apiMixedFull,
      }
    : {
        scenarios: {
          mixed: {
            executor: 'constant-arrival-rate',
            rate: 10,
            timeUnit: '1s',
            duration: '60s',
            preAllocatedVUs: 10,
            maxVUs: 20,
          },
        },
        thresholds: apiMixedSmoke,
      };

const headers = authHeaders({ token: TOKEN, orgId: ORG_ID });

function pickAction() {
  // Note: Math.random() is non-deterministic by design here. tests/load/**
  // is OUT OF the determinism scan (D-T269-5; check-determinism.ts).
  const r = Math.random();
  if (r < 0.6) return 'read';
  if (r < 0.9) return 'write';
  return 'auth';
}

function readDoc() {
  return requestWithRetryAfter('GET', `${TARGET}/api/documents/loaddoc-0000`, null, { headers });
}

function writeDoc() {
  const body = JSON.stringify({ patch: { title: `Updated ${Date.now()}` } });
  return requestWithRetryAfter('PATCH', `${TARGET}/api/documents/loaddoc-0000`, body, { headers });
}

function authMe() {
  return requestWithRetryAfter('GET', `${TARGET}/api/auth/me`, null, { headers });
}

export default function apiMixedScenario() {
  const action = pickAction();
  let res;
  if (action === 'read') res = readDoc();
  else if (action === 'write') res = writeDoc();
  else res = authMe();
  fiveXxRate.add(res.status >= 500);
  check(res, {
    'api-mixed: not 5xx': (r) => r.status < 500,
  });
}
