// packages/pack-telemetry/src/redact.test.ts
// T-503 — Tests for the anonymization helpers.

import { describe, expect, it } from 'vitest';

import { detectPlatform, hashPackId } from './redact.js';

describe('hashPackId', () => {
  it('returns a 64-char lowercase hex string', () => {
    const hash = hashPackId('stageflip', 'news-pro');
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('is deterministic for the same inputs', () => {
    const a = hashPackId('stageflip', 'news-pro');
    const b = hashPackId('stageflip', 'news-pro');
    expect(a).toBe(b);
  });

  it('differs across different (publisher, id) pairs', () => {
    const a = hashPackId('stageflip', 'news-pro');
    const b = hashPackId('stageflip', 'sports-pro');
    const c = hashPackId('contoso', 'news-pro');
    expect(a).not.toBe(b);
    expect(a).not.toBe(c);
    expect(b).not.toBe(c);
  });

  it('hashes empty strings without throwing', () => {
    // The recorder rejects empty hashes at the event-build step;
    // hashPackId itself should not throw.
    const hash = hashPackId('', '');
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('detectPlatform', () => {
  it('maps darwin/linux/win32 to themselves', () => {
    expect(detectPlatform('darwin')).toBe('darwin');
    expect(detectPlatform('linux')).toBe('linux');
    expect(detectPlatform('win32')).toBe('win32');
  });

  it('collapses other platforms to "unknown"', () => {
    expect(detectPlatform('aix')).toBe('unknown');
    expect(detectPlatform('android')).toBe('unknown');
    expect(detectPlatform('freebsd')).toBe('unknown');
    expect(detectPlatform('sunos')).toBe('unknown');
    expect(detectPlatform('some-future-os')).toBe('unknown');
  });

  it('uses process.platform when called with no args', () => {
    const got = detectPlatform();
    expect(['darwin', 'linux', 'win32', 'unknown']).toContain(got);
  });
});
