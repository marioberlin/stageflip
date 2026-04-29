// packages/runtimes/interactive/src/permission-flow/use-permission-flow.test.tsx
// T-385 AC #1–#6, #15–#17 — hook-level integration tests covering the state
// machine wired to a real `PermissionShim` plus telemetry assertions.

import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { makeInteractiveClip } from '../contract-tests/fixtures.js';
import type { PermissionBrowserApi } from '../permission-shim.js';
import { PermissionShim } from '../permission-shim.js';
import { usePermissionFlow } from './use-permission-flow.js';

function makeStream(): MediaStream {
  return { getTracks: () => [{ stop: vi.fn() }] } as unknown as MediaStream;
}

function makeBrowser(
  impl: (constraints: MediaStreamConstraints) => Promise<MediaStream>,
): PermissionBrowserApi {
  return { getUserMedia: impl };
}

describe('usePermissionFlow', () => {
  it('AC #1 — initial state is idle', () => {
    const shim = new PermissionShim({ browser: makeBrowser(async () => makeStream()) });
    const clip = makeInteractiveClip({ permissions: ['mic'] });
    const { result } = renderHook(() => usePermissionFlow(clip, { shim }));
    expect(result.current.state).toEqual({ kind: 'idle' });
  });

  it('AC #2 — start with no permissions transitions to granted', async () => {
    const shim = new PermissionShim({ browser: makeBrowser(async () => makeStream()) });
    const clip = makeInteractiveClip({ permissions: [] });
    const { result } = renderHook(() => usePermissionFlow(clip, { shim }));
    act(() => {
      result.current.start();
    });
    expect(result.current.state).toEqual({ kind: 'granted', permissions: [] });
  });

  it('AC #3 — start + permission grant transitions through requesting → granted', async () => {
    const shim = new PermissionShim({ browser: makeBrowser(async () => makeStream()) });
    const clip = makeInteractiveClip({ permissions: ['mic'] });
    const { result } = renderHook(() => usePermissionFlow(clip, { shim }));
    act(() => {
      result.current.start();
    });
    await waitFor(() => {
      expect(result.current.state.kind).toBe('granted');
    });
  });

  it('AC #3 — start + permission denial transitions through requesting → denied', async () => {
    const shim = new PermissionShim({
      browser: makeBrowser(async () => {
        throw new DOMException('NotAllowedError');
      }),
    });
    const clip = makeInteractiveClip({ permissions: ['mic'] });
    const { result } = renderHook(() => usePermissionFlow(clip, { shim }));
    act(() => {
      result.current.start();
    });
    await waitFor(() => {
      expect(result.current.state.kind).toBe('denied');
    });
    if (result.current.state.kind === 'denied') {
      expect(result.current.state.reason).toBe('permission-denied');
      expect(result.current.state.deniedPermission).toBe('mic');
    }
  });

  it('AC #4 — prePrompt:true → pre-prompt state; confirm advances to requesting → granted', async () => {
    const shim = new PermissionShim({ browser: makeBrowser(async () => makeStream()) });
    const clip = makeInteractiveClip({ permissions: ['mic'] });
    const { result } = renderHook(() => usePermissionFlow(clip, { shim, prePrompt: true }));
    act(() => {
      result.current.start();
    });
    expect(result.current.state).toEqual({ kind: 'pre-prompt', permission: 'mic' });
    act(() => {
      result.current.confirmPrePrompt();
    });
    await waitFor(() => {
      expect(result.current.state.kind).toBe('granted');
    });
  });

  it('AC #4 — cancelPrePrompt → denied with reason pre-prompt-cancelled', () => {
    const shim = new PermissionShim({ browser: makeBrowser(async () => makeStream()) });
    const clip = makeInteractiveClip({ permissions: ['mic'] });
    const { result } = renderHook(() => usePermissionFlow(clip, { shim, prePrompt: true }));
    act(() => {
      result.current.start();
    });
    act(() => {
      result.current.cancelPrePrompt();
    });
    expect(result.current.state).toEqual({
      kind: 'denied',
      reason: 'pre-prompt-cancelled',
      deniedPermission: 'mic',
    });
  });

  it('AC #5 — retry from permission-denied clears the cache entry and re-runs the shim', async () => {
    let calls = 0;
    const shim = new PermissionShim({
      browser: makeBrowser(async () => {
        calls += 1;
        if (calls === 1) {
          throw new DOMException('NotAllowedError');
        }
        return makeStream();
      }),
    });
    const clip = makeInteractiveClip({ permissions: ['mic'] });
    const { result } = renderHook(() => usePermissionFlow(clip, { shim }));
    act(() => {
      result.current.start();
    });
    await waitFor(() => {
      expect(result.current.state.kind).toBe('denied');
    });
    act(() => {
      result.current.retry();
    });
    await waitFor(() => {
      expect(result.current.state.kind).toBe('granted');
    });
    expect(calls).toBe(2);
  });

  it('AC #6 — retry on tenant-denied is a no-op (no shim re-call)', async () => {
    const getUserMedia = vi.fn();
    const shim = new PermissionShim({
      browser: { getUserMedia },
      tenantPolicy: { canMount: () => false },
    });
    const clip = makeInteractiveClip({ permissions: ['mic'] });
    const { result } = renderHook(() => usePermissionFlow(clip, { shim }));
    act(() => {
      result.current.start();
    });
    await waitFor(() => {
      expect(result.current.state.kind).toBe('denied');
    });
    if (result.current.state.kind === 'denied') {
      expect(result.current.state.reason).toBe('tenant-denied');
    }
    const before = result.current.state;
    act(() => {
      result.current.retry();
    });
    expect(result.current.state).toBe(before);
    expect(getUserMedia).not.toHaveBeenCalled();
  });

  it('AC #15 — pre-prompt telemetry envelope: shown / confirmed', async () => {
    const emit = vi.fn();
    const shim = new PermissionShim({ browser: makeBrowser(async () => makeStream()) });
    const clip = makeInteractiveClip({ family: 'voice', permissions: ['mic'] });
    const { result } = renderHook(() =>
      usePermissionFlow(clip, { shim, prePrompt: true, emitTelemetry: emit }),
    );
    act(() => {
      result.current.start();
    });
    expect(emit).toHaveBeenCalledWith('permission.pre-prompt.shown', {
      family: 'voice',
      permission: 'mic',
    });
    act(() => {
      result.current.confirmPrePrompt();
    });
    expect(emit).toHaveBeenCalledWith('permission.pre-prompt.confirmed', {
      family: 'voice',
      permission: 'mic',
    });
    await waitFor(() => {
      expect(result.current.state.kind).toBe('granted');
    });
  });

  it('AC #15 — pre-prompt cancel telemetry', () => {
    const emit = vi.fn();
    const shim = new PermissionShim({ browser: makeBrowser(async () => makeStream()) });
    const clip = makeInteractiveClip({ family: 'voice', permissions: ['mic'] });
    const { result } = renderHook(() =>
      usePermissionFlow(clip, { shim, prePrompt: true, emitTelemetry: emit }),
    );
    act(() => {
      result.current.start();
    });
    act(() => {
      result.current.cancelPrePrompt();
    });
    expect(emit).toHaveBeenCalledWith('permission.pre-prompt.cancelled', {
      family: 'voice',
      permission: 'mic',
    });
  });

  it('AC #16 — permission.dialog.shown emits on EVERY browser-prompt invocation (incl. retry)', async () => {
    const emit = vi.fn();
    let calls = 0;
    const shim = new PermissionShim({
      browser: makeBrowser(async () => {
        calls += 1;
        if (calls === 1) {
          throw new DOMException('NotAllowedError');
        }
        return makeStream();
      }),
    });
    const clip = makeInteractiveClip({ permissions: ['mic'] });
    const { result } = renderHook(() => usePermissionFlow(clip, { shim, emitTelemetry: emit }));
    act(() => {
      result.current.start();
    });
    await waitFor(() => {
      expect(result.current.state.kind).toBe('denied');
    });
    act(() => {
      result.current.retry();
    });
    await waitFor(() => {
      expect(result.current.state.kind).toBe('granted');
    });
    const dialogShownCalls = emit.mock.calls.filter((c) => c[0] === 'permission.dialog.shown');
    expect(dialogShownCalls).toHaveLength(2);
  });

  it('AC #15 — retry telemetry: clicked + granted', async () => {
    const emit = vi.fn();
    let calls = 0;
    const shim = new PermissionShim({
      browser: makeBrowser(async () => {
        calls += 1;
        if (calls === 1) {
          throw new DOMException('NotAllowedError');
        }
        return makeStream();
      }),
    });
    const clip = makeInteractiveClip({ permissions: ['mic'] });
    const { result } = renderHook(() => usePermissionFlow(clip, { shim, emitTelemetry: emit }));
    act(() => {
      result.current.start();
    });
    await waitFor(() => {
      expect(result.current.state.kind).toBe('denied');
    });
    act(() => {
      result.current.retry();
    });
    await waitFor(() => {
      expect(result.current.state.kind).toBe('granted');
    });
    expect(emit).toHaveBeenCalledWith('permission.retry.clicked', {
      family: 'shader',
      permission: 'mic',
      attemptNumber: 1,
    });
    expect(emit).toHaveBeenCalledWith('permission.retry.granted', {
      family: 'shader',
      permission: 'mic',
      attemptNumber: 1,
    });
  });

  it('AC #15 — retry-denied telemetry on a still-denying browser', async () => {
    const emit = vi.fn();
    const shim = new PermissionShim({
      browser: makeBrowser(async () => {
        throw new DOMException('NotAllowedError');
      }),
    });
    const clip = makeInteractiveClip({ permissions: ['mic'] });
    const { result } = renderHook(() => usePermissionFlow(clip, { shim, emitTelemetry: emit }));
    act(() => {
      result.current.start();
    });
    await waitFor(() => {
      expect(result.current.state.kind).toBe('denied');
    });
    act(() => {
      result.current.retry();
    });
    await waitFor(() => {
      const denials = emit.mock.calls.filter((c) => c[0] === 'permission.retry.denied');
      expect(denials).toHaveLength(1);
    });
    expect(emit).toHaveBeenCalledWith('permission.retry.denied', {
      family: 'shader',
      permission: 'mic',
      attemptNumber: 1,
    });
  });

  it('AC #17 — pre-prompt cancel does NOT emit permission.dialog.shown', () => {
    const emit = vi.fn();
    const shim = new PermissionShim({ browser: makeBrowser(async () => makeStream()) });
    const clip = makeInteractiveClip({ permissions: ['mic'] });
    const { result } = renderHook(() =>
      usePermissionFlow(clip, { shim, prePrompt: true, emitTelemetry: emit }),
    );
    act(() => {
      result.current.start();
    });
    act(() => {
      result.current.cancelPrePrompt();
    });
    const dialogShown = emit.mock.calls.filter((c) => c[0] === 'permission.dialog.shown');
    expect(dialogShown).toHaveLength(0);
  });

  it('retry from idle / granted is a no-op', () => {
    const shim = new PermissionShim({ browser: makeBrowser(async () => makeStream()) });
    const clip = makeInteractiveClip({ permissions: [] });
    const { result } = renderHook(() => usePermissionFlow(clip, { shim }));
    const initialState = result.current.state;
    act(() => {
      result.current.retry();
    });
    expect(result.current.state).toBe(initialState);
  });

  it('default emitTelemetry is a no-op (no throw)', async () => {
    const shim = new PermissionShim({ browser: makeBrowser(async () => makeStream()) });
    const clip = makeInteractiveClip({ permissions: ['mic'] });
    const { result } = renderHook(() => usePermissionFlow(clip, { shim }));
    act(() => {
      result.current.start();
    });
    await waitFor(() => {
      expect(result.current.state.kind).toBe('granted');
    });
  });

  it('illegal callback ordering does not blow up: confirmPrePrompt from idle', () => {
    const shim = new PermissionShim({ browser: makeBrowser(async () => makeStream()) });
    const clip = makeInteractiveClip({ permissions: ['mic'] });
    const { result } = renderHook(() => usePermissionFlow(clip, { shim }));
    expect(() => {
      act(() => {
        result.current.confirmPrePrompt();
      });
    }).not.toThrow();
    // Reducer ignores the action; state stays idle.
    expect(result.current.state.kind).toBe('idle');
  });
});
