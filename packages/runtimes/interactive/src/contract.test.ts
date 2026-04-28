// packages/runtimes/interactive/src/contract.test.ts
// T-306 AC #1, #2 — type-level + runtime presence assertions for the
// runtime-tier contract. These tests pin that the public types are
// exported and structurally compatible with a representative
// `MountContext`.

import { describe, expect, it, vi } from 'vitest';

import { makeInteractiveClip } from './contract-tests/fixtures.js';
import type { ClipFactory, MountContext, MountHandle } from './contract.js';
import { PERMISSIVE_TENANT_POLICY } from './contract.js';

describe('contract types', () => {
  it('PERMISSIVE_TENANT_POLICY allows every family', () => {
    expect(PERMISSIVE_TENANT_POLICY.canMount('shader')).toBe(true);
    expect(PERMISSIVE_TENANT_POLICY.canMount('voice')).toBe(true);
    expect(PERMISSIVE_TENANT_POLICY.canMount('ai-chat')).toBe(true);
  });

  it('a ClipFactory can be defined and called with a valid MountContext', async () => {
    const onMount = vi.fn();
    const factory: ClipFactory = async (ctx) => {
      onMount(ctx.clip.family);
      const handle: MountHandle = {
        updateProps: () => undefined,
        dispose: () => undefined,
      };
      return handle;
    };

    const root = document.createElement('div');
    const controller = new AbortController();
    const ctx: MountContext = {
      clip: makeInteractiveClip(),
      root,
      permissions: [],
      tenantPolicy: PERMISSIVE_TENANT_POLICY,
      emitTelemetry: () => undefined,
      signal: controller.signal,
    };

    const handle = await factory(ctx);
    expect(typeof handle.updateProps).toBe('function');
    expect(typeof handle.dispose).toBe('function');
    expect(onMount).toHaveBeenCalledWith('shader');
  });
});
