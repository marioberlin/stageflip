// packages/schema/src/clips/interactive/live-data-props.test.ts
// T-391 ACs #1–#4 — liveDataClipPropsSchema parsing.
// T-392 ACs #1–#4 — cachedSnapshot optional field.
// T-404 — security hardening: SSRF allowlist (R-1) + credential-header
// denylist (R-2). Existing pre-T-404 tests are wrapped in a top-level
// `beforeEach` that seeds the host allowlist with the legacy fixture
// hosts so they continue to assert what they originally asserted; new
// describes drive the allowlist explicitly per the R-1 / R-2 ACs.

import { beforeEach, describe, expect, it } from 'vitest';

import {
  FORBIDDEN_REQUEST_HEADER_PATTERNS,
  LIVE_DATA_ALLOWED_HOST_PATTERNS,
  __resetAllowedHostsForTests,
  extendAllowedHosts,
  liveDataClipPropsSchema,
} from './live-data-props.js';

const validBase = {
  endpoint: 'https://example.com/api/data',
} as const;

// Seed the allowlist for the pre-T-404 test suites. R-1 changes the
// default from "any URL" to "deny-all unless allow-listed"; the legacy
// tests use `example.com` and `localhost:8080`, so we widen for the
// suites below. R-1-specific tests reset the allowlist themselves.
beforeEach(() => {
  __resetAllowedHostsForTests();
  extendAllowedHosts([
    /^example\.com$/,
    /^localhost(:\d+)?$/,
    /^x$/,
    /^a$/,
    /^b$/,
    /^api\.example\.com$/,
  ]);
});

describe('liveDataClipPropsSchema (T-391 AC #1)', () => {
  it('AC #1 — accepts a complete live-data-props payload', () => {
    const parsed = liveDataClipPropsSchema.parse({
      endpoint: 'https://example.com/api',
      method: 'POST',
      headers: { 'X-Trace': 'abc' },
      body: { hello: 'world' },
      parseMode: 'text',
      refreshTrigger: 'manual',
      posterFrame: 12,
    });
    expect(parsed.endpoint).toBe('https://example.com/api');
    expect(parsed.method).toBe('POST');
    expect(parsed.headers).toEqual({ 'X-Trace': 'abc' });
    expect(parsed.body).toEqual({ hello: 'world' });
    expect(parsed.parseMode).toBe('text');
    expect(parsed.refreshTrigger).toBe('manual');
    expect(parsed.posterFrame).toBe(12);
  });

  it('AC #1 — defaults populate when optional fields omitted', () => {
    const parsed = liveDataClipPropsSchema.parse(validBase);
    expect(parsed.method).toBe('GET');
    expect(parsed.parseMode).toBe('json');
    expect(parsed.refreshTrigger).toBe('mount-only');
    expect(parsed.posterFrame).toBe(0);
    expect(parsed.headers).toBeUndefined();
    expect(parsed.body).toBeUndefined();
  });

  it('AC #2 — non-URL endpoint throws', () => {
    expect(() => liveDataClipPropsSchema.parse({ endpoint: 'not-a-url' })).toThrow();
  });

  it('AC #2 — empty endpoint throws', () => {
    expect(() => liveDataClipPropsSchema.parse({ endpoint: '' })).toThrow();
  });

  it('AC #3 — method PUT throws (v1 enum is GET / POST)', () => {
    expect(() => liveDataClipPropsSchema.parse({ ...validBase, method: 'PUT' })).toThrow();
  });

  it('AC #3 — method DELETE throws', () => {
    expect(() => liveDataClipPropsSchema.parse({ ...validBase, method: 'DELETE' })).toThrow();
  });

  it('AC #4 — parseMode xml throws', () => {
    expect(() => liveDataClipPropsSchema.parse({ ...validBase, parseMode: 'xml' })).toThrow();
  });

  it('AC #4 — parseMode form-data throws', () => {
    expect(() => liveDataClipPropsSchema.parse({ ...validBase, parseMode: 'form-data' })).toThrow();
  });

  it('rejects refreshTrigger interval (polling is future)', () => {
    expect(() =>
      liveDataClipPropsSchema.parse({ ...validBase, refreshTrigger: 'interval' }),
    ).toThrow();
  });

  it('rejects extra top-level fields (strict)', () => {
    expect(() => liveDataClipPropsSchema.parse({ ...validBase, sneaky: true })).toThrow();
  });

  it('rejects negative posterFrame', () => {
    expect(() => liveDataClipPropsSchema.parse({ ...validBase, posterFrame: -1 })).toThrow();
  });

  it('rejects non-string header values', () => {
    expect(() =>
      liveDataClipPropsSchema.parse({
        ...validBase,
        headers: { 'X-Trace': 42 },
      }),
    ).toThrow();
  });

  it('rejects payload missing endpoint entirely', () => {
    expect(() => liveDataClipPropsSchema.parse({})).toThrow(/endpoint/);
  });

  it('accepts http endpoints (not just https)', () => {
    const parsed = liveDataClipPropsSchema.parse({
      endpoint: 'http://localhost:8080/data',
    });
    expect(parsed.endpoint).toBe('http://localhost:8080/data');
  });
});

