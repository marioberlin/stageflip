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

  it('registers all T-131b/d/f.1 + T-131e.1/.2 + T-131f.2/.3 + T-131d.4 + T-183a + T-183b + T-202a + T-202b + T-406 + T-358a + T-356a + T-357a + T-316 + T-355a + T-322 + T-321 + T-324a + T-332a + T-317 + T-318 + T-319 + T-371a + T-321a tranches on the frame-runtime bridge (57 clips)', () => {
    registerAllLiveRuntimes();
    const bridge = listRuntimes().find((r) => r.id === 'frame-runtime');
    expect(bridge?.clips.size).toBe(57);
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
      // f.2 — dashboard composites (f.2a hr+marketing, f.2b product+okr, f.2c sales)
      'hr-dashboard',
      'marketing-dashboard',
      'product-dashboard',
      'okr-dashboard',
      'sales-dashboard',
      // f.3 — financial statement composite
      'financial-statement',
      // d.4 — animated-map (SVG fallback only; mapbox-gl path not ported)
      'animated-map',
      // T-183a — StageFlip.Video profile clips: overlay tranche
      'lower-third',
      'endslate-logo',
      'testimonial-card',
      // T-183b — StageFlip.Video profile clips: motion tranche
      'hook-moment',
      'product-reveal',
      'beat-synced-text',
      // T-202a — StageFlip.Display profile clips: attention tranche
      'click-overlay',
      'countdown',
      'cta-pulse',
      // T-202b — StageFlip.Display profile clips: data tranche
      'price-reveal',
      'product-carousel',
      // T-406 — unified chart family
      'chart',
      // T-358a — outcome-row primitive
      'outcome-row',
      // T-356a — news-ticker-bar primitive
      'news-ticker-bar',
      // T-357a — standings-table primitive
      'standings-table',
      // T-316 — caption primitive
      'caption',
      // T-355a — magic-wall-panel primitive
      'magic-wall-panel',
      // T-322 — lyrics primitive
      'lyrics',
      // T-321 — title-sequence primitive
      'titleSequence',
      // T-324a — breaking-banner primitive
      'breaking-banner',
      // T-332a — score-bug primitive
      'score-bug',
      // T-317 — subscribe-button primitive
      'subscribe-button',
      // T-318 — follow-prompt primitive
      'follow-prompt',
      // T-319 — qr-code-bounce primitive
      'qr-code-bounce',
      // T-371a — link-sticker primitive
      'link-sticker',
      // T-321a — grain primitive
      'grain',
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

  it('matches the static LIVE_RUNTIME_MANIFEST used by @stageflip/skills-sync (T-220)', async () => {
    const { LIVE_RUNTIME_MANIFEST } = await import('@stageflip/skills-sync');
    registerAllLiveRuntimes();
    const live = listRuntimes();

    expect(live.map((r) => r.id)).toEqual(LIVE_RUNTIME_MANIFEST.runtimes.map((r) => r.id));

    for (const manifestRuntime of LIVE_RUNTIME_MANIFEST.runtimes) {
      const liveRuntime = live.find((r) => r.id === manifestRuntime.id);
      expect(
        liveRuntime,
        `manifest lists ${manifestRuntime.id} but registry does not`,
      ).toBeDefined();
      if (!liveRuntime) continue;
      expect(liveRuntime.tier).toBe(manifestRuntime.tier);
      const liveKinds = [...liveRuntime.clips.keys()].sort();
      const manifestKinds = [...manifestRuntime.clips].sort();
      expect(
        liveKinds,
        `${manifestRuntime.id}: manifest clip kinds out of sync with live registry — update packages/skills-sync/src/live-runtime-manifest.ts then run \`pnpm --filter @stageflip/skills-sync build\` + \`pnpm skills-sync\``,
      ).toEqual(manifestKinds);
    }
  });
});
