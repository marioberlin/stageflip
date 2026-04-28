// packages/render-farm/src/selector.test.ts
// Selector unit tests (T-266 ACs #12–#13).

import { afterEach, describe, expect, it } from 'vitest';

import { InMemoryRenderFarmAdapter } from './in-memory.js';
import { KubernetesRenderFarmAdapter } from './k8s-stub.js';
import {
  RENDER_FARM_ADAPTER_ENV_VAR,
  __resetSelectorCache,
  getRenderFarmAdapter,
} from './selector.js';

describe('getRenderFarmAdapter', () => {
  afterEach(() => {
    __resetSelectorCache();
  });

  it('AC #12: env not set returns InMemoryRenderFarmAdapter', () => {
    const a = getRenderFarmAdapter({});
    expect(a).toBeInstanceOf(InMemoryRenderFarmAdapter);
    expect(a.vendor).toBe('in-memory');
  });

  it('AC #12: empty string returns InMemoryRenderFarmAdapter', () => {
    const a = getRenderFarmAdapter({ [RENDER_FARM_ADAPTER_ENV_VAR]: '' });
    expect(a).toBeInstanceOf(InMemoryRenderFarmAdapter);
  });

  it('AC #12: "in-memory" returns InMemoryRenderFarmAdapter', () => {
    const a = getRenderFarmAdapter({ [RENDER_FARM_ADAPTER_ENV_VAR]: 'in-memory' });
    expect(a).toBeInstanceOf(InMemoryRenderFarmAdapter);
  });

  it('AC #12: "k8s" returns KubernetesRenderFarmAdapter', () => {
    const a = getRenderFarmAdapter({ [RENDER_FARM_ADAPTER_ENV_VAR]: 'k8s' });
    expect(a).toBeInstanceOf(KubernetesRenderFarmAdapter);
    expect(a.vendor).toBe('k8s');
  });

  it('AC #12: unknown adapter throws (no silent fallback)', () => {
    expect(() => getRenderFarmAdapter({ [RENDER_FARM_ADAPTER_ENV_VAR]: 'unicorn' })).toThrow(
      /unknown adapter "unicorn"/,
    );
  });

  it('AC #13: pure — same env returns same adapter type and reuses instance', () => {
    const a = getRenderFarmAdapter({ [RENDER_FARM_ADAPTER_ENV_VAR]: 'in-memory' });
    const b = getRenderFarmAdapter({ [RENDER_FARM_ADAPTER_ENV_VAR]: 'in-memory' });
    expect(a).toBe(b);
  });

  it('AC #13: different kinds give different instances', () => {
    const a = getRenderFarmAdapter({ [RENDER_FARM_ADAPTER_ENV_VAR]: 'in-memory' });
    const b = getRenderFarmAdapter({ [RENDER_FARM_ADAPTER_ENV_VAR]: 'k8s' });
    expect(a).not.toBe(b);
  });

  it('__resetSelectorCache forces a fresh instance', () => {
    const a = getRenderFarmAdapter({ [RENDER_FARM_ADAPTER_ENV_VAR]: 'in-memory' });
    __resetSelectorCache();
    const b = getRenderFarmAdapter({ [RENDER_FARM_ADAPTER_ENV_VAR]: 'in-memory' });
    expect(a).not.toBe(b);
  });

  it('defaults to process.env when no arg', () => {
    // Save and restore so we don't pollute other tests.
    const prev = process.env[RENDER_FARM_ADAPTER_ENV_VAR];
    process.env[RENDER_FARM_ADAPTER_ENV_VAR] = 'in-memory';
    try {
      const a = getRenderFarmAdapter();
      expect(a).toBeInstanceOf(InMemoryRenderFarmAdapter);
    } finally {
      if (prev === undefined) delete process.env[RENDER_FARM_ADAPTER_ENV_VAR];
      else process.env[RENDER_FARM_ADAPTER_ENV_VAR] = prev;
    }
  });
});
