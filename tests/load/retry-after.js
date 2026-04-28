// tests/load/retry-after.js
// Pure-ESM helper: parse a 429 response into a number of seconds to wait.
// Imported by helpers.js (K6 runtime) AND by retry-after.test.ts (vitest).
// No K6 imports, no Node imports — runs anywhere.
//
// AC #11 — must NOT tight-loop. Strategy:
//   1. Parse `Retry-After` header (RFC 7231: integer seconds OR HTTP-date).
//   2. Fallback: parse `retryAfterSeconds` from the JSON body (T-263 wire shape).
//   3. Floor at 1 second; cap at 30 seconds (any single sleep longer than that
//      is a server bug — fail fast rather than wait silently).
//   4. Cap retries at 3 (caller enforces). Worst-case total wait per request
//      is 3 × 30 s = 90 s, but typical is 3 × server-tier-refill ≈ 1–6 s.

/** Maximum retries the K6 wrapper will perform on 429. */
export const MAX_RETRIES = 3;

/** Floor / ceiling for a single sleep (seconds). */
export const MIN_SLEEP_SECONDS = 1;
export const MAX_SLEEP_SECONDS = 30;

/**
 * @param {{ header?: string | undefined, body?: string | null | undefined }} input
 * @returns {number} seconds to wait (>= MIN_SLEEP_SECONDS, <= MAX_SLEEP_SECONDS).
 */
export function computeRetryAfter(input) {
  const fromHeader = parseRetryAfterHeader(input.header);
  if (fromHeader !== null) return clamp(fromHeader);
  const fromBody = parseRetryAfterBody(input.body);
  if (fromBody !== null) return clamp(fromBody);
  // No machine-readable hint — sleep the floor and let the next attempt try.
  return MIN_SLEEP_SECONDS;
}

/**
 * @param {string | undefined} header
 * @returns {number | null}
 */
function parseRetryAfterHeader(header) {
  if (!header) return null;
  const trimmed = header.trim();
  if (trimmed === '') return null;
  // RFC 7231 §7.1.3: delta-seconds (integer) OR HTTP-date.
  if (/^\d+$/.test(trimmed)) {
    const n = Number.parseInt(trimmed, 10);
    return Number.isFinite(n) && n >= 0 ? n : null;
  }
  // HTTP-date branch: not used by T-263 today (we always emit integer seconds
  // via Math.ceil(retryAfterMs / 1000)). We still parse it for robustness in
  // case the gateway ever rewrites the header.
  const dateMs = Date.parse(trimmed);
  if (Number.isNaN(dateMs)) return null;
  // Caller has not given us a "now" reference — assume the date is in the
  // future and the delta is ~ a few seconds. Default to MIN_SLEEP_SECONDS
  // and let the body-parse path or next attempt take over.
  return MIN_SLEEP_SECONDS;
}

/**
 * @param {string | null | undefined} body
 * @returns {number | null}
 */
function parseRetryAfterBody(body) {
  if (!body) return null;
  let parsed;
  try {
    parsed = JSON.parse(body);
  } catch {
    return null;
  }
  if (parsed && typeof parsed === 'object' && parsed.code === 'RATE_LIMITED') {
    const n = parsed.retryAfterSeconds;
    if (typeof n === 'number' && Number.isFinite(n) && n >= 0) return n;
  }
  return null;
}

/**
 * @param {number} n
 * @returns {number}
 */
function clamp(n) {
  if (n < MIN_SLEEP_SECONDS) return MIN_SLEEP_SECONDS;
  if (n > MAX_SLEEP_SECONDS) return MAX_SLEEP_SECONDS;
  return n;
}
