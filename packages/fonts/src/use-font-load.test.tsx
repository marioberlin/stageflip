// packages/fonts/src/use-font-load.test.tsx
// Tests for useFontLoad. Uses a fake FontFaceSet injected via the options
// seam — happy-dom's own `document.fonts` is not exercised so test assertions
// are deterministic across environments.

import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { FontRequirement } from '@stageflip/runtimes-contract';

import { useFontLoad } from './use-font-load.js';

afterEach(cleanup);

type CheckFn = (shorthand: string) => boolean;
type LoadFn = (shorthand: string) => Promise<FontFace[]>;

interface FakeFontFaceSetOptions {
  check?: CheckFn;
  load?: LoadFn;
}

function makeFakeFontFaceSet({ check, load }: FakeFontFaceSetOptions = {}): {
  set: FontFaceSet;
  calls: { check: string[]; load: string[] };
} {
  const calls = { check: [] as string[], load: [] as string[] };
  const checkFn: CheckFn = check ?? (() => true);
  const loadFn: LoadFn = load ?? (async () => []);
  const set = {
    check: vi.fn((s: string) => {
      calls.check.push(s);
      return checkFn(s);
    }),
    load: vi.fn(async (s: string) => {
      calls.load.push(s);
      return loadFn(s);
    }),
  } as unknown as FontFaceSet;
  return { set, calls };
}

describe('useFontLoad — empty requirements', () => {
  it('reports ready immediately when requirements is empty', async () => {
    const { result } = renderHook(() => useFontLoad([]));
    await waitFor(() => {
      expect(result.current.status).toBe('ready');
    });
    expect(result.current.loaded).toEqual([]);
  });
});

describe('useFontLoad — already-resident fonts', () => {
  it('reports ready without calling .load() when check returns true for all', async () => {
    const { set, calls } = makeFakeFontFaceSet({ check: () => true });
    const requirements: FontRequirement[] = [{ family: 'Inter', weight: 400 }];
    const { result } = renderHook(() => useFontLoad(requirements, { fontFaceSet: set }));
    await waitFor(() => {
      expect(result.current.status).toBe('ready');
    });
    expect(calls.check.length).toBeGreaterThan(0);
    expect(calls.load.length).toBe(0);
    expect(result.current.loaded).toHaveLength(1);
  });
});

describe('useFontLoad — load path', () => {
  it('calls .load() when check returns false, then reports ready on resolve', async () => {
    // Per-font resident map so one font loading doesn't make the other
    // appear already-resident.
    const resident = new Map<string, boolean>();
    const { set, calls } = makeFakeFontFaceSet({
      check: (s) => resident.get(s) ?? false,
      load: async (s) => {
        resident.set(s, true);
        return [];
      },
    });
    const requirements: FontRequirement[] = [
      { family: 'Inter', weight: 400 },
      { family: 'Roboto', weight: 600 },
    ];
    const { result } = renderHook(() => useFontLoad(requirements, { fontFaceSet: set }));

    await waitFor(() => {
      expect(result.current.status).toBe('ready');
    });
    expect(calls.load).toHaveLength(2);
    expect(result.current.loaded).toHaveLength(2);
  });

  it('reports error when a load rejects', async () => {
    const { set } = makeFakeFontFaceSet({
      check: () => false,
      load: async () => {
        throw new Error('network error');
      },
    });
    const { result } = renderHook(() =>
      useFontLoad([{ family: 'Broken', weight: 400 }], { fontFaceSet: set }),
    );
    await waitFor(() => {
      expect(result.current.status).toBe('error');
    });
    expect(result.current.error?.message).toMatch(/network error/);
  });

  it('reports error under strict mode when some fonts fail check post-load', async () => {
    // Load resolves but check still returns false → strict mode flags it.
    const { set } = makeFakeFontFaceSet({
      check: () => false,
      load: async () => [],
    });
    const { result } = renderHook(() =>
      useFontLoad([{ family: 'Ghost', weight: 400 }], { fontFaceSet: set }),
    );
    await waitFor(() => {
      expect(result.current.status).toBe('error');
    });
    expect(result.current.error?.message).toMatch(/failed to load/);
  });

  it('with strict=false, reports ready even with partial load', async () => {
    const { set } = makeFakeFontFaceSet({
      check: () => false,
      load: async () => [],
    });
    const { result } = renderHook(() =>
      useFontLoad([{ family: 'Partial', weight: 400 }], { fontFaceSet: set, strict: false }),
    );
    await waitFor(() => {
      expect(result.current.status).toBe('ready');
    });
    expect(result.current.loaded).toHaveLength(0);
  });
});

describe('useFontLoad — empty requirements short-circuits', () => {
  it('does not call any fontFaceSet method when requirements is empty', async () => {
    const { set, calls } = makeFakeFontFaceSet();
    const { result } = renderHook(() => useFontLoad([], { fontFaceSet: set }));
    await waitFor(() => {
      expect(result.current.status).toBe('ready');
    });
    expect(calls.check).toEqual([]);
    expect(calls.load).toEqual([]);
  });
});
