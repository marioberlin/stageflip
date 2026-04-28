// tests/load/helpers.js
// Shared K6 helpers — auth headers (T-262 conventions) and retry-after handling
// (T-263 wire shape). Loaded by every scenario via ESM import.
//
// K6 runs scenarios in its own JS runtime (Goja). No Node built-ins. Only the
// `k6/*` modules and standard ECMAScript are available.

import { sleep } from 'k6';
import http from 'k6/http';

import { authHeaders as _authHeaders } from './auth.js';
import { MAX_RETRIES, computeRetryAfter } from './retry-after.js';

export const authHeaders = _authHeaders;

/**
 * Issue an HTTP request with automatic 429 + Retry-After backoff per T-263.
 *
 * Wire shape (T-263 errors.ts):
 *   `{ "code": "RATE_LIMITED", "tier": "user"|"org"|"apiKey", "retryAfterSeconds": N }`
 * The `Retry-After` HTTP header is also set (RFC 7231) and is the primary
 * source we honor; the JSON body is parsed only as a fallback.
 *
 * Retries up to MAX_RETRIES times. Bounded total sleep (≤ 60 s) so a
 * misconfigured server cannot stall a VU forever — see retry-after.js.
 *
 * @param {string} method
 * @param {string} url
 * @param {string|null} body
 * @param {{ headers: Record<string, string> }} params
 * @returns {ReturnType<typeof http.request>}
 */
export function requestWithRetryAfter(method, url, body, params) {
  let res = http.request(method, url, body, params);
  let attempts = 0;
  while (res.status === 429 && attempts < MAX_RETRIES) {
    const wait = computeRetryAfter({
      header: res.headers['Retry-After'] || res.headers['retry-after'],
      body: res.body,
    });
    sleep(wait);
    attempts++;
    res = http.request(method, url, body, params);
  }
  return res;
}
