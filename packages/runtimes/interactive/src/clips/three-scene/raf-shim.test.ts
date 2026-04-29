// packages/runtimes/interactive/src/clips/three-scene/raf-shim.test.ts
// T-384 ACs #21–#25 — mount-scoped requestAnimationFrame shim. The shim
// retargets `window.requestAnimationFrame` calls to the FrameSource clock
// so author / library rAF traffic is frame-deterministic.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { RecordModeFrameSource } from '../../frame-source-record.js';
import { installRAFShim } from './raf-shim.js';

describe('installRAFShim (T-384 AC #21–#25)', () => {
  let originalRAF: typeof window.requestAnimationFrame;
  let originalCAF: typeof window.cancelAnimationFrame;

  beforeEach(() => {
    // Snapshot the natural happy-dom rAF / cAF so we can restore even if a
    // test fails between install and uninstall.
    originalRAF = window.requestAnimationFrame;
    originalCAF = window.cancelAnimationFrame;
  });

  afterEach(() => {
    window.requestAnimationFrame = originalRAF;
    window.cancelAnimationFrame = originalCAF;
  });

  it('AC #21 — rAF call enqueues; advancing the frame source fires it', () => {
    const fs = new RecordModeFrameSource();
    const shim = installRAFShim(fs);
    const cb = vi.fn();
    window.requestAnimationFrame(cb);
    expect(cb).not.toHaveBeenCalled();
    fs.advance(1);
    expect(cb).toHaveBeenCalledTimes(1);
    shim.uninstall();
  });

  it('AC #21 — rAF fires once per request (one-shot semantics)', () => {
    const fs = new RecordModeFrameSource();
    const shim = installRAFShim(fs);
    const cb = vi.fn();
    window.requestAnimationFrame(cb);
    fs.advance(5);
    expect(cb).toHaveBeenCalledTimes(1);
    shim.uninstall();
  });

  it('AC #22 — cancelAnimationFrame removes the pending callback', () => {
    const fs = new RecordModeFrameSource();
    const shim = installRAFShim(fs);
    const cb = vi.fn();
    const handle = window.requestAnimationFrame(cb);
    window.cancelAnimationFrame(handle);
    fs.advance(3);
    expect(cb).not.toHaveBeenCalled();
    shim.uninstall();
  });

  it('AC #23 — uninstall restores window.requestAnimationFrame to the original', () => {
    const fs = new RecordModeFrameSource();
    const shim = installRAFShim(fs);
    expect(window.requestAnimationFrame).not.toBe(originalRAF);
    shim.uninstall();
    expect(window.requestAnimationFrame).toBe(originalRAF);
    expect(window.cancelAnimationFrame).toBe(originalCAF);
  });

  it('AC #24 — two concurrent installs share the shim; LIFO uninstall restores original', () => {
    const fs = new RecordModeFrameSource();
    const shimA = installRAFShim(fs);
    const afterA = window.requestAnimationFrame;
    const shimB = installRAFShim(fs);
    // B's install captured A's wrapper as its "original".
    expect(window.requestAnimationFrame).not.toBe(afterA);
    // Uninstall in reverse order (LIFO) restores in two steps:
    // B → A's wrapper → original.
    shimB.uninstall();
    expect(window.requestAnimationFrame).toBe(afterA);
    shimA.uninstall();
    expect(window.requestAnimationFrame).toBe(originalRAF);
  });

  it('AC #24 — under stacked shims, both still fire callbacks via the FrameSource', () => {
    const fs = new RecordModeFrameSource();
    const shimA = installRAFShim(fs);
    const cbA = vi.fn();
    window.requestAnimationFrame(cbA);
    const shimB = installRAFShim(fs);
    const cbB = vi.fn();
    window.requestAnimationFrame(cbB);
    fs.advance(1);
    expect(cbA).toHaveBeenCalledTimes(1);
    expect(cbB).toHaveBeenCalledTimes(1);
    shimB.uninstall();
    shimA.uninstall();
  });

  it('AC #25 — argument passed to callback is the frame number, not a DOMHighResTimeStamp', () => {
    const fs = new RecordModeFrameSource();
    const shim = installRAFShim(fs);
    const cb = vi.fn();
    window.requestAnimationFrame(cb);
    fs.advance(1);
    // RecordModeFrameSource starts at 0; advance(1) emits frame=1.
    expect(cb).toHaveBeenCalledWith(1);
    shim.uninstall();
  });

  it('cancel of an already-fired handle is a no-op', () => {
    const fs = new RecordModeFrameSource();
    const shim = installRAFShim(fs);
    const cb = vi.fn();
    const handle = window.requestAnimationFrame(cb);
    fs.advance(1);
    expect(cb).toHaveBeenCalledTimes(1);
    expect(() => window.cancelAnimationFrame(handle)).not.toThrow();
    shim.uninstall();
  });

  it('uninstall after callback fires is still safe', () => {
    const fs = new RecordModeFrameSource();
    const shim = installRAFShim(fs);
    window.requestAnimationFrame(vi.fn());
    fs.advance(1);
    expect(() => shim.uninstall()).not.toThrow();
  });
});
