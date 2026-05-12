// packages/audience-join-shared/src/voter-url.test.ts
// T-456 — `voterUrlFor({ baseUrl, sessionId })` builder tests.

import { describe, expect, it } from 'vitest';

import { voterUrlFor } from './voter-url.js';

describe('voterUrlFor', () => {
  it('joins baseUrl + sessionId', () => {
    expect(voterUrlFor({ baseUrl: 'https://join.stageflip.app', sessionId: 'sess-1' })).toBe(
      'https://join.stageflip.app/sess-1',
    );
  });

  it('strips a trailing slash on baseUrl', () => {
    expect(voterUrlFor({ baseUrl: 'https://join.stageflip.app/', sessionId: 'abc' })).toBe(
      'https://join.stageflip.app/abc',
    );
  });

  it('accepts http for local dev', () => {
    expect(voterUrlFor({ baseUrl: 'http://localhost:3500', sessionId: 'x' })).toBe(
      'http://localhost:3500/x',
    );
  });

  it('rejects empty baseUrl', () => {
    expect(() => voterUrlFor({ baseUrl: '', sessionId: 's' })).toThrow(/baseUrl/);
  });

  it('rejects non-http(s) baseUrl', () => {
    expect(() => voterUrlFor({ baseUrl: 'ftp://example.com', sessionId: 's' })).toThrow(/baseUrl/);
  });

  it('rejects malformed baseUrl', () => {
    expect(() => voterUrlFor({ baseUrl: 'not-a-url', sessionId: 's' })).toThrow(/baseUrl/);
  });

  it('rejects empty sessionId', () => {
    expect(() => voterUrlFor({ baseUrl: 'https://x', sessionId: '' })).toThrow(/sessionId/);
  });

  it('URI-encodes sessionId path segment', () => {
    expect(voterUrlFor({ baseUrl: 'https://x', sessionId: 'a b/c' })).toBe('https://x/a%20b%2Fc');
  });
});
