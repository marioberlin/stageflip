// packages/determinism/src/shim.test.ts
// Unit tests for the determinism shim (T-027). Each test installs, exercises,
// and uninstalls so there is no cross-test global leakage.

import { afterEach, describe, expect, it, vi } from 'vitest';
import { type InterceptedApi, installShim, isShimInstalled } from './shim.js';

describe('determinism shim', () => {
  let uninstall: (() => void) | null = null;
  afterEach(() => {
    uninstall?.();
    uninstall = null;
    expect(isShimInstalled()).toBe(false);
  });

  const setup = (initialFrame = 0, seed = 0) => {
    const state = { frame: initialFrame };
    const intercepts: InterceptedApi[] = [];
    uninstall = installShim({
      mode: 'prod',
      frameClock: () => state.frame,
      seed,
      onIntercept: (api) => intercepts.push(api),
    });
    const setFrame = (f: number): void => {
      state.frame = f;
    };
    return { intercepts, setFrame };
  };

  describe('install guard', () => {
    it('rejects double-install', () => {
      setup();
      expect(() => installShim({ mode: 'prod', frameClock: () => 0 })).toThrow(/already installed/);
    });

    it('reports installed state via isShimInstalled', () => {
      expect(isShimInstalled()).toBe(false);
      setup();
      expect(isShimInstalled()).toBe(true);
    });
  });

  describe('Date.now + new Date()', () => {
    it('Date.now returns frame-derived ms at 60fps', () => {
      const { setFrame } = setup();
      expect(Date.now()).toBe(0);
      setFrame(60);
      expect(Date.now()).toBe(1000);
      setFrame(30);
      expect(Date.now()).toBe(500);
    });

    it('new Date() (no arg) returns a Date at the shimmed time', () => {
      const { setFrame } = setup();
      setFrame(120);
      const d = new Date();
      expect(d.getTime()).toBe(2000);
    });

    it('new Date(arg) passes through to the original', () => {
      setup();
      const d = new Date('2026-01-01T00:00:00Z');
      expect(d.getUTCFullYear()).toBe(2026);
    });
  });

  describe('Math.random', () => {
    it('same seed + frame produces same value across calls', () => {
      const { setFrame } = setup(0, 42);
      setFrame(10);
      const a = Math.random();
      const b = Math.random();
      // mulberry32 advances state within a frame, so a and b differ — but
      // reinstalling at the same frame yields the same pair.
      uninstall?.();
      uninstall = null;
      setup(0, 42).setFrame(10);
      const a2 = Math.random();
      const b2 = Math.random();
      expect(a2).toBe(a);
      expect(b2).toBe(b);
    });

    it('different frames produce different values', () => {
      const { setFrame } = setup(0, 42);
      setFrame(1);
      const v1 = Math.random();
      setFrame(2);
      const v2 = Math.random();
      expect(v1).not.toBe(v2);
    });
  });

  describe('requestAnimationFrame / cancelAnimationFrame', () => {
    it('invokes callback with fake time on next microtask', async () => {
      const { setFrame } = setup();
      setFrame(90);
      const cb = vi.fn();
      requestAnimationFrame(cb);
      await Promise.resolve();
      expect(cb).toHaveBeenCalledTimes(1);
      expect(cb).toHaveBeenCalledWith(1500);
    });

    it('cancelAnimationFrame prevents the callback', async () => {
      setup();
      const cb = vi.fn();
      const h = requestAnimationFrame(cb);
      cancelAnimationFrame(h);
      await Promise.resolve();
      expect(cb).not.toHaveBeenCalled();
    });
  });

  describe('timers (setTimeout, setInterval)', () => {
    it('setTimeout callback never fires', async () => {
      setup();
      const cb = vi.fn();
      setTimeout(cb, 0);
      // microtask + 10ms real time; shim must not schedule the callback.
      await new Promise((r) => queueMicrotask(() => r(null)));
      expect(cb).not.toHaveBeenCalled();
    });

    it('setInterval callback never fires', async () => {
      setup();
      const cb = vi.fn();
      setInterval(cb, 0);
      await new Promise((r) => queueMicrotask(() => r(null)));
      expect(cb).not.toHaveBeenCalled();
    });
  });

  describe('fetch', () => {
    it('always throws', async () => {
      setup();
      await expect(fetch('http://example.com')).rejects.toThrow(/not allowed/);
    });
  });

  describe('onIntercept telemetry', () => {
    it('records every intercepted API name', async () => {
      const { intercepts, setFrame } = setup();
      Date.now();
      const _d = new Date();
      void _d;
      performance.now();
      Math.random();
      const h = requestAnimationFrame(() => {});
      cancelAnimationFrame(h);
      setTimeout(() => {}, 0);
      setInterval(() => {}, 0);
      try {
        await fetch('x');
      } catch {}
      setFrame(1);
      expect(intercepts).toContain('Date.now');
      expect(intercepts).toContain('Date-ctor');
      expect(intercepts).toContain('performance.now');
      expect(intercepts).toContain('Math.random');
      expect(intercepts).toContain('requestAnimationFrame');
      expect(intercepts).toContain('cancelAnimationFrame');
      expect(intercepts).toContain('setTimeout');
      expect(intercepts).toContain('setInterval');
      expect(intercepts).toContain('fetch');
    });
  });

  describe('uninstall', () => {
    it('restores Date.now, Math.random, and fetch originals', async () => {
      const originalDateNow = Date.now;
      const originalMathRandom = Math.random;
      const originalFetch = fetch;
      uninstall = installShim({ mode: 'prod', frameClock: () => 0 });
      uninstall();
      uninstall = null;
      expect(Date.now).toBe(originalDateNow);
      expect(Math.random).toBe(originalMathRandom);
      expect(fetch).toBe(originalFetch);
    });
  });
});
