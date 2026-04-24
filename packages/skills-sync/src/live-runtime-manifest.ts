// packages/skills-sync/src/live-runtime-manifest.ts
// Static, hand-maintained manifest of every live runtime registered by
// `@stageflip/cdp-host-bundle`'s `registerAllLiveRuntimes()`. Used by
// `scripts/sync-skills.ts` to build the clips catalogue + runtimes
// index without importing browser-only runtime packages (gsap,
// lottie-web, three, shader modules) at node level.
//
// **Drift protection:** `packages/cdp-host-bundle/src/runtimes.test.ts`
// cross-checks this manifest against `listRuntimes()` after
// `registerAllLiveRuntimes()` fires inside happy-dom. If the live
// registry adds / renames / re-slots a clip and this file isn't
// updated, the cross-check fails with the exact diff. Keep runtime
// order aligned with `LIVE_RUNTIME_IDS`.

import type { ClipsCatalogPkg } from './clips-catalog-gen.js';

export const LIVE_RUNTIME_MANIFEST: ClipsCatalogPkg = {
  runtimes: [
    {
      id: 'css',
      tier: 'live',
      clips: ['solid-background', 'gradient-background'],
    },
    {
      id: 'gsap',
      tier: 'live',
      clips: ['motion-text-gsap'],
    },
    {
      id: 'lottie',
      tier: 'live',
      clips: ['lottie-logo', 'lottie-player'],
    },
    {
      id: 'shader',
      tier: 'live',
      clips: ['flash-through-white', 'swirl-vortex', 'glitch', 'shader-bg'],
    },
    {
      id: 'three',
      tier: 'live',
      clips: ['three-product-reveal'],
    },
    {
      id: 'frame-runtime',
      tier: 'live',
      clips: [
        // T-131b.1 — light tranche
        'counter',
        'kinetic-text',
        'typewriter',
        'logo-intro',
        'chart-build',
        // T-131b.2 — medium tranche
        'subtitle-overlay',
        'light-leak',
        'pie-chart-build',
        'stock-ticker',
        'line-chart-draw',
        // T-131b.3 — heavy tranche
        'animated-value',
        'kpi-grid',
        'pull-quote',
        'comparison-table',
        // T-131d — bridge-eligible lottie/three/shader portion
        'scene-3d',
        'particles',
        // T-131f.1 — bridge standalones
        'code-block',
        'image-gallery',
        'timeline-milestones',
        'audio-visualizer',
        // T-131e.1 — bake-tier clips rendered bridge-style for preview
        'video-background',
        'gif-player',
        // T-131e.2 — audio tranche
        'voiceover-narration',
        'audio-visualizer-reactive',
        // T-131f.2 — dashboard composites
        'hr-dashboard',
        'marketing-dashboard',
        'product-dashboard',
        'okr-dashboard',
        'sales-dashboard',
        // T-131f.3 — financial statement composite
        'financial-statement',
        // T-131d.4 — animated-map
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
      ],
    },
  ],
};
