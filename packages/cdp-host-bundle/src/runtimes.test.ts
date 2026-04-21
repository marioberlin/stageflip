// packages/cdp-host-bundle/src/runtimes.test.ts
// Unit coverage for registerAllLiveRuntimes — verifies that every
// id in LIVE_RUNTIME_IDS is registered and at least one demo clip
// per runtime (except the frame-runtime-bridge, which is registered
// empty) resolves via findClip.

import { __clearRuntimeRegistry, findClip, listRuntimes } from '@stageflip/runtimes-contract';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { LIVE_RUNTIME_IDS, registerAllLiveRuntimes } from './runtimes';

describe('registerAllLiveRuntimes', () => {
  beforeEach(() => {
    __clearRuntimeRegistry();
  });
  afterEach(() => {
    __clearRuntimeRegistry();
  });

  it('registers exactly the 6 live runtime ids', () => {
    registerAllLiveRuntimes();
    const registered = listRuntimes().map((r) => r.id);
    expect(registered).toEqual([...LIVE_RUNTIME_IDS]);
  });

  it('registers each runtime under tier="live"', () => {
    registerAllLiveRuntimes();
    for (const r of listRuntimes()) {
      expect(r.tier).toBe('live');
    }
  });

  it('exposes CSS solid-background clip via findClip', () => {
    registerAllLiveRuntimes();
    const resolved = findClip('solid-background');
    expect(resolved?.runtime.id).toBe('css');
  });

  it('exposes GSAP motion-text-gsap clip via findClip', () => {
    registerAllLiveRuntimes();
    const resolved = findClip('motion-text-gsap');
    expect(resolved?.runtime.id).toBe('gsap');
  });

  it('exposes Lottie lottie-logo clip via findClip', () => {
    registerAllLiveRuntimes();
    const resolved = findClip('lottie-logo');
    expect(resolved?.runtime.id).toBe('lottie');
  });

  it('exposes Shader flash-through-white + swirl-vortex + glitch clips via findClip', () => {
    registerAllLiveRuntimes();
    for (const kind of ['flash-through-white', 'swirl-vortex', 'glitch']) {
      const resolved = findClip(kind);
      expect(resolved?.runtime.id).toBe('shader');
    }
  });

  it('exposes Three three-product-reveal clip via findClip', () => {
    registerAllLiveRuntimes();
    const resolved = findClip('three-product-reveal');
    expect(resolved?.runtime.id).toBe('three');
  });

  it('registers frame-runtime-bridge with zero clips (meta-runtime)', () => {
    registerAllLiveRuntimes();
    const bridge = listRuntimes().find((r) => r.id === 'frame-runtime');
    expect(bridge?.clips.size).toBe(0);
  });

  it('throws on a second call without clearing the registry (contract invariant)', () => {
    registerAllLiveRuntimes();
    expect(() => registerAllLiveRuntimes()).toThrow(/is already registered/);
  });
});
