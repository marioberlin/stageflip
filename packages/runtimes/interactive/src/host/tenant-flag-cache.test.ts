// packages/runtimes/interactive/src/host/tenant-flag-cache.test.ts
// T-411c — TenantFlagCache unit tests. Covers the sync read surface, the
// async populator (happy / null / throws), the eviction surface, and the
// matrix shape. The cache is the single seam between the (sync, hot)
// permission-shim mount-time path and the (async, session-start) host-
// shell populator — the test surface mirrors that split.

import { describe, expect, it, vi } from 'vitest';

import {
  createTenantFlagCache,
  TENANT_FLAG_GATING_MATRIX,
  type TenantFlagPopulator,
  type TenantFlagTarget,
  type TenantFlagValue,
} from './tenant-flag-cache.js';

const ALL_TARGETS: ReadonlyArray<TenantFlagTarget> = [
  'html',
  'browser-live-preview',
  'on-device-display',
];

const ALL_VALUES: ReadonlyArray<TenantFlagValue> = ['disabled', 'preview', 'ga'];

function fixedPopulator(value: TenantFlagValue | null): TenantFlagPopulator {
  return vi.fn(async () => value);
}

describe('TENANT_FLAG_GATING_MATRIX', () => {
  it('AC #9 — matrix covers every (TenantFlagValue × TenantFlagTarget) cell verbatim from T-411 D-T411-4', () => {
    expect(TENANT_FLAG_GATING_MATRIX).toEqual({
      disabled: {
        html: 'static-fallback-only',
        'browser-live-preview': 'static-fallback-only',
        'on-device-display': 'static-fallback-only',
      },
      preview: {
        html: 'live-mount',
        'browser-live-preview': 'live-mount',
        'on-device-display': 'static-fallback-only',
      },
      ga: {
        html: 'live-mount',
        'browser-live-preview': 'live-mount',
        'on-device-display': 'live-mount',
      },
    });
  });

  it('AC #9 — every value × target combination is covered', () => {
    for (const value of ALL_VALUES) {
      for (const target of ALL_TARGETS) {
        expect(TENANT_FLAG_GATING_MATRIX[value][target]).toBeDefined();
      }
    }
  });
});

describe('TenantFlagCache', () => {
  it('AC #3 — readSync returns undefined when no entry has been populated', () => {
    const cache = createTenantFlagCache({ populator: fixedPopulator('preview') });
    expect(cache.readSync('tenant-a', 'html')).toBeUndefined();
    expect(cache.readSync('tenant-a', 'browser-live-preview')).toBeUndefined();
    expect(cache.readSync('tenant-a', 'on-device-display')).toBeUndefined();
  });

  it('AC #4 — populate seeds all three target entries with the resolved value', async () => {
    const populator = fixedPopulator('preview');
    const cache = createTenantFlagCache({ populator });
    await cache.populate('tenant-a');
    expect(cache.readSync('tenant-a', 'html')).toBe('preview');
    expect(cache.readSync('tenant-a', 'browser-live-preview')).toBe('preview');
    expect(cache.readSync('tenant-a', 'on-device-display')).toBe('preview');
    expect(populator).toHaveBeenCalledWith('tenant-a');
    expect(populator).toHaveBeenCalledTimes(1);
  });

  it('AC #4 — populate is per-tenant; one tenant does not seed another', async () => {
    const populator = vi.fn<Parameters<TenantFlagPopulator>, ReturnType<TenantFlagPopulator>>(
      async (tenantId) => (tenantId === 'tenant-a' ? 'ga' : 'preview'),
    );
    const cache = createTenantFlagCache({ populator });
    await cache.populate('tenant-a');
    await cache.populate('tenant-b');
    expect(cache.readSync('tenant-a', 'on-device-display')).toBe('ga');
    expect(cache.readSync('tenant-b', 'on-device-display')).toBe('preview');
    expect(cache.readSync('tenant-c', 'html')).toBeUndefined();
  });

  it('AC #5 — populate with populator returning null seeds disabled for every target (default-deny)', async () => {
    const cache = createTenantFlagCache({ populator: fixedPopulator(null) });
    await cache.populate('tenant-absent');
    for (const target of ALL_TARGETS) {
      expect(cache.readSync('tenant-absent', target)).toBe('disabled');
    }
  });

  it('AC #6 — populate with populator that throws leaves entries unset for that tenant', async () => {
    const populator: TenantFlagPopulator = vi.fn(async () => {
      throw new Error('storage adapter unavailable');
    });
    const cache = createTenantFlagCache({ populator });
    await expect(cache.populate('tenant-error')).rejects.toThrow('storage adapter unavailable');
    for (const target of ALL_TARGETS) {
      expect(cache.readSync('tenant-error', target)).toBeUndefined();
    }
  });

  it('AC #7 — evict(tenantId) clears entries for a single tenant', async () => {
    const cache = createTenantFlagCache({ populator: fixedPopulator('ga') });
    await cache.populate('tenant-a');
    await cache.populate('tenant-b');
    cache.evict('tenant-a');
    expect(cache.readSync('tenant-a', 'html')).toBeUndefined();
    expect(cache.readSync('tenant-b', 'html')).toBe('ga');
  });

  it('AC #7 — evict on a non-existent tenant is a no-op', () => {
    const cache = createTenantFlagCache({ populator: fixedPopulator('ga') });
    expect(() => cache.evict('tenant-never-populated')).not.toThrow();
  });

  it('AC #8 — evict() with no argument clears all entries', async () => {
    const cache = createTenantFlagCache({ populator: fixedPopulator('preview') });
    await cache.populate('tenant-a');
    await cache.populate('tenant-b');
    cache.evict();
    expect(cache.readSync('tenant-a', 'html')).toBeUndefined();
    expect(cache.readSync('tenant-b', 'html')).toBeUndefined();
  });

  it('populate is idempotent for repeat calls — re-populates with current populator value', async () => {
    let value: TenantFlagValue = 'disabled';
    const populator: TenantFlagPopulator = vi.fn(async () => value);
    const cache = createTenantFlagCache({ populator });
    await cache.populate('tenant-a');
    expect(cache.readSync('tenant-a', 'html')).toBe('disabled');
    value = 'ga';
    await cache.populate('tenant-a');
    expect(cache.readSync('tenant-a', 'html')).toBe('ga');
  });

  it('readSync is a pure function: repeated calls yield the same result without side effects', async () => {
    const populator = fixedPopulator('preview');
    const cache = createTenantFlagCache({ populator });
    await cache.populate('tenant-a');
    const first = cache.readSync('tenant-a', 'html');
    const second = cache.readSync('tenant-a', 'html');
    const third = cache.readSync('tenant-a', 'html');
    expect(first).toBe('preview');
    expect(second).toBe('preview');
    expect(third).toBe('preview');
    // Populator should NOT have been called again — readSync is pure.
    expect(populator).toHaveBeenCalledTimes(1);
  });
});
