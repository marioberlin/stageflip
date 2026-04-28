// tests/load/thresholds.js
// AC #4 — per-scenario K6 threshold config. Imported by every scenario.
//
// Thresholds are pinned via dry-run baselines + 50% headroom (D-T269-3) so
// CI smoke catches regressions without flaking on runner variance.
// The "smoke" variant is invoked from CI (10 VUs × 60 s); the "full" variant
// is invoked from `pnpm load:full` against staging (~500 VUs × 1 h).

/** Smoke (CI) thresholds — generous; just catch obvious regressions. */
export const collabSyncSmoke = {
  // Yjs delta fan-out P95 < 300 ms (50% over the 200 ms full-load target,
  // because CI runners + emulator add latency we won't see in staging).
  ws_msgs_received_duration_p95: ['p(95)<300'],
  // Connection-establishment errors must be near zero.
  ws_connection_errors: ['count<5'],
};

/** Smoke (CI) thresholds for render-submit. */
export const renderSubmitSmoke = {
  // Queue-accept P95 < 150 ms (50% over the 100 ms target).
  http_req_duration_p95: ['p(95)<150'],
  // < 1% error rate (full-load target is < 0.5%).
  http_req_failed: ['rate<0.01'],
};

/** Smoke (CI) thresholds for api-mixed. */
export const apiMixedSmoke = {
  // Read/write/auth mix — P95 < 250 ms.
  http_req_duration_p95: ['p(95)<250'],
  // No 5xx tolerated; rate-limit retries swallow 429s before they bubble.
  http_5xx_rate: ['rate<0.001'],
};

/** Full-load thresholds — tight; reflect the actual SLA. */
export const collabSyncFull = {
  ws_msgs_received_duration_p95: ['p(95)<200'],
  ws_connection_errors: ['count<10'],
};

export const renderSubmitFull = {
  http_req_duration_p95: ['p(95)<100'],
  http_req_failed: ['rate<0.005'],
};

export const apiMixedFull = {
  http_req_duration_p95: ['p(95)<200'],
  http_5xx_rate: ['rate<0.0001'],
};

/**
 * Dry-run thresholds — used by the threshold-shape unit test (AC #4).
 * Each value is the upper-bound number that the smoke threshold expression
 * encodes; the test asserts no value is more than 50% over the full-load
 * target (no future drift without intent).
 */
export const SMOKE_VS_FULL_PINS = {
  collabSync: {
    smokeMs: 300,
    fullMs: 200,
  },
  renderSubmit: {
    smokeMs: 150,
    fullMs: 100,
    smokeErrRate: 0.01,
    fullErrRate: 0.005,
  },
  apiMixed: {
    smokeMs: 250,
    fullMs: 200,
  },
};