describe('liveDataClipPropsSchema cachedSnapshot (T-392 AC #1–#4)', () => {
  it('T-392 AC #1 — accepts a valid cachedSnapshot { capturedAt, status, body }', () => {
    const parsed = liveDataClipPropsSchema.parse({
      ...validBase,
      cachedSnapshot: {
        capturedAt: '2026-04-30T12:00:00Z',
        status: 200,
        body: { temperature: 72, humidity: 45 },
      },
    });
    expect(parsed.cachedSnapshot).toEqual({
      capturedAt: '2026-04-30T12:00:00Z',
      status: 200,
      body: { temperature: 72, humidity: 45 },
    });
  });

  it('T-392 AC #1 — accepts cachedSnapshot with arbitrary JSON body shapes (string, number, array)', () => {
    expect(() =>
      liveDataClipPropsSchema.parse({
        ...validBase,
        cachedSnapshot: { capturedAt: 't', status: 200, body: 'plain' },
      }),
    ).not.toThrow();
    expect(() =>
      liveDataClipPropsSchema.parse({
        ...validBase,
        cachedSnapshot: { capturedAt: 't', status: 200, body: 42 },
      }),
    ).not.toThrow();
    expect(() =>
      liveDataClipPropsSchema.parse({
        ...validBase,
        cachedSnapshot: { capturedAt: 't', status: 200, body: [1, 2, 3] },
      }),
    ).not.toThrow();
  });

  it('T-392 AC #2 — empty capturedAt throws (min(1))', () => {
    expect(() =>
      liveDataClipPropsSchema.parse({
        ...validBase,
        cachedSnapshot: { capturedAt: '', status: 200, body: {} },
      }),
    ).toThrow(/capturedAt/);
  });

  it('T-392 AC #3 — non-integer status throws', () => {
    expect(() =>
      liveDataClipPropsSchema.parse({
        ...validBase,
        cachedSnapshot: { capturedAt: 'x', status: 'oops', body: {} },
      }),
    ).toThrow();
  });

  it('T-392 AC #3 — float status throws (must be integer)', () => {
    expect(() =>
      liveDataClipPropsSchema.parse({
        ...validBase,
        cachedSnapshot: { capturedAt: 'x', status: 200.5, body: {} },
      }),
    ).toThrow();
  });

  it('T-392 AC #4 — payload without cachedSnapshot still validates (backward-compat)', () => {
    const parsed = liveDataClipPropsSchema.parse(validBase);
    expect(parsed.cachedSnapshot).toBeUndefined();
  });

  it('T-392 — extra keys on cachedSnapshot are rejected (strict)', () => {
    expect(() =>
      liveDataClipPropsSchema.parse({
        ...validBase,
        cachedSnapshot: { capturedAt: 't', status: 200, body: {}, extra: true },
      }),
    ).toThrow();
  });

  it('T-392 — missing capturedAt rejects', () => {
    expect(() =>
      liveDataClipPropsSchema.parse({
        ...validBase,
        cachedSnapshot: { status: 200, body: {} },
      }),
    ).toThrow();
  });
});

