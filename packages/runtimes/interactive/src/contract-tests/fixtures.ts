// packages/runtimes/interactive/src/contract-tests/fixtures.ts
// Shared fixtures for the interactive runtime tier test suite. Phase γ
// frontier-clip families also import these to avoid drift in clip-shape
// expectations.

import type { InteractiveClip, InteractiveClipFamily } from '@stageflip/schema';

import type { ClipFactory, MountHandle } from '../contract.js';

/**
 * Build a minimal valid `InteractiveClip` for use in tests. Defaults the
 * family to `'shader'`; override per-test as needed.
 */
export function makeInteractiveClip(
  overrides: Partial<{
    family: InteractiveClipFamily;
    permissions: InteractiveClip['liveMount']['permissions'];
    posterFrame: number;
  }> = {},
): InteractiveClip {
  const family = overrides.family ?? 'shader';
  const transform = {
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    rotation: 0,
    opacity: 1,
  };
  const base = {
    id: 'test-clip',
    type: 'interactive-clip' as const,
    family,
    transform,
    visible: true,
    locked: false,
    animations: [],
    staticFallback: [
      {
        id: 'fallback-text',
        type: 'text',
        transform,
        visible: true,
        locked: false,
        animations: [],
        text: 'Static fallback',
      },
    ],
    liveMount: {
      component: { module: '@stageflip/test#StubClip' },
      props: {},
      permissions: overrides.permissions ?? [],
    },
  };
  const result =
    overrides.posterFrame !== undefined ? { ...base, posterFrame: overrides.posterFrame } : base;
  return result as unknown as InteractiveClip;
}

/**
 * Stub `ClipFactory` that returns a handle wired to the supplied spies.
 * Used by both the contract-test suite (validating itself) and any Phase γ
 * test that wants a baseline factory for orchestration tests.
 */
export function makeStubFactory(
  spies: {
    onMount?: () => void;
    onUpdateProps?: (props: Record<string, unknown>) => void;
    onDispose?: () => void;
  } = {},
): ClipFactory {
  return async (ctx) => {
    spies.onMount?.();
    let disposed = false;
    const handle: MountHandle = {
      updateProps: (props) => {
        spies.onUpdateProps?.(props);
      },
      dispose: () => {
        if (disposed) return;
        disposed = true;
        spies.onDispose?.();
      },
    };
    // Minimal DOM presence so happy-dom-based tests can assert on the root.
    const sentinel = ctx.root.ownerDocument.createElement('div');
    sentinel.setAttribute('data-stageflip-stub', ctx.clip.family);
    ctx.root.appendChild(sentinel);
    return handle;
  };
}
