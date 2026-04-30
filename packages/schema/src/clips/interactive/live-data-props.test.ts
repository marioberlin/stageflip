// packages/schema/src/clips/interactive/live-data-props.test.ts
// T-391 ACs #1–#4 — liveDataClipPropsSchema parsing.

import { describe, expect, it } from 'vitest';

import { liveDataClipPropsSchema } from './live-data-props.js';

const validBase = {
  endpoint: 'https://example.com/api/data',
} as const;

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
