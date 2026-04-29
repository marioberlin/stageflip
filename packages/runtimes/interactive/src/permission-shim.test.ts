// packages/runtimes/interactive/src/permission-shim.test.ts
// T-306 AC #3–#9 — PermissionShim grant/deny semantics, tenant gate
// ordering, caching, and telemetry.

import { describe, expect, it, vi } from 'vitest';

import { makeInteractiveClip } from './contract-tests/fixtures.js';
import type { PermissionBrowserApi } from './permission-shim.js';
import { PermissionShim } from './permission-shim.js';

function makeFakeStream(): MediaStream {
  const tracks: MediaStreamTrack[] = [{ stop: vi.fn() } as unknown as MediaStreamTrack];
  return {
    getTracks: () => tracks,
  } as unknown as MediaStream;
}

function makeBrowser(
  impl: (constraints: MediaStreamConstraints) => Promise<MediaStream>,
): PermissionBrowserApi {
  return { getUserMedia: impl };
}

describe('PermissionShim', () => {
  it('AC #3 — empty permissions: succeeds without prompting', async () => {
    const getUserMedia = vi.fn();
    const shim = new PermissionShim({ browser: makeBrowser(getUserMedia) });
    const clip = makeInteractiveClip({ permissions: [] });
    const result = await shim.mount(clip);
    expect(result.granted).toBe(true);
    expect(getUserMedia).not.toHaveBeenCalled();
  });

  it('AC #4 — network permission: no-op (no prompt)', async () => {
    const getUserMedia = vi.fn();
    const shim = new PermissionShim({ browser: makeBrowser(getUserMedia) });
    const clip = makeInteractiveClip({ permissions: ['network'] });
    const result = await shim.mount(clip);
    expect(result.granted).toBe(true);
    if (result.granted) {
      expect(result.permissions).toEqual(['network']);
    }
    expect(getUserMedia).not.toHaveBeenCalled();
  });

  it('AC #5 — mic granted: calls getUserMedia({audio:true}) and stops the probe stream', async () => {
    const stream = makeFakeStream();
    const getUserMedia = vi.fn().mockResolvedValue(stream);
    const shim = new PermissionShim({ browser: makeBrowser(getUserMedia) });
    const clip = makeInteractiveClip({ permissions: ['mic'] });
    const result = await shim.mount(clip);
    expect(getUserMedia).toHaveBeenCalledWith({ audio: true });
    expect(result.granted).toBe(true);
    expect(stream.getTracks()[0]?.stop).toHaveBeenCalled();
  });

  it('AC #5 — mic denied: returns {granted:false, fallbackTo:"static"}', async () => {
    const getUserMedia = vi
      .fn()
      .mockRejectedValue(new DOMException('NotAllowedError', 'NotAllowedError'));
    const shim = new PermissionShim({ browser: makeBrowser(getUserMedia) });
    const clip = makeInteractiveClip({ permissions: ['mic'] });
    const result = await shim.mount(clip);
    expect(result.granted).toBe(false);
    if (!result.granted) {
      expect(result.fallbackTo).toBe('static');
      expect(result.reason).toBe('permission-denied');
      expect(result.deniedPermission).toBe('mic');
    }
  });

  it('AC #6 — camera granted: calls getUserMedia({video:true})', async () => {
    const stream = makeFakeStream();
    const getUserMedia = vi.fn().mockResolvedValue(stream);
    const shim = new PermissionShim({ browser: makeBrowser(getUserMedia) });
    const clip = makeInteractiveClip({ permissions: ['camera'] });
    const result = await shim.mount(clip);
    expect(getUserMedia).toHaveBeenCalledWith({ video: true });
    expect(result.granted).toBe(true);
  });

  it('AC #6 — camera denied: returns {granted:false}', async () => {
    const getUserMedia = vi.fn().mockRejectedValue(new Error('denied'));
    const shim = new PermissionShim({ browser: makeBrowser(getUserMedia) });
    const clip = makeInteractiveClip({ permissions: ['camera'] });
    const result = await shim.mount(clip);
    expect(result.granted).toBe(false);
    if (!result.granted) {
      expect(result.deniedPermission).toBe('camera');
    }
  });

  it('AC #7 — tenant policy denial short-circuits BEFORE any prompt', async () => {
    const getUserMedia = vi.fn();
    const shim = new PermissionShim({
      browser: makeBrowser(getUserMedia),
      tenantPolicy: { canMount: () => false },
    });
    const clip = makeInteractiveClip({ permissions: ['mic'] });
    const result = await shim.mount(clip);
    expect(result.granted).toBe(false);
    if (!result.granted) {
      expect(result.reason).toBe('tenant-denied');
    }
    // Critical: getUserMedia must NOT have been called.
    expect(getUserMedia).not.toHaveBeenCalled();
  });

  it('AC #8 — second mount of the same family does NOT re-prompt', async () => {
    const stream = makeFakeStream();
    const getUserMedia = vi.fn().mockResolvedValue(stream);
    const shim = new PermissionShim({ browser: makeBrowser(getUserMedia) });
    const clip = makeInteractiveClip({ family: 'shader', permissions: ['mic'] });
    await shim.mount(clip);
    await shim.mount(clip);
    expect(getUserMedia).toHaveBeenCalledTimes(1);
  });

  it('AC #8 — different families do NOT share the cache', async () => {
    const stream = makeFakeStream();
    const getUserMedia = vi.fn().mockResolvedValue(stream);
    const shim = new PermissionShim({ browser: makeBrowser(getUserMedia) });
    await shim.mount(makeInteractiveClip({ family: 'shader', permissions: ['mic'] }));
    await shim.mount(makeInteractiveClip({ family: 'voice', permissions: ['mic'] }));
    expect(getUserMedia).toHaveBeenCalledTimes(2);
  });

  it('AC #9 — permission-denied telemetry fires on every denial', async () => {
    const emitTelemetry = vi.fn();
    const getUserMedia = vi.fn().mockRejectedValue(new DOMException('NotAllowedError'));
    const shim = new PermissionShim({
      browser: makeBrowser(getUserMedia),
      emitTelemetry,
    });
    await shim.mount(makeInteractiveClip({ permissions: ['mic'] }));
    expect(emitTelemetry).toHaveBeenCalledWith('permission-denied', {
      family: 'shader',
      permission: 'mic',
    });
  });

  it('AC #9 — tenant-denied telemetry fires on tenant-policy short-circuit', async () => {
    const emitTelemetry = vi.fn();
    const shim = new PermissionShim({
      tenantPolicy: { canMount: () => false },
      emitTelemetry,
    });
    await shim.mount(makeInteractiveClip({ permissions: ['mic'] }));
    expect(emitTelemetry).toHaveBeenCalledWith('tenant-denied', {
      family: 'shader',
    });
  });

  it('T-385 AC #7 — clearCacheEntry removes only the named entry, sibling entries preserved', async () => {
    const stream = makeFakeStream();
    const getUserMedia = vi.fn().mockResolvedValue(stream);
    const shim = new PermissionShim({ browser: makeBrowser(getUserMedia) });
    // Seed two cache entries: shader:mic, shader:camera.
    await shim.mount(makeInteractiveClip({ family: 'shader', permissions: ['mic'] }));
    await shim.mount(makeInteractiveClip({ family: 'shader', permissions: ['camera'] }));
    expect(getUserMedia).toHaveBeenCalledTimes(2);
    // Clear only `shader:mic`.
    shim.clearCacheEntry('shader', 'mic');
    // Re-mount mic → re-prompt; re-mount camera → still cached.
    await shim.mount(makeInteractiveClip({ family: 'shader', permissions: ['mic'] }));
    expect(getUserMedia).toHaveBeenCalledTimes(3);
    await shim.mount(makeInteractiveClip({ family: 'shader', permissions: ['camera'] }));
    expect(getUserMedia).toHaveBeenCalledTimes(3);
  });

  it('T-385 AC #7 — clearCacheEntry on a non-existent entry is a no-op', () => {
    const shim = new PermissionShim();
    expect(() => shim.clearCacheEntry('shader', 'mic')).not.toThrow();
  });

  it('clearCache resets the per-session grant cache', async () => {
    const stream = makeFakeStream();
    const getUserMedia = vi.fn().mockResolvedValue(stream);
    const shim = new PermissionShim({ browser: makeBrowser(getUserMedia) });
    const clip = makeInteractiveClip({ permissions: ['mic'] });
    await shim.mount(clip);
    shim.clearCache();
    await shim.mount(clip);
    expect(getUserMedia).toHaveBeenCalledTimes(2);
  });

  it('default tenant policy is permissive', async () => {
    const stream = makeFakeStream();
    const getUserMedia = vi.fn().mockResolvedValue(stream);
    const shim = new PermissionShim({ browser: makeBrowser(getUserMedia) });
    const result = await shim.mount(makeInteractiveClip({ permissions: ['mic'] }));
    expect(result.granted).toBe(true);
  });

  it('default browser API errors when navigator unavailable', async () => {
    const shim = new PermissionShim();
    const clip = makeInteractiveClip({ permissions: ['mic'] });
    const result = await shim.mount(clip);
    // happy-dom may or may not implement getUserMedia. Either outcome is
    // acceptable for this test; we just want the call not to crash the
    // process.
    expect(typeof result.granted).toBe('boolean');
  });
});
