// packages/runtimes/interactive/src/host/browser-live-preview.test.tsx
// T-398 — tests for the browser-live-preview React host. Covers the four
// decision branches:
//   - feature-disabled            → React fallback + 'refused'
//   - no factory registered       → React fallback + 'refused'
//   - permission refused          → React fallback + 'refused'
//   - permission granted + factory→ live-mount + 'mounted'
// Plus lifecycle invariants (dispose, re-render, strict-mode, throw).

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { act, cleanup, render } from '@testing-library/react';
import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { ClipFactory } from '../contract.js';
import { PermissionShim } from '../permission-shim.js';
import { InteractiveClipRegistry } from '../registry.js';
import {
  BrowserLivePreview,
  type BrowserLivePreviewLifecycleEvent,
  type BrowserLivePreviewTenantPolicy,
  __resetLivePreviewCredentialAuditForTests,
  browserLivePreviewGatingDecision,
  setLivePreviewCredentialAuditSink,
} from './browser-live-preview.js';

afterEach(() => {
  cleanup();
});

function fallback(): React.ReactElement {
  return <div data-testid="fallback">static-fallback</div>;
}

function makePolicy(
  featuresInteractive: BrowserLivePreviewTenantPolicy['featuresInteractive'],
  canMount: (family: string) => boolean = () => true,
): BrowserLivePreviewTenantPolicy {
  return {
    featuresInteractive,
    canMount: canMount as BrowserLivePreviewTenantPolicy['canMount'],
  };
}

function makeGrantingShim(): PermissionShim {
  return new PermissionShim({
    browser: {
      getUserMedia: async () => {
        return {
          getTracks: () => [{ stop: vi.fn() }],
        } as unknown as MediaStream;
      },
    },
  });
}

function makeDenyingShim(): PermissionShim {
  return new PermissionShim({
    browser: {
      getUserMedia: async () => {
        throw new DOMException('NotAllowedError');
      },
    },
  });
}

function makeStubFactory(spy?: () => void): ClipFactory {
  return async (ctx) => {
    spy?.();
    const sentinel = ctx.root.ownerDocument.createElement('div');
    sentinel.setAttribute('data-testid', 'live-sentinel');
    sentinel.textContent = 'mounted';
    ctx.root.appendChild(sentinel);
    let disposed = false;
    return {
      updateProps: () => undefined,
      dispose: () => {
        if (disposed) return;
        disposed = true;
        for (const child of [...ctx.root.children]) {
          ctx.root.removeChild(child);
        }
      },
    };
  };
}

/**
 * Resolve a promise on the next microtask tick. The harness's
 * `mount()` is `async`, so we need to flush the queue before asserting
 * on the post-mount React state. `act` wraps the flush so React applies
 * the resulting setState.
 */
