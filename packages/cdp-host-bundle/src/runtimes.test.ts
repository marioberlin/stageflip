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

  it('exposes CSS gradient-background clip via findClip (T-131a)', () => {
    registerAllLiveRuntimes();
    const resolved = findClip('gradient-background');
    expect(resolved?.runtime.id).toBe('css');
  });

  it('exposes GSAP motion-text-gsap clip via findClip', () => {
    registerAllLiveRuntimes();
    const resolved = findClip('motion-text-gsap');
    expect(resolved?.runtime.id).toBe('gsap');
  });

  it('exposes Lottie lottie-logo + lottie-player clips via findClip', () => {
    registerAllLiveRuntimes();
    for (const kind of ['lottie-logo', 'lottie-player']) {
      const resolved = findClip(kind);
      expect(resolved?.runtime.id).toBe('lottie');
    }
  });

  it('exposes Shader flash-through-white + swirl-vortex + glitch + shader-bg clips via findClip', () => {
    registerAllLiveRuntimes();
    for (const kind of ['flash-through-white', 'swirl-vortex', 'glitch', 'shader-bg']) {
      const resolved = findClip(kind);
      expect(resolved?.runtime.id).toBe('shader');
    }
  });

  it('exposes Three three-product-reveal clip via findClip', () => {
    registerAllLiveRuntimes();
    const resolved = findClip('three-product-reveal');
    expect(resolved?.runtime.id).toBe('three');
  });

  it('registers all T-131b/d/f.1 + T-131e.1/.2 tranches on the frame-runtime bridge (24 clips)', () => {
    registerAllLiveRuntimes();
    const bridge = listRuntimes().find((r) => r.id === 'frame-runtime');
    expect(bridge?.clips.size).toBe(24);
    const expectedKinds = [
      // b.1 (light)
      'counter',
      'kinetic-text',
      'typewriter',
      'logo-intro',
      'chart-build',
      // b.2 (medium)
      'subtitle-overlay',
      'light-leak',
      'pie-chart-build',
      'stock-ticker',
      'line-chart-draw',
      // b.3 (heavy)
      'animated-value',
      'kpi-grid',
      'pull-quote',
      'comparison-table',
      // d (revised) — bridge-eligible portion of lottie/three/shader tier
      'scene-3d',
      'particles',
      // f.1 — bridge standalones
      'code-block',
      'image-gallery',
      'timeline-milestones',
      'audio-visualizer',
      // e.1 — bake-tier clips rendered bridge-style for preview
      'video-background',
      'gif-player',
      // e.2 — audio tranche
      'voiceover-narration',
      'audio-visualizer-reactive',
    ];
    for (const kind of expectedKinds) {
      const resolved = findClip(kind);
      expect(resolved?.runtime.id, `${kind} should resolve via the bridge`).toBe('frame-runtime');
    }
  });

  it('throws on a second call without clearing the registry (contract invariant)', () => {
    registerAllLiveRuntimes();
    expect(() => registerAllLiveRuntimes()).toThrow(/is already registered/);
  });
});
