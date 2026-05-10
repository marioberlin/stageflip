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
        // T-406 — unified chart family (consumes ChartElement; dispatches
        // on chartKind to bar/line/area/pie/donut/scatter/combo)
        'chart',
        // T-358a — outcome-row primitive (row of N color-coded chips
        // with staggered fade-in)
        'outcome-row',
        // T-356a — news-ticker-bar primitive (horizontal scrolling
        // chyron of N (1..24) symbol+price+delta+▲/▼/▬ chips,
        // continuous-loop via doubled-row marquee)
        'news-ticker-bar',
        // T-324a — breaking-banner primitive (BREAKING NEWS register;
        // banner / sliver modes; horizontal / vertical slide entrance)
        'breaking-banner',
        // T-357a — standings-table primitive (vertical ranked table of
        // N (1..16) rows × K (2..8) columns of mixed kind: rank /
        // label / numeric / delta / total)
        'standings-table',
        // T-316 — caption primitive (word-level timed text with six
        // built-in visual styles: hormozi / mrbeast / tiktok /
        // ali-abdaal / netflix / karaoke-wipe)
        'caption',
        // T-355a — magic-wall-panel primitive (fullscreen layered
        // hierarchical-data panel of N (1..56) labeled, color-shaded
        // region tiles at absolute-positioned bounds; per-region
        // color override; optional title + subtitle; `valueFormat`
        // dispatch + optional `valueLabel` override; three entrance
        // modes)
        'magic-wall-panel',
        // T-322 — lyrics primitive (line-level music-synced lyric
        // panel with three style bundles: `'karaoke-wipe'` /
        // `'three-line-stack'` / `'highlight-current'`; per-line
        // ms-progress karaoke wipe; per-line entrance; optional
        // glow halo on the active line)
        'lyrics',
        // T-321 — title-sequence primitive (multi-shot prestige-TV
        // title compositor with four sealed style bundles:
        // `'letterform-assemble'` / `'plate-and-credits'` /
        // `'palette-jump-cut'` / `'photographic-overlay'`; five shot
        // kinds; three transition kinds with single-active + 1-shot
        // overlap on fade / dissolve; per-letter staggered entry;
        // viewport-fill ALL-CAPS letterforms; optional glow halo)
        'titleSequence',
        // T-332a — score-bug primitive (single primitive serving six
        // broadcast-sports presets across four sealed style bundles:
        // `'football'` T-333 PL / T-334 Fox NFL / T-335 NBC SNF;
        // `'racing'` T-332 F1; `'cricket'` T-336; `'tennis'` T-337
        // Wimbledon. Discriminated-union schema on `style`; per-style
        // render paths dispatched from a single `switch (style)`
        // block. Static layouts in v1; animation carve-outs T-332b/c/d,
        // T-334a, T-335a, T-336a/b, T-337a/b deferred.)
        'score-bug',
        // T-317 — subscribe-button primitive (Cluster G first entry;
        // sealed-platform creator subscribe / follow CTA button with
        // `platform: 'youtube' | 'tiktok' | 'instagram' | 'generic'`
        // discriminated-union dispatch + three sealed animation
        // phases: `'idle'` 0 → 1.10 → 1.00 entrance bounce overshoot;
        // `'pressing'` 1.00 → 0.95 → 1.00 scale dip;
        // `'subscribed'` static post-press settled state. Brand canon
        // dominates theme on branded platforms; theme-slot fallback
        // only for `'generic'`. Carve-outs: bell-glyph wiggle T-317a,
        // animated cursor slide-in T-317b, infinite-breathing idle
        // pulse T-317c. Unblocks T-369 (youtube-subscribe-bounce).)
        'subscribe-button',
        // T-318 — follow-prompt primitive (Cluster G second entry;
        // sealed-platform vertical-video right-thumb-zone follow CTA
        // with `platform: 'tiktok' | 'instagram' | 'youtube' |
        // 'generic'` discriminated-union dispatch + three sealed
        // animation phases: `'idle'` static avatar circle + corner "+"
        // badge; `'pulsing'` bounded 1.00 → 1.05 → 1.00 scale-pulse
        // over 1500 ms with optional 30%-alpha expanding ring,
        // `pulseRepeat` 1..10; `'followed'` "+" → checkmark glyph
        // swap with 1.00 → 1.20 → 1.00 scale-pop on the badge over
        // 300 ms. Brand canon dominates theme on branded platforms;
        // theme-slot fallback only for `'generic'`. Carve-outs:
        // algorithmic toast T-318a, continuous-breathing pulse T-318b,
        // Instagram story-ring trim T-318c. Unblocks T-370
        // (tiktok-follow-pulse).)
        'follow-prompt',
        // T-319 — qr-code-bounce primitive (Cluster G third entry;
        // first 'qr-code-bounce' kind consumer). DVD-screensaver-
        // bouncing QR code rectangle with rainbow hue cycling on a
        // pure-black backdrop. Single Zod object schema (no platform
        // /register enum), no font surface, no phase enum. Closed-
        // form bounce physics (fold + mod triangle wave); uniform
        // HSL hue rotation. Pre-rendered QR matrix in v1 (live URL
        // →matrix encoding T-319a; branded variant T-319b; custom
        // palettes T-319c). Unblocks T-372 (coinbase-dvd-qr).
        'qr-code-bounce',
        // T-371a — link-sticker primitive (Cluster G fourth entry;
        // first 'link-sticker' kind / 'socialMedia' clipKind
        // consumer). Rounded-pill Instagram-style link sticker free-
        // form-positioned on a Story frame with closed-form linear
        // shimmer / highlight sweep across the label glyphs. Single
        // Zod `object().strict()` schema with sealed `variant` enum
        // (4 values: white-on-dark / dark-on-white / frosted-glass /
        // brand-color) and sealed `phase` enum (2 values: idle /
        // shimmering). NO `discriminatedUnion` — variant drives only
        // color / contrast defaults via a constant token table.
        // Inter Medium (OFL, T-307) registered as fallback font;
        // Instagram proprietary system font is `platform-byo`. v1
        // carve-outs: tap-depress + link-preview card (T-371a-
        // followup), backdrop-filter blur for frosted-glass (T-371a-
        // blur), additional sticker kinds (T-371a-extend), branded
        // icon SVG (T-371a-glyph). Unblocks T-371 (instagram-link-
        // sticker — Cluster G's last unsigned preset).
        'link-sticker',
        // T-321a — grain primitive (Cluster D first carve-out; first
        // 'grain' kind consumer). Deterministic per-pixel film-grain
        // noise overlay computed from `(x, y, frame, seed)` via a
        // closed-form integer hash (xxhash32-style mixer via
        // `Math.imul` + `>>>` for bit-exact 32-bit arithmetic across
        // V8). Single Zod `object().strict()` schema (NO
        // `discriminatedUnion`, NO style/phase enum, NO theme slots,
        // NO font surface) with all-optional props (`intensity`
        // default 0.15, `cellSize` default 1, `seed` default 0,
        // `position` defaults to full canvas). Always-animated. Renders
        // via a single `<canvas>` with `useEffect`-driven `ImageData`
        // write (SVG `<feTurbulence>` rejected for cross-CDP
        // determinism hazard; per-pixel `<rect>` matrix rejected for
        // DOM-size cost). Mandatory for T-348 stranger-things-benguiat
        // per compass canon. Reusable across Cluster D presets (T-348,
        // T-351, T-353). v1 carve-outs: tinted grain (T-321a-tint),
        // blue-noise / Perlin / simplex models (T-321a-noise-quality),
        // multi-octave (T-321a-octaves), ramped intensity (T-321a-
        // ramp). First of five T-321 carve-outs.
        'grain',
        // T-321d — photographic-overlay primitive (Cluster D last new-
        // primitive carve-out from the T-321 roadmap; first
        // 'photographic-overlay' kind consumer). Static film-grade
        // tonal overlay rendered via SVG `<filter>` primitives
        // (`<feColorMatrix>` / `<feComponentTransfer>`). Sealed
        // `mode: 'sepia' | 'cross-process' | 'cinematic-lut' | 'fade'`
        // flat enum with canonical pre-tuned color matrices/curves
        // embedded as static constants; NO theme slots (per D-T321d-9
        // — tonal canon, not brand canvas). NO `discriminatedUnion`
        // — all 4 modes share identical prop surface. Optional
        // `intensity` ∈ [0, 1] alpha-blends the filter onto the
        // underlying via `<feMerge>` chain; optional `position` for
        // partial-frame application. Static (no frame counter; no
        // animation in v1). Deterministic across CDP per SVG 1.1
        // §15.3; pins `color-interpolation-filters="sRGB"` on every
        // filter element. Primary consumer T-351 true-detective-
        // double-exposure; secondary T-348 stranger-things-benguiat.
        // Last new-primitive carve-out from T-321 roadmap (T-321a
        // grain shipped; T-321b lightLeak superseded by T-131b.2;
        // T-321c particles superseded by T-131d.1).
        'photographic-overlay',
        // T-347a — weatherMap primitive (Cluster C first-of-two new
        // primitives; first 'weatherMap' kind consumer). Sealed three-
        // style sealed-bundle compositor: 'mark-allen-clouds' (BBC
        // Mark-Allen icon set + temperature discs) / 'doppler-radar'
        // (NEXRAD reflectivity dBZ palette + sweep beam +
        // productMode reflectivity/velocity) / 'heat-map' (Esri/NWS
        // Meriam 38-class temperature gradient + units F/C). Single
        // primitive, discriminatedUnion on style, canonical palettes
        // baked as static module constants (NOT theme-able per
        // cluster SKILL "Color palettes are standard, not brand"). v1
        // ships flat 2D maps + single-frame static; 3D globe (BBC),
        // multi-frame radar loop, and heat-map time-period cycling
        // deferred to T-347a-3d-globe / T-347a-loop-cycle / T-347a-
        // time-lapse follow-ups. Theme slots: background → palette.
        // background, foreground → palette.foreground (palettes
        // themselves NOT theme-bound). Frame-deterministic. Unblocks
        // 3 of 6 Cluster C presets: bbc-mark-allen-clouds, doppler-
        // dbz-standard, heat-map-cool-to-warm.
        'weatherMap',
        // T-347b — stormTracker primitive (Cluster C second-of-two new
        // primitives; first 'stormTracker' kind consumer). Single-style
        // v1 (no discriminatedUnion — only consumer is nhc-cone-of-
        // uncertainty). NHC 5-day cone-of-uncertainty register with
        // mandatory beyond-cone-impact disclaimer (caller cannot
        // suppress rendering — public-safety failure mode per cluster
        // SKILL "non-negotiable" rule). Canonical NHC coastal-warning
        // palette baked as static module constants
        // (NHC_HURRICANE_WARNING_RED #DC143C,
        // NHC_HURRICANE_WATCH_MAGENTA #FF00FF,
        // NHC_TROPICAL_STORM_FIREBRICK #B22222,
        // NHC_STORM_SURGE_PURPLE #B524F7) + NWS-mandated intensity-
        // letter shorthand NHC_INTENSITY_LETTERS = ['D', 'S', 'H',
        // 'M']. Cone polygon, base map, coastal-warning region paths
        // consumer-supplied as SVG path data per the T-347a mapPaths[]
        // precedent (primitive does NOT bundle storm-by-storm
        // geometry). v1 ships single-frame static; multi-advisory
        // animated time-lapse deferred to T-347b-advisory-cycle;
        // LiveDataClip integration deferred to T-347b-live-data
        // (Track A frontier per ADR-005); 2026 NHC inland-warnings
        // update deferred to T-347b-2026-inland-warnings (would
        // introduce style enum at that point). Theme slots:
        // background → palette.background, foreground → palette.
        // foreground (palettes themselves NOT theme-bound). Frame-
        // deterministic. Unblocks 1 of 6 Cluster C presets:
        // nhc-cone-of-uncertainty.
        'stormTracker',
        // T-347g — weatherStar4000Panel primitive (Cluster C 5/6;
        // dedicated primitive for the WeatherStar 4000 / 5000 era
        // register because the existing magic-wall-panel — which
        // serves the fullScreen clipKind via DEFAULT_CLIP_KIND_RESOLVER
        // — does NOT fit the period-authentic L-bar + 8-bit pixel-
        // precision register). Single-style v1 (no
        // discriminatedUnion); pixel-precision non-negotiable
        // (image-rendering: pixelated, 8-px-step font sizing, no
        // anti-aliasing softeners); closed-form integer ticker
        // scroll (deterministic; no useEffect). Canonical palettes
        // WEATHER_STAR_BLUE_GRADIENT (#000066 → #000099),
        // WEATHER_STAR_ORANGE_GOLD (#FF9900 / #DAA520),
        // WEATHER_STAR_FOREGROUND_WHITE_GOLD (#FFFFFF / #DAA520) NOT
        // theme-bound (TWC RetroCast first-class register canon per
        // cluster SKILL "Retrocast register is nostalgia, not
        // throwaway"). Theme slots: background → palette.background,
        // foreground → palette.foreground. Bound to twc-retrocast-8bit
        // preset via PRESET_ID_BINDINGS (preset clipKind: fullScreen
        // stays unchanged; binding overrides clipName to
        // 'weatherStar4000Panel' per T-328 / T-339 precedent).
        'weatherStar4000Panel',
        // T-347h — imrStaticFallback primitive (Cluster C 6/6 —
        // CLOSES Cluster C ELIGIBLE; dedicated primitive for the
        // TWC IMR static-fallback register; live ThreeSceneClip
        // IMR rendering deferred to T-347h-three-scene Track A
        // frontier per ADR-005). Single-style v1; static-fallback
        // canon explicit per stub line 41 (same posture as T-353
        // severance-surreal-3d). Canonical palettes IMR_STORM_GRAYS
        // (3-stop backdrop), IMR_DANGER_REDS (severity callout),
        // IMR_DATA_FOREGROUND_WHITE NOT theme-bound. Closed-form
        // deterministic SVG noise particle overlay (xxhash32-style
        // integer hash mixer; v1 NOT physics-driven). Severity HUD
        // card bottom-third with 2px-stroked white callout +
        // danger-red side-band; data-label strip top-right. Bound
        // to twc-immersive-mixed-reality preset via
        // PRESET_ID_BINDINGS (preset clipKind: fullScreen stays;
        // binding overrides clipName to 'imrStaticFallback').
        'imrStaticFallback',
      ],
    },
  ],
};