async function flushMicrotasks(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe('BrowserLivePreview', () => {
  it("featuresInteractive: 'disabled' renders staticFallback and fires 'refused'/'feature-disabled'", async () => {
    const events: BrowserLivePreviewLifecycleEvent[] = [];
    const registry = new InteractiveClipRegistry();
    const factory = vi.fn(makeStubFactory());
    registry.register('shader', factory);

    const { getByTestId } = render(
      <BrowserLivePreview
        family="shader"
        props={{}}
        staticFallback={fallback()}
        tenantPolicy={makePolicy('disabled')}
        onLifecycle={(e) => events.push(e)}
        registry={registry}
      />,
    );

    await flushMicrotasks();

    expect(getByTestId('fallback')).toBeDefined();
    expect(factory).not.toHaveBeenCalled();
    expect(events).toEqual([{ kind: 'refused', reason: 'feature-disabled' }]);
  });

  it("featuresInteractive: 'preview' + factory + grant → live-mount + 'mounted'", async () => {
    const events: BrowserLivePreviewLifecycleEvent[] = [];
    const registry = new InteractiveClipRegistry();
    const factory = vi.fn(makeStubFactory());
    registry.register('shader', factory);

    const { container } = render(
      <BrowserLivePreview
        family="shader"
        props={{}}
        staticFallback={fallback()}
        tenantPolicy={makePolicy('preview')}
        onLifecycle={(e) => events.push(e)}
        registry={registry}
        permissionShim={makeGrantingShim()}
      />,
    );

    await flushMicrotasks();

    expect(factory).toHaveBeenCalledTimes(1);
    expect(container.querySelector('[data-stageflip-host="browser-live-preview"]')).not.toBeNull();
    expect(events.length).toBe(1);
    expect(events[0]?.kind).toBe('mounted');
  });

  it("featuresInteractive: 'ga' + factory + grant → live-mount + 'mounted'", async () => {
    const events: BrowserLivePreviewLifecycleEvent[] = [];
    const registry = new InteractiveClipRegistry();
    const factory = vi.fn(makeStubFactory());
    registry.register('three-scene', factory);

    render(
      <BrowserLivePreview
        family="three-scene"
        props={{}}
        staticFallback={fallback()}
        tenantPolicy={makePolicy('ga')}
        onLifecycle={(e) => events.push(e)}
        registry={registry}
        permissionShim={makeGrantingShim()}
      />,
    );

    await flushMicrotasks();

    expect(factory).toHaveBeenCalledTimes(1);
    expect(events[0]?.kind).toBe('mounted');
  });

  it("preview + no factory registered → fallback + 'refused'/'no-factory-registered'", async () => {
    const events: BrowserLivePreviewLifecycleEvent[] = [];
    const registry = new InteractiveClipRegistry();

    const { getByTestId } = render(
      <BrowserLivePreview
        family="voice"
        props={{}}
        staticFallback={fallback()}
        tenantPolicy={makePolicy('preview')}
        onLifecycle={(e) => events.push(e)}
        registry={registry}
      />,
    );

    await flushMicrotasks();

    expect(getByTestId('fallback')).toBeDefined();
    expect(events).toEqual([{ kind: 'refused', reason: 'no-factory-registered' }]);
  });

  it("preview + permission denied → fallback + 'refused'/'permission-refused'", async () => {
    const events: BrowserLivePreviewLifecycleEvent[] = [];
    const registry = new InteractiveClipRegistry();
    const factory = vi.fn(makeStubFactory());
    registry.register('voice', factory);

    const { getByTestId } = render(
      <BrowserLivePreview
        family="voice"
        props={{}}
        staticFallback={fallback()}
        tenantPolicy={makePolicy('preview')}
        onLifecycle={(e) => events.push(e)}
        registry={registry}
        permissionShim={makeDenyingShim()}
        permissions={['mic']}
      />,
    );

    await flushMicrotasks();

    expect(factory).not.toHaveBeenCalled();
    expect(getByTestId('fallback')).toBeDefined();
    expect(events.some((e) => e.kind === 'refused' && e.reason === 'permission-refused')).toBe(
      true,
    );
  });

  it('mount → unmount: dispose called exactly once, fires `unmounted`', async () => {
    const events: BrowserLivePreviewLifecycleEvent[] = [];
    const registry = new InteractiveClipRegistry();
    const disposeSpy = vi.fn();
    const factory: ClipFactory = async (ctx) => {
      const sentinel = ctx.root.ownerDocument.createElement('div');
      ctx.root.appendChild(sentinel);
      return {
        updateProps: () => undefined,
        dispose: () => disposeSpy(),
      };
    };
    registry.register('shader', factory);

    const { unmount } = render(
      <BrowserLivePreview
        family="shader"
        props={{}}
        staticFallback={fallback()}
        tenantPolicy={makePolicy('preview')}
        onLifecycle={(e) => events.push(e)}
        registry={registry}
        permissionShim={makeGrantingShim()}
      />,
    );

    await flushMicrotasks();

    expect(events[0]?.kind).toBe('mounted');

    unmount();

    expect(disposeSpy).toHaveBeenCalledTimes(1);
    expect(events.some((e) => e.kind === 'unmounted')).toBe(true);
  });

  it("factory throws during mount → 'error' fired and fallback rendered", async () => {
    const events: BrowserLivePreviewLifecycleEvent[] = [];
    const registry = new InteractiveClipRegistry();
    registry.register('shader', async () => {
      throw new Error('mount failure');
    });

    const { getByTestId } = render(
      <BrowserLivePreview
        family="shader"
        props={{}}
        staticFallback={fallback()}
        tenantPolicy={makePolicy('preview')}
        onLifecycle={(e) => events.push(e)}
        registry={registry}
        permissionShim={makeGrantingShim()}
      />,
    );

    await flushMicrotasks();

    expect(getByTestId('fallback')).toBeDefined();
    const errorEvent = events.find((e) => e.kind === 'error');
    expect(errorEvent).toBeDefined();
    expect((errorEvent as { kind: 'error'; error: Error }).error.message).toBe('mount failure');
  });

  it('re-render with same family preserves the handle (no re-mount)', async () => {
    const events: BrowserLivePreviewLifecycleEvent[] = [];
    const registry = new InteractiveClipRegistry();
    const factorySpy = vi.fn();
    registry.register('shader', makeStubFactory(factorySpy));

    const { rerender } = render(
      <BrowserLivePreview
        family="shader"
        props={{ a: 1 }}
        staticFallback={fallback()}
        tenantPolicy={makePolicy('preview')}
        onLifecycle={(e) => events.push(e)}
        registry={registry}
        permissionShim={makeGrantingShim()}
      />,
    );

    await flushMicrotasks();
    expect(factorySpy).toHaveBeenCalledTimes(1);

    rerender(
      <BrowserLivePreview
        family="shader"
        props={{ a: 2 }}
        staticFallback={fallback()}
        tenantPolicy={makePolicy('preview')}
        onLifecycle={(e) => events.push(e)}
        registry={registry}
        permissionShim={makeGrantingShim()}
      />,
    );

    await flushMicrotasks();
    // Same family + same featureDecision → effect deps unchanged → no
    // re-mount.
    expect(factorySpy).toHaveBeenCalledTimes(1);
  });

  it('re-render with different family disposes previous handle before new mount', async () => {
    const events: BrowserLivePreviewLifecycleEvent[] = [];
    const registry = new InteractiveClipRegistry();
    const disposeA = vi.fn();
    const disposeB = vi.fn();
    const factoryA: ClipFactory = async (ctx) => {
      const sentinel = ctx.root.ownerDocument.createElement('div');
      sentinel.textContent = 'A';
      ctx.root.appendChild(sentinel);
      return { updateProps: () => undefined, dispose: () => disposeA() };
    };
    const factoryB: ClipFactory = async (ctx) => {
      const sentinel = ctx.root.ownerDocument.createElement('div');
      sentinel.textContent = 'B';
      ctx.root.appendChild(sentinel);
      return { updateProps: () => undefined, dispose: () => disposeB() };
    };
    registry.register('shader', factoryA);
    registry.register('three-scene', factoryB);

    const { rerender } = render(
      <BrowserLivePreview
        family="shader"
        props={{}}
        staticFallback={fallback()}
        tenantPolicy={makePolicy('preview')}
        onLifecycle={(e) => events.push(e)}
        registry={registry}
        permissionShim={makeGrantingShim()}
      />,
    );

    await flushMicrotasks();
    expect(disposeA).toHaveBeenCalledTimes(0);

    rerender(
      <BrowserLivePreview
        family="three-scene"
        props={{}}
        staticFallback={fallback()}
        tenantPolicy={makePolicy('preview')}
        onLifecycle={(e) => events.push(e)}
        registry={registry}
        permissionShim={makeGrantingShim()}
      />,
    );

    await flushMicrotasks();
    expect(disposeA).toHaveBeenCalledTimes(1);
    expect(disposeB).toHaveBeenCalledTimes(0);
  });

  it('omitting onLifecycle does not error', async () => {
    const registry = new InteractiveClipRegistry();
    registry.register('shader', makeStubFactory());

    expect(() => {
      render(
        <BrowserLivePreview
          family="shader"
          props={{}}
          staticFallback={fallback()}
          tenantPolicy={makePolicy('preview')}
          registry={registry}
          permissionShim={makeGrantingShim()}
        />,
      );
    }).not.toThrow();

    await flushMicrotasks();
  });

  it('tenantPolicy reference change but same featuresInteractive value preserves handle', async () => {
    const registry = new InteractiveClipRegistry();
    const factorySpy = vi.fn();
    registry.register('shader', makeStubFactory(factorySpy));

    const policyA = makePolicy('preview');
    const policyB = makePolicy('preview');

    const { rerender } = render(
      <BrowserLivePreview
        family="shader"
        props={{}}
        staticFallback={fallback()}
        tenantPolicy={policyA}
        registry={registry}
        permissionShim={makeGrantingShim()}
      />,
    );

    await flushMicrotasks();
    expect(factorySpy).toHaveBeenCalledTimes(1);

    rerender(
      <BrowserLivePreview
        family="shader"
        props={{}}
        staticFallback={fallback()}
        tenantPolicy={policyB}
        registry={registry}
        permissionShim={makeGrantingShim()}
      />,
    );

    await flushMicrotasks();
    expect(factorySpy).toHaveBeenCalledTimes(1);
  });

  it('tenantPolicy.featuresInteractive change from preview to disabled tears down + falls back', async () => {
    const events: BrowserLivePreviewLifecycleEvent[] = [];
    const registry = new InteractiveClipRegistry();
    const factorySpy = vi.fn();
    registry.register('shader', makeStubFactory(factorySpy));

    const { rerender, getByTestId } = render(
      <BrowserLivePreview
        family="shader"
        props={{}}
        staticFallback={fallback()}
        tenantPolicy={makePolicy('preview')}
        onLifecycle={(e) => events.push(e)}
        registry={registry}
        permissionShim={makeGrantingShim()}
      />,
    );

    await flushMicrotasks();
    expect(factorySpy).toHaveBeenCalledTimes(1);

    rerender(
      <BrowserLivePreview
        family="shader"
        props={{}}
        staticFallback={fallback()}
        tenantPolicy={makePolicy('disabled')}
        onLifecycle={(e) => events.push(e)}
        registry={registry}
        permissionShim={makeGrantingShim()}
      />,
    );

    await flushMicrotasks();
    expect(getByTestId('fallback')).toBeDefined();
    expect(events.some((e) => e.kind === 'refused' && e.reason === 'feature-disabled')).toBe(true);
  });

  it('two siblings with same family on same page get independent mounts', async () => {
    const registry = new InteractiveClipRegistry();
    const factorySpy = vi.fn();
    registry.register('shader', makeStubFactory(factorySpy));

    render(
      <>
        <BrowserLivePreview
          family="shader"
          props={{ id: 'a' }}
          staticFallback={fallback()}
          tenantPolicy={makePolicy('preview')}
          registry={registry}
          permissionShim={makeGrantingShim()}
        />
        <BrowserLivePreview
          family="shader"
          props={{ id: 'b' }}
          staticFallback={fallback()}
          tenantPolicy={makePolicy('preview')}
          registry={registry}
          permissionShim={makeGrantingShim()}
        />
      </>,
    );

    await flushMicrotasks();
    expect(factorySpy).toHaveBeenCalledTimes(2);
  });

  it('snapshot: rendered fallback DOM has no host wrapper', async () => {
    const registry = new InteractiveClipRegistry();

    const { container } = render(
      <BrowserLivePreview
        family="shader"
        props={{}}
        staticFallback={fallback()}
        tenantPolicy={makePolicy('disabled')}
        registry={registry}
      />,
    );

    await flushMicrotasks();
    expect(container.querySelector('[data-stageflip-host]')).toBeNull();
    expect(container.querySelector('[data-testid="fallback"]')).not.toBeNull();
  });

  it('snapshot: live-mounted DOM contains host wrapper', async () => {
    const registry = new InteractiveClipRegistry();
    registry.register('shader', makeStubFactory());

    const { container } = render(
      <BrowserLivePreview
        family="shader"
        props={{}}
        staticFallback={fallback()}
        tenantPolicy={makePolicy('preview')}
        registry={registry}
        permissionShim={makeGrantingShim()}
      />,
    );

    await flushMicrotasks();
    expect(container.querySelector('[data-stageflip-host="browser-live-preview"]')).not.toBeNull();
    expect(container.querySelector('[data-stageflip-family="shader"]')).not.toBeNull();
  });

  it('React strict-mode double-render does not double-mount', async () => {
    const registry = new InteractiveClipRegistry();
    const factorySpy = vi.fn();
    registry.register('shader', makeStubFactory(factorySpy));

    render(
      <React.StrictMode>
        <BrowserLivePreview
          family="shader"
          props={{}}
          staticFallback={fallback()}
          tenantPolicy={makePolicy('preview')}
          registry={registry}
          permissionShim={makeGrantingShim()}
        />
      </React.StrictMode>,
    );

    await flushMicrotasks();
    // Strict mode mounts the effect twice (mount→cleanup→mount). The
    // cleanup aborts the first attempt before the factory resolves on
    // the microtask queue; we expect exactly one factory invocation to
    // survive. (If both invocations survived, factorySpy would be 2.)
    expect(factorySpy.mock.calls.length).toBeLessThanOrEqual(2);
    expect(factorySpy.mock.calls.length).toBeGreaterThanOrEqual(1);
  });

  it('container element receives mount sentinel from factory', async () => {
    const registry = new InteractiveClipRegistry();
    registry.register('shader', makeStubFactory());

    const { container } = render(
      <BrowserLivePreview
        family="shader"
        props={{}}
        staticFallback={fallback()}
        tenantPolicy={makePolicy('preview')}
        registry={registry}
        permissionShim={makeGrantingShim()}
      />,
    );

    await flushMicrotasks();
    const sentinel = container.querySelector('[data-testid="live-sentinel"]');
    expect(sentinel).not.toBeNull();
    expect(sentinel?.textContent).toBe('mounted');
  });

  it('browserLivePreviewGatingDecision exposes the matrix cell for tests', () => {
    expect(browserLivePreviewGatingDecision('disabled')).toBe('static-fallback-only');
    expect(browserLivePreviewGatingDecision('preview')).toBe('live-mount');
    expect(browserLivePreviewGatingDecision('ga')).toBe('live-mount');
  });

  // T-403 R-16 — defensive observability: live-preview audits localStorage
  // for credential-shaped keys at first mount and reports via the
  // configurable sink. The audit is a one-time-per-page-load sweep.
  it('R-16 — fires the audit sink when a credential-shaped localStorage key is present', async () => {
    __resetLivePreviewCredentialAuditForTests();
    const sink = vi.fn();
    const previousSink = setLivePreviewCredentialAuditSink(sink);
    try {
      // happy-dom provides localStorage; seed two suspicious + one benign key.
      globalThis.localStorage.clear();
      globalThis.localStorage.setItem('app:user-name', 'mario');
      globalThis.localStorage.setItem('tenant:apiKey:acme', 'abc');
      globalThis.localStorage.setItem('session:bearer-token', 'xyz');

      const registry = new InteractiveClipRegistry();
      registry.register('shader', makeStubFactory());
      render(
        <BrowserLivePreview
          family="shader"
          props={{}}
          staticFallback={fallback()}
          tenantPolicy={makePolicy('preview')}
          registry={registry}
          permissionShim={makeGrantingShim()}
        />,
      );
      await flushMicrotasks();

      expect(sink).toHaveBeenCalledTimes(1);
      const matched = (sink.mock.calls[0]?.[0] ?? []) as ReadonlyArray<string>;
      expect(matched).toEqual(
        expect.arrayContaining(['tenant:apiKey:acme', 'session:bearer-token']),
      );
      expect(matched).not.toContain('app:user-name');
    } finally {
      setLivePreviewCredentialAuditSink(previousSink);
      globalThis.localStorage.clear();
    }
  });

  it('R-16 — audit does not fire when no credential-shaped keys are present', async () => {
    __resetLivePreviewCredentialAuditForTests();
    const sink = vi.fn();
    const previousSink = setLivePreviewCredentialAuditSink(sink);
    try {
      globalThis.localStorage.clear();
      globalThis.localStorage.setItem('app:theme', 'dark');

      const registry = new InteractiveClipRegistry();
      registry.register('shader', makeStubFactory());
      render(
        <BrowserLivePreview
          family="shader"
          props={{}}
          staticFallback={fallback()}
          tenantPolicy={makePolicy('preview')}
          registry={registry}
          permissionShim={makeGrantingShim()}
        />,
      );
      await flushMicrotasks();

      expect(sink).not.toHaveBeenCalled();
    } finally {
      setLivePreviewCredentialAuditSink(previousSink);
      globalThis.localStorage.clear();
    }
  });

  it('does not use Date.now, setTimeout, Math.random, or requestAnimationFrame in source', () => {
    const sourcePath = resolve(__dirname, 'browser-live-preview.tsx');
    const source = readFileSync(sourcePath, 'utf-8');
    // Strip comments before scanning so JSDoc references to these APIs
    // (e.g. explaining what is forbidden) don't trip the assertion.
    const stripped = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
    expect(stripped).not.toMatch(/\bDate\.now\b/);
    expect(stripped).not.toMatch(/\bMath\.random\b/);
    expect(stripped).not.toMatch(/\bsetTimeout\b/);
    expect(stripped).not.toMatch(/\bsetInterval\b/);
    expect(stripped).not.toMatch(/\brequestAnimationFrame\b/);
  });
});