describe('liveDataClipPropsSchema — endpoint allowlist (T-404 R-1)', () => {
  beforeEach(() => {
    __resetAllowedHostsForTests();
  });

  it('R-1 — empty allowlist rejects any endpoint (deny-all default)', () => {
    expect(() => liveDataClipPropsSchema.parse({ endpoint: 'https://example.com/api' })).toThrow(
      /not in tenant allowlist/,
    );
    expect(() => liveDataClipPropsSchema.parse({ endpoint: 'http://localhost:3000/x' })).toThrow(
      /not in tenant allowlist/,
    );
  });

  it('R-1 — extendAllowedHosts permits matching host (localhost:3000)', () => {
    extendAllowedHosts([/^localhost(:\d+)?$/]);
    expect(() =>
      liveDataClipPropsSchema.parse({ endpoint: 'http://localhost:3000/api' }),
    ).not.toThrow();
  });

  it('R-1 — HTTPS public URL rejected when not in allowlist', () => {
    extendAllowedHosts([/^localhost(:\d+)?$/]);
    expect(() =>
      liveDataClipPropsSchema.parse({ endpoint: 'https://evil.example.com/data' }),
    ).toThrow(/not in tenant allowlist/);
  });

  it('R-1 — extending twice merges (no replace semantics)', () => {
    extendAllowedHosts([/^localhost(:\d+)?$/]);
    extendAllowedHosts([/^api\.example\.com$/]);
    // First extension still effective.
    expect(() =>
      liveDataClipPropsSchema.parse({ endpoint: 'http://localhost:8080/x' }),
    ).not.toThrow();
    // Second extension also effective.
    expect(() =>
      liveDataClipPropsSchema.parse({ endpoint: 'https://api.example.com/x' }),
    ).not.toThrow();
    // Verify the read-only snapshot reflects both patterns.
    const snapshot = LIVE_DATA_ALLOWED_HOST_PATTERNS();
    expect(snapshot).toHaveLength(2);
  });

  it('R-1 — __resetAllowedHostsForTests clears the allowlist back to deny-all', () => {
    extendAllowedHosts([/^example\.com$/]);
    expect(() =>
      liveDataClipPropsSchema.parse({ endpoint: 'https://example.com/x' }),
    ).not.toThrow();
    __resetAllowedHostsForTests();
    expect(() => liveDataClipPropsSchema.parse({ endpoint: 'https://example.com/x' })).toThrow(
      /not in tenant allowlist/,
    );
    expect(LIVE_DATA_ALLOWED_HOST_PATTERNS()).toHaveLength(0);
  });

  it('R-1 — duplicate patterns are deduplicated on merge', () => {
    extendAllowedHosts([/^localhost(:\d+)?$/]);
    extendAllowedHosts([/^localhost(:\d+)?$/]);
    expect(LIVE_DATA_ALLOWED_HOST_PATTERNS()).toHaveLength(1);
  });

  it('R-1 — LIVE_DATA_ALLOWED_HOST_PATTERNS returns a fresh snapshot (mutating the result does not affect the schema)', () => {
    extendAllowedHosts([/^example\.com$/]);
    const snapshot = LIVE_DATA_ALLOWED_HOST_PATTERNS() as RegExp[];
    snapshot.length = 0;
    // Underlying state still has the pattern.
    expect(() =>
      liveDataClipPropsSchema.parse({ endpoint: 'https://example.com/x' }),
    ).not.toThrow();
  });
});

describe('liveDataClipPropsSchema — credential-header denylist (T-404 R-2)', () => {
  beforeEach(() => {
    __resetAllowedHostsForTests();
    extendAllowedHosts([/^example\.com$/]);
  });

  const base = { endpoint: 'https://example.com/api' };

  it('R-2 — Authorization header rejected (canonical case)', () => {
    expect(() =>
      liveDataClipPropsSchema.parse({ ...base, headers: { Authorization: 'Bearer token' } }),
    ).toThrow(/credential-header denylist/);
  });

  it('R-2 — lowercase authorization rejected (case-insensitive)', () => {
    expect(() =>
      liveDataClipPropsSchema.parse({ ...base, headers: { authorization: 'Bearer x' } }),
    ).toThrow(/credential-header denylist/);
  });

  it('R-2 — uppercase AUTHORIZATION rejected (case-insensitive)', () => {
    expect(() =>
      liveDataClipPropsSchema.parse({ ...base, headers: { AUTHORIZATION: 'Bearer x' } }),
    ).toThrow(/credential-header denylist/);
  });

  it('R-2 — Proxy-Authorization rejected', () => {
    expect(() =>
      liveDataClipPropsSchema.parse({
        ...base,
        headers: { 'Proxy-Authorization': 'Basic x' },
      }),
    ).toThrow(/credential-header denylist/);
  });

  it('R-2 — Cookie rejected', () => {
    expect(() =>
      liveDataClipPropsSchema.parse({ ...base, headers: { Cookie: 'sid=abc' } }),
    ).toThrow(/credential-header denylist/);
  });

  it('R-2 — X-Api-Key rejected', () => {
    expect(() => liveDataClipPropsSchema.parse({ ...base, headers: { 'X-Api-Key': 'k' } })).toThrow(
      /credential-header denylist/,
    );
  });

  it('R-2 — Bearer rejected', () => {
    expect(() => liveDataClipPropsSchema.parse({ ...base, headers: { Bearer: 'tok' } })).toThrow(
      /credential-header denylist/,
    );
  });

  it('R-2 — X-Custom-Header accepted (not on denylist)', () => {
    expect(() =>
      liveDataClipPropsSchema.parse({ ...base, headers: { 'X-Custom-Header': 'v' } }),
    ).not.toThrow();
  });

  it('R-2 — empty headers object accepted', () => {
    expect(() => liveDataClipPropsSchema.parse({ ...base, headers: {} })).not.toThrow();
  });

  it('R-2 — undefined headers (omitted) accepted', () => {
    expect(() => liveDataClipPropsSchema.parse(base)).not.toThrow();
  });

  it('R-2 — FORBIDDEN_REQUEST_HEADER_PATTERNS exported for downstream tooling', () => {
    expect(Array.isArray(FORBIDDEN_REQUEST_HEADER_PATTERNS)).toBe(true);
    expect(FORBIDDEN_REQUEST_HEADER_PATTERNS.length).toBeGreaterThan(0);
    expect(FORBIDDEN_REQUEST_HEADER_PATTERNS.every((p) => p instanceof RegExp)).toBe(true);
  });
});
