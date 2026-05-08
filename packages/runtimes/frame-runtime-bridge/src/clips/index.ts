// packages/runtimes/frame-runtime-bridge/src/clips/index.ts
// T-131b.1 barrel — frame-runtime-bridge demo clips ported from
// reference/slidemotion/.../clips/. Each clip declares a Zod propsSchema
// (T-125b) and themeSlots (T-131a). Add new clips here as the b/c/d/e
// tranches land.

export {
  Counter,
  type CounterProps,
  counterClip,
  counterPropsSchema,
} from './counter.js';

export {
  KineticText,
  type KineticTextProps,
  kineticTextClip,
  kineticTextPropsSchema,
} from './kinetic-text.js';

export {
  TypewriterClip,
  type TypewriterClipProps,
  typewriterClip,
  typewriterClipPropsSchema,
} from './typewriter-clip.js';

export {
  LogoIntro,
  type LogoIntroProps,
  logoIntroClip,
  logoIntroPropsSchema,
} from './logo-intro.js';

// T-183a — StageFlip.Video profile clips (overlay tranche).
export {
  LowerThird,
  type LowerThirdProps,
  lowerThirdClip,
  lowerThirdPropsSchema,
} from './lower-third.js';
export {
  EndslateLogo,
  type EndslateLogoProps,
  endslateLogoClip,
  endslateLogoPropsSchema,
} from './endslate-logo.js';
export {
  TestimonialCard,
  type TestimonialCardProps,
  testimonialCardClip,
  testimonialCardPropsSchema,
} from './testimonial-card.js';

// T-183b — StageFlip.Video profile clips (motion tranche).
export {
  HookMoment,
  type HookMomentProps,
  hookMomentClip,
  hookMomentPropsSchema,
} from './hook-moment.js';
export {
  ProductReveal,
  type ProductRevealProps,
  productRevealClip,
  productRevealPropsSchema,
} from './product-reveal.js';
export {
  BeatSyncedText,
  type BeatSyncedTextProps,
  beatSyncedTextClip,
  beatSyncedTextPropsSchema,
  currentBeatIndex,
} from './beat-synced-text.js';

// T-202a — StageFlip.Display profile clips (attention tranche).
export {
  ClickOverlay,
  type ClickOverlayProps,
  clickOverlayClip,
  clickOverlayPropsSchema,
} from './click-overlay.js';
export {
  Countdown,
  type CountdownProps,
  countdownClip,
  countdownPropsSchema,
  formatCountdown,
  secondsRemaining,
} from './countdown.js';
export {
  CtaPulse,
  type CtaPulseProps,
  ctaPulseClip,
  ctaPulsePropsSchema,
  pulseScale,
} from './cta-pulse.js';

// T-202b — StageFlip.Display profile clips (data tranche).
export {
  PriceReveal,
  type PriceRevealProps,
  priceRevealClip,
  priceRevealPropsSchema,
} from './price-reveal.js';
export {
  type CarouselItem,
  ProductCarousel,
  type ProductCarouselProps,
  carouselItemSchema,
  carouselSlotsAtFrame,
  productCarouselClip,
  productCarouselPropsSchema,
} from './product-carousel.js';

export {
  ChartBuild,
  type ChartBuildProps,
  chartBuildClip,
  chartBuildPropsSchema,
} from './chart-build.js';

export {
  SubtitleOverlay,
  type SubtitleOverlayProps,
  subtitleOverlayClip,
  subtitleOverlayPropsSchema,
} from './subtitle-overlay.js';

export {
  LightLeak,
  type LightLeakProps,
  lightLeakClip,
  lightLeakPropsSchema,
} from './light-leak.js';

export {
  PieChartBuild,
  type PieChartBuildProps,
  pieChartBuildClip,
  pieChartBuildPropsSchema,
} from './pie-chart-build.js';

export {
  StockTicker,
  type StockTickerProps,
  stockTickerClip,
  stockTickerPropsSchema,
} from './stock-ticker.js';

export {
  LineChartDraw,
  type LineChartDrawProps,
  lineChartDrawClip,
  lineChartDrawPropsSchema,
} from './line-chart-draw.js';

export {
  AnimatedProgressBar,
  type AnimatedProgressBarProps,
  AnimatedProgressRing,
  type AnimatedProgressRingProps,
  AnimatedValue,
  type AnimatedValueProps,
  animatedValueClip,
  animatedValuePropsSchema,
} from './animated-value.js';

export {
  KpiGrid,
  type KpiGridProps,
  kpiGridClip,
  kpiGridPropsSchema,
} from './kpi-grid.js';

export {
  PullQuote,
  type PullQuoteProps,
  pullQuoteClip,
  pullQuotePropsSchema,
} from './pull-quote.js';

export {
  ComparisonTable,
  type ComparisonTableProps,
  comparisonTableClip,
  comparisonTablePropsSchema,
} from './comparison-table.js';

export {
  Scene3D,
  type Scene3DProps,
  scene3dClip,
  scene3dPropsSchema,
} from './scene-3d.js';

export {
  type ParticleStyle,
  Particles,
  type ParticlesProps,
  particlesClip,
  particlesPropsSchema,
} from './particles.js';

export {
  CodeBlock,
  type CodeBlockProps,
  type CodeLanguage,
  codeBlockClip,
  codeBlockPropsSchema,
  tokenizeLine,
} from './code-block.js';

export {
  ImageGallery,
  type ImageGalleryProps,
  imageGalleryClip,
  imageGalleryPropsSchema,
} from './image-gallery.js';

export {
  TimelineMilestones,
  type TimelineMilestonesProps,
  timelineMilestonesClip,
  timelineMilestonesPropsSchema,
} from './timeline-milestones.js';

export {
  AudioVisualizer,
  type AudioVisualizerProps,
  type VisualizerStyle,
  audioVisualizerClip,
  audioVisualizerPropsSchema,
  generateBars,
} from './audio-visualizer.js';

export {
  VideoBackground,
  type VideoBackgroundProps,
  videoBackgroundClip,
  videoBackgroundPropsSchema,
} from './video-background.js';

export {
  GifPlayer,
  type GifPlayerProps,
  gifPlayerClip,
  gifPlayerPropsSchema,
} from './gif-player.js';

export {
  VoiceoverNarration,
  type VoiceoverNarrationProps,
  type NarrationSegment,
  voiceoverNarrationClip,
  voiceoverNarrationPropsSchema,
} from './voiceover-narration.js';

export {
  AudioVisualizerReactive,
  type AudioVisualizerReactiveProps,
  audioVisualizerReactiveClip,
  audioVisualizerReactivePropsSchema,
} from './audio-visualizer-reactive.js';

export {
  HrDashboard,
  type HrDashboardDepartment,
  type HrDashboardMetric,
  type HrDashboardProps,
  hrDashboardClip,
  hrDashboardPropsSchema,
} from './hr-dashboard.js';

export {
  MarketingDashboard,
  type MarketingDashboardChannel,
  type MarketingDashboardFunnelStage,
  type MarketingDashboardKpi,
  type MarketingDashboardProps,
  marketingDashboardClip,
  marketingDashboardPropsSchema,
} from './marketing-dashboard.js';

export {
  ProductDashboard,
  type ProductDashboardProps,
  type ProductFeature,
  type ProductFeaturePriority,
  type ProductFeatureStatus,
  type ProductMetric,
  type ProductReportType,
  productDashboardClip,
  productDashboardPropsSchema,
} from './product-dashboard.js';

// `ObjectiveCard` is intentionally NOT exported — it's private to
// okr-dashboard today. If a future clip needs it, the export should
// land in the same PR that introduces the caller.
export {
  OkrDashboard,
  type OkrDashboardProps,
  type OkrKeyResult,
  type OkrStatus,
  type Objective,
  okrDashboardClip,
  okrDashboardPropsSchema,
} from './okr-dashboard.js';

// sales-dashboard inlines its own PipelineFunnel / ForecastChart /
// DealCard sub-components — no public export for them (single-consumer).
export {
  SalesDashboard,
  type SalesDashboardProps,
  type SalesDeal,
  type SalesDealStage,
  type SalesDealStatus,
  type SalesPipelineType,
  type SalesSettings,
  type SalesSummary,
  salesDashboardClip,
  salesDashboardPropsSchema,
} from './sales-dashboard.js';

// financial-statement inlines its own KpiStrip / StatementTable /
// CommentsRail sub-components — same single-consumer discipline.
export {
  FinancialStatement,
  type FinancialStatementProps,
  type StatementComment,
  type StatementDensity,
  type StatementPeriod,
  type StatementPeriodEmphasis,
  type StatementRow,
  type StatementRowKind,
  type StatementSemanticRole,
  type StatementSettings,
  type StatementType,
  financialStatementClip,
  financialStatementPropsSchema,
} from './financial-statement.js';

// animated-map ships the SVG-fallback path only (T-131d.4). Real Mapbox
// tiles require network fetches + imperative useEffect DOM mutation —
// both non-starters under frame-runtime determinism. See clip file header
// for the rationale.
export {
  AnimatedMap,
  type AnimatedMapProps,
  type AnimatedMapStyle,
  animatedMapClip,
  animatedMapPropsSchema,
} from './animated-map.js';

// T-406 — Chart clip family. Unified ChartElement renderer over 7
// chartKinds. Distinct from the standalone chart-build / pie-chart-
// build / line-chart-draw clips (T-131b) which remain available.
export {
  ChartClip,
  type ChartProps,
  chartClip,
  chartPropsSchema,
} from './chart/index.js';

// T-358a — outcome-row primitive. Generic row of N (1..12) color-coded
// chips with staggered fade-in; unblocks Cluster B/E scorebug-family
// presets (T-358 cricket ball-by-ball, tennis tiebreak, F1 sectors,
// soccer last-N-shots).
export {
  OutcomeRow,
  type OutcomeRowProps,
  outcomeRowClip,
  outcomeRowPropsSchema,
} from './outcome-row.js';

// T-356a — news-ticker-bar primitive. Generic horizontal scrolling
// chyron of N (1..24) symbol+price+delta+▲/▼/▬ chips translating left
// at frame-derived offset; continuous loop via doubled-row marquee.
// Unblocks T-356 (Bloomberg market chyron) and Cluster A/B/E ticker
// presets (CNN/Fox breaking-news, ESPN BottomLine, crypto dashboards).
export {
  NewsTickerBar,
  type NewsTickerBarProps,
  newsTickerBarClip,
  newsTickerBarPropsSchema,
} from './news-ticker-bar.js';

// T-324a — breaking-banner primitive. Single "BREAKING NEWS" register
// serving CNN-style horizontal slide-in banners (`mode: 'banner'`,
// default) and Fox-style persistent narrow slivers (`mode: 'sliver'`).
// `slideAxis: 'horizontal' | 'vertical'` swaps the entrance translate
// axis; sliver mode skips entrance per D-T324a-6. Unblocks T-324
// (cnn-breaking) and T-327 (fox-news-alert).
export {
  BreakingBanner,
  type BreakingBannerProps,
  breakingBannerClip,
  breakingBannerPropsSchema,
} from './breaking-banner.js';

// T-357a — standings-table primitive. Generic vertical ranked table of
// N (1..16) rows × K (2..8) columns of mixed kind (rank/label/numeric/
// delta/total) with per-column color tinting + delta-arrow glyphs (↑ /
// ↓ / ▬) + frame-derived per-row entrance stagger. Unblocks T-357
// (olympic-medal-tracker) and broader Cluster A/B/E ranked-list presets
// (F1 / NBA / NCAA / golf leaderboards, election results, crypto
// top-N dashboards).
export {
  StandingsTable,
  type StandingsTableProps,
  standingsTableClip,
  standingsTablePropsSchema,
} from './standings-table.js';

// T-316 — caption primitive. Word-level timed text with six built-in
// visual styles (hormozi / mrbeast / tiktok / ali-abdaal / netflix /
// karaoke-wipe). Frame-deterministic word visibility, per-word
// entrance stagger, SVG-stroke text (paint-order: stroke fill),
// per-word pill / single rect backdrops, karaoke-wipe per-word
// <clipPath> fill, casing transforms. Unblocks Cluster F captions
// (T-362..T-367) plus Cluster A/B/G word-emphasis use cases.
export {
  Caption,
  type CaptionProps,
  captionClip,
  captionPropsSchema,
} from './caption.js';

// T-355a — magic-wall-panel primitive. Generic fullscreen layered
// hierarchical-data panel of N (1..56) labeled, color-shaded region
// tiles at absolute-positioned bounds (x / y / width / height per
// region) with per-region color override; optional title + subtitle;
// `valueFormat` dispatch (`'percent'` / `'count'` / `'raw'`) with
// optional `valueLabel` override; three entrance modes
// (`'stagger-rise'` / `'fade'` / `'none'`); `tabular-nums` on numeric
// cells. Unblocks T-355 (magic-wall-drilldown, Cluster E) and the
// broader Cluster A/B/C/E fullscreen-panel preset shape (msnbc-big-
// board, uefa-starball-refraction, twc-* weather radar, future
// scientific heatmaps).
export {
  MagicWallPanel,
  type MagicWallPanelProps,
  magicWallPanelClip,
  magicWallPanelPropsSchema,
} from './magic-wall-panel.js';

// T-322 — lyrics primitive. Line-level music-synced lyric panel with
// three style bundles (`'karaoke-wipe'` — left-to-right color front
// sweeping across the active line driven by per-line ms-progress;
// `'three-line-stack'` — past dimmed at top / active highlighted in
// middle / next preview at bottom; `'highlight-current'` — active
// line only). Frame-deterministic line visibility; stable line-index-
// derived clipPath + filter IDs (no crypto.randomUUID); per-line
// entrance (`'none'` / `'fade'` / `'rise'`); optional `glow?` halo
// via SVG Gaussian-blur filter on the active line. Unblocks T-367
// (karaoke-progressive-wipe, last Cluster F preset).
export {
  Lyrics,
  type LyricsProps,
  lyricsClip,
  lyricsPropsSchema,
} from './lyrics.js';

// T-332a — score-bug primitive. Single primitive serving six broadcast-
// sports score-bug presets across four sealed style bundles
// (`'football'` — horizontal team-vs-team bar with optional possession
// glow / down / direction chevrons / radial-gradient backdrop, serving
// T-333 PL / T-334 Fox NFL / T-335 NBC SNF; `'racing'` — vertical
// N-driver tower with team-color stripes, sector cells (canonical
// purple/green/yellow palette), and tire-compound glyphs, serving T-332
// F1; `'cricket'` — multi-row complex panel with team line + run rate
// + batsmen + bowler + partnership, serving T-336; `'tennis'` — two-
// player stack with surname / country code / seed / N set columns /
// game score / active-server dot, serving T-337 Wimbledon). Frame-
// deterministic; static layouts in v1 (animation carve-outs T-332b/c/d,
// T-334a, T-335a, T-336a/b, T-337a/b deferred). Stable internal IDs
// (e.g. `score-bug-football-gradient`); no `crypto.randomUUID()`.
// Casing transforms applied at render time via JS string transform.
// Theme-slot fallback (`background` → `palette.background`,
// `foreground` → `palette.foreground`, `accent` → `palette.accent`).
export {
  ScoreBug,
  type ScoreBugProps,
  scoreBugClip,
  scoreBugPropsSchema,
} from './score-bug.js';

// T-317 — subscribe-button primitive (Cluster G first entry).
// Sealed-platform creator subscribe / follow CTA button with
// `platform: 'youtube' | 'tiktok' | 'instagram' | 'generic'`
// discriminated-union dispatch + three sealed animation phases
// (`'idle'` entrance bounce 0 → 1.10 → 1.00; `'pressing'` 1.00 →
// 0.95 → 1.00 dip; `'subscribed'` static post-press). Brand canon
// dominates theme on branded platforms; theme-slot fallback only for
// `'generic'`. Unblocks T-369 (youtube-subscribe-bounce) and the
// broader Cluster G platform-button register.
export {
  SubscribeButton,
  type SubscribeButtonProps,
  subscribeButtonClip,
  subscribeButtonPropsSchema,
} from './subscribe-button.js';

// T-318 — follow-prompt primitive (Cluster G second entry; first
// 'follow-prompt' kind consumer). Sealed-platform vertical-video right-
// thumb-zone follow CTA with `platform: 'tiktok' | 'instagram' |
// 'youtube' | 'generic'` discriminated-union dispatch + three sealed
// animation phases (`'idle'` static avatar; `'pulsing'` bounded
// 1.00 → 1.05 → 1.00 sustained-pulse over 1500 ms with optional 30%-
// alpha expanding ring; `'followed'` "+" → checkmark glyph swap with
// 1.00 → 1.20 → 1.00 scale-pop on the badge over 300 ms). Brand canon
// dominates theme on branded platforms; theme-slot fallback only for
// `'generic'`. Unblocks T-370 (tiktok-follow-pulse).
export {
  FollowPrompt,
  type FollowPromptProps,
  followPromptClip,
  followPromptPropsSchema,
} from './follow-prompt.js';

// T-319 — qr-code-bounce primitive (Cluster G third entry; first
// 'qr-code-bounce' kind consumer). DVD-screensaver-bouncing QR code
// rectangle with rainbow hue cycling on a pure-black backdrop. Single
// Zod object schema (NO platform/register enum), NO font surface, NO
// phase enum. Closed-form bounce physics
// (`x_t = fold(x0 + vx*t, 2*(W-rectW))`); uniform HSL hue rotation
// (`h(f) = (f % cycleFrames) / cycleFrames * 360`). Pre-rendered QR
// matrix in v1 (live URL→matrix encoding deferred to T-319a; branded
// variant T-319b; custom palettes T-319c). Unblocks T-372
// (`coinbase-dvd-qr`, primary v1 consumer).
export {
  QRCodeBounce,
  type QRCodeBounceProps,
  computeBouncePosition,
  currentHue,
  hslToRgb,
  qrCodeBounceClip,
  qrCodeBouncePropsSchema,
} from './qr-code-bounce.js';

// T-371a — link-sticker primitive (Cluster G fourth entry; first
// 'link-sticker' kind / 'socialMedia' clipKind consumer). Rounded-pill
// Instagram-style link sticker (~200 × 44 px native) free-form-
// positioned on a Story frame with closed-form linear shimmer / high-
// light sweep across the label glyphs (3 s default cycle). Single
// Zod `object().strict()` schema with sealed `variant` enum (4 values:
// 'white-on-dark' | 'dark-on-white' | 'frosted-glass' | 'brand-color')
// and sealed `phase` enum (2 values: 'idle' | 'shimmering'). NO
// `discriminatedUnion` — variant drives only color / contrast defaults
// via a constant token table. Inter Medium (OFL, T-307) registered as
// the hard fallback font; the Instagram proprietary system font is
// `platform-byo`. v1 carve-outs: tap-depress + link-preview card
// (T-371a-followup), `backdrop-filter: blur` for `'frosted-glass'`
// (T-371a-blur — CDP determinism hazard), additional sticker kinds
// (T-371a-extend), real Instagram-domain icon SVG (T-371a-glyph).
// Unblocks T-371 (`instagram-link-sticker`, Cluster G's last unsigned
// preset). With T-371a merged, all four Cluster G blocking primitives
// (T-317 + T-318 + T-319 + T-371a) are shipped; T-371 closes Cluster
// G. 55 → 56 clips.
export {
  LinkSticker,
  type LinkStickerPhase,
  type LinkStickerProps,
  type LinkStickerVariant,
  computeShimmerX,
  linkStickerClip,
  linkStickerPropsSchema,
  resolveTokens,
} from './link-sticker.js';

// T-321 — title-sequence primitive. Multi-shot prestige-TV title
// compositor with four sealed style bundles (`'letterform-assemble'`
// — ALL-CAPS letterforms scaled-to-viewport with per-letter staggered
// entry; `'plate-and-credits'` — title plate + credits block two-card
// register; `'palette-jump-cut'` — hard-cut color panels with optional
// glyph foreground (cut-only enforced regardless of shot transition);
// `'photographic-overlay'` — typography-only pass over a sister
// photographic clip). Five shot kinds (`titlePlate` /
// `letterAnimation` / `creditsBlock` / `colorPanel` / `holdFrame`),
// three transition kinds (`'cut'` / `'fade'` / `'dissolve'`) with
// single-active + 1-shot overlap during fade / dissolve. Stable
// shot-id-derived clipPath / filter / per-letter IDs (no
// `crypto.randomUUID()`); per-shot entrance (`'none'` / `'fade'` /
// `'rise'`); optional `glow?` halo on the active shot; casing
// transforms. Unblocks Cluster D presets T-348..T-353 (stranger-
// things-benguiat / got-trajan-clockwork / squid-game-geometric /
// true-detective-double-exposure / succession-home-video / severance-
// surreal-3d).
export {
  TitleSequence,
  type TitleSequenceProps,
  titleSequenceClip,
  titleSequencePropsSchema,
} from './title-sequence.js';

// T-321a — grain primitive (Cluster D first carve-out; first 'grain'
// kind consumer). Deterministic per-pixel film-grain noise overlay
// computed from `(x, y, frame, seed)` via a closed-form integer hash
// (xxhash32-style mixer using `Math.imul` + `>>>` for bit-exact 32-bit
// arithmetic across V8). Single Zod `object().strict()` schema (NO
// `discriminatedUnion`, NO style/phase enum, NO theme slots, NO font
// surface) with all-optional props (`intensity` default 0.15,
// `cellSize` default 1, `seed` default 0, `position` defaults to full
// canvas). Always-animated: each frame's noise field shifts via
// `(x, y, frame, seed)` → producing the perceived "moving grain"
// register. Renders via a single `<canvas>` with `useEffect`-driven
// `ImageData` write (per D-T321a-5 — SVG `<feTurbulence>` rejected for
// cross-CDP determinism hazard; per-pixel `<rect>` matrix rejected for
// DOM-size cost). Mandatory for T-348 stranger-things-benguiat per
// compass canon ("Optical film grain is mandatory; clean digital looks
// wrong"); reusable across Cluster D presets (T-348, T-351, T-353)
// without coupling grain to titleSequence. v1 carve-outs: tinted grain
// (T-321a-tint), blue-noise / Perlin / simplex models (T-321a-noise-
// quality), multi-octave (T-321a-octaves), ramped intensity
// (T-321a-ramp). First of five T-321 carve-outs (T-321a grain →
// T-321b lightLeak → T-321c particles → T-321d photographic-overlay →
// T-321 ThreeSceneClip integration). 56 → 57 clips.
export {
  Grain,
  type GrainProps,
  grainClip,
  grainPropsSchema,
  hash,
  luminanceOffset,
  synthesizeNoiseBytes,
} from './grain.js';

// T-321d — photographic-overlay primitive (Cluster D last new-primitive
// carve-out from the T-321 roadmap; first 'photographic-overlay' kind
// consumer). Static film-grade tonal overlay rendered via SVG
// `<filter>` primitives (`<feColorMatrix>` / `<feComponentTransfer>`).
// Sealed `mode: 'sepia' | 'cross-process' | 'cinematic-lut' | 'fade'`
// flat enum with canonical pre-tuned color matrices/curves embedded
// as static constants; NO theme slots (per D-T321d-9 — tonal canon,
// not brand canvas). NO `discriminatedUnion` — all 4 modes share
// identical prop surface; only the underlying SVG filter primitives
// differ. Optional `intensity` ∈ [0, 1] alpha-blends the filter onto
// the underlying via `<feMerge>` chain (per D-T321d-10); optional
// `position` for partial-frame application (defaults to full-canvas).
// Static (no frame counter; no animation in v1) per D-T321d-8 —
// filter is a constant per `(mode, intensity)`. Deterministic across
// CDP per SVG 1.1 §15.3 (Filter Effects spec); pins
// `color-interpolation-filters="sRGB"` on every filter element.
// Primary consumer T-351 true-detective-double-exposure (compass
// canon "photographic clip" register); secondary T-348 stranger-
// things-benguiat. Last of T-321's new-primitive carve-outs (T-321a
// grain shipped; T-321b lightLeak superseded by T-131b.2; T-321c
// particles superseded by T-131d.1; T-321d photographic-overlay here;
// T-321 ThreeSceneClip integration + video-shot kind defer to
// consumer-preset tasks). 57 → 58 clips.
export {
  PhotographicOverlay,
  type PhotographicOverlayMode,
  type PhotographicOverlayProps,
  CINEMATIC_LUT_MATRIX,
  CROSS_PROCESS_B_TABLE,
  CROSS_PROCESS_G_TABLE,
  CROSS_PROCESS_R_TABLE,
  FADE_INTERCEPT,
  FADE_SLOPE,
  SEPIA_MATRIX,
  filterId,
  photographicOverlayClip,
  photographicOverlayPropsSchema,
} from './photographic-overlay.js';

// T-347a — weatherMap primitive (Cluster C first-of-two new primitives;
// first 'weatherMap' kind consumer). Sealed three-style sealed-bundle
// compositor: 'mark-allen-clouds' / 'doppler-radar' / 'heat-map'. Single
// primitive, discriminatedUnion on style, canonical palettes baked as
// static module constants (NOT theme-able per cluster SKILL.md "Color
// palettes are standard, not brand"). v1 ships flat 2D maps + single-
// frame static; 3D globe (BBC), multi-frame radar loop, and heat-map
// time-period cycling deferred to T-347a-3d-globe / T-347a-loop-cycle /
// T-347a-time-lapse follow-ups. Mirrors T-321 titleSequence's 4-style
// architecture (D-T347a-1 / -2). Theme slots: `background` → palette.
// background, `foreground` → palette.foreground (D-T347a-8). Frame-
// deterministic (D-T347a-9). Unblocks 3 of 6 Cluster C presets:
// bbc-mark-allen-clouds, doppler-dbz-standard, heat-map-cool-to-warm.
// 58 → 59 clips.
export {
  WeatherMap,
  type WeatherMapMapPath,
  type WeatherMapProps,
  type WeatherMapRegion,
  type WeatherMapStyle,
  type WeatherMapSymbol,
  DOPPLER_DBZ_REFLECTIVITY,
  DOPPLER_VELOCITY,
  MARK_ALLEN_TEMPERATURE_DISCS,
  MERIAM_38_CLASS_HEAT,
  resolveDopplerPalette,
  resolveHeatMapFill,
  resolveMarkAllenDisc,
  weatherMapClip,
  weatherMapPropsSchema,
} from './weather-map.js';

// T-347b — stormTracker primitive (Cluster C second-of-two new
// primitives; first 'stormTracker' kind consumer). Single-style v1
// (no `discriminatedUnion` — only consumer is nhc-cone-of-uncertainty).
// NHC 5-day cone-of-uncertainty register with mandatory beyond-cone-
// impact disclaimer (caller cannot suppress rendering — public-safety
// failure mode per cluster SKILL "non-negotiable" rule). Canonical
// NHC coastal-warning palette baked as static module constants
// (NOT theme-able). Cone polygon, base map, coastal-warning region
// paths consumer-supplied as SVG path data per the T-347a mapPaths[]
// precedent (primitive does NOT bundle storm-by-storm geometry). Track
// dots render as circles with centered intensity letters from
// NHC_INTENSITY_LETTERS (D/S/H/M per NWS mandate). Theme slots:
// background → palette.background, foreground → palette.foreground.
// Frame-deterministic. v1 carve-outs: T-347b-advisory-cycle (multi-
// advisory animated time-lapse), T-347b-live-data (LiveDataClip
// integration; Track A frontier per ADR-005), T-347b-2026-inland-
// warnings (would introduce style enum at that point).
// 59 → 60 clips.
export {
  type CoastalWarningType,
  NHC_HURRICANE_WARNING_RED,
  NHC_HURRICANE_WATCH_MAGENTA,
  NHC_INTENSITY_LETTERS,
  NHC_STORM_SURGE_PURPLE,
  NHC_TROPICAL_STORM_FIREBRICK,
  StormTracker,
  type StormTrackerCoastalWarning,
  type StormTrackerCone,
  type StormTrackerIntensity,
  type StormTrackerMapPath,
  type StormTrackerProps,
  type StormTrackerStorm,
  type StormTrackerTrackDot,
  resolveCoastalWarningColor,
  stormTrackerClip,
  stormTrackerPropsSchema,
} from './storm-tracker.js';

import { animatedMapClip } from './animated-map.js';
import { animatedValueClip } from './animated-value.js';
import { audioVisualizerReactiveClip } from './audio-visualizer-reactive.js';
import { audioVisualizerClip } from './audio-visualizer.js';
import { beatSyncedTextClip } from './beat-synced-text.js';
import { breakingBannerClip } from './breaking-banner.js';
import { captionClip } from './caption.js';
import { chartBuildClip } from './chart-build.js';
import { chartClip } from './chart/index.js';
import { clickOverlayClip } from './click-overlay.js';
import { codeBlockClip } from './code-block.js';
import { comparisonTableClip } from './comparison-table.js';
import { countdownClip } from './countdown.js';
import { counterClip } from './counter.js';
import { ctaPulseClip } from './cta-pulse.js';
import { endslateLogoClip } from './endslate-logo.js';
import { financialStatementClip } from './financial-statement.js';
import { followPromptClip } from './follow-prompt.js';
import { gifPlayerClip } from './gif-player.js';
import { grainClip } from './grain.js';
import { hookMomentClip } from './hook-moment.js';
import { hrDashboardClip } from './hr-dashboard.js';
import { imageGalleryClip } from './image-gallery.js';
import { kineticTextClip } from './kinetic-text.js';
import { kpiGridClip } from './kpi-grid.js';
import { lightLeakClip } from './light-leak.js';
import { lineChartDrawClip } from './line-chart-draw.js';
import { linkStickerClip } from './link-sticker.js';
import { logoIntroClip } from './logo-intro.js';
import { lowerThirdClip } from './lower-third.js';
import { lyricsClip } from './lyrics.js';
import { magicWallPanelClip } from './magic-wall-panel.js';
import { marketingDashboardClip } from './marketing-dashboard.js';
import { newsTickerBarClip } from './news-ticker-bar.js';
import { okrDashboardClip } from './okr-dashboard.js';
import { outcomeRowClip } from './outcome-row.js';
import { particlesClip } from './particles.js';
import { photographicOverlayClip } from './photographic-overlay.js';
import { pieChartBuildClip } from './pie-chart-build.js';
import { priceRevealClip } from './price-reveal.js';
import { productCarouselClip } from './product-carousel.js';
import { productDashboardClip } from './product-dashboard.js';
import { productRevealClip } from './product-reveal.js';
import { pullQuoteClip } from './pull-quote.js';
import { qrCodeBounceClip } from './qr-code-bounce.js';
import { salesDashboardClip } from './sales-dashboard.js';
import { scene3dClip } from './scene-3d.js';
import { scoreBugClip } from './score-bug.js';
import { standingsTableClip } from './standings-table.js';
import { stockTickerClip } from './stock-ticker.js';
import { stormTrackerClip } from './storm-tracker.js';
import { subscribeButtonClip } from './subscribe-button.js';
import { subtitleOverlayClip } from './subtitle-overlay.js';
import { testimonialCardClip } from './testimonial-card.js';
import { timelineMilestonesClip } from './timeline-milestones.js';
import { titleSequenceClip } from './title-sequence.js';
import { typewriterClip } from './typewriter-clip.js';
import { videoBackgroundClip } from './video-background.js';
import { voiceoverNarrationClip } from './voiceover-narration.js';
import { weatherMapClip } from './weather-map.js';

import type { ClipDefinition } from '@stageflip/runtimes-contract';

/**
 * Convenience tuple of every demo clip the bridge ships. `cdp-host-bundle`
 * passes this directly to `createFrameRuntimeBridge` so adding a new tranche
 * just means appending here.
 */
export const ALL_BRIDGE_CLIPS: readonly ClipDefinition<unknown>[] = [
  // T-131b.1 light tranche
  counterClip,
  kineticTextClip,
  typewriterClip,
  logoIntroClip,
  chartBuildClip,
  // T-131b.2 medium tranche
  subtitleOverlayClip,
  lightLeakClip,
  pieChartBuildClip,
  stockTickerClip,
  lineChartDrawClip,
  // T-131b.3 heavy tranche
  animatedValueClip,
  kpiGridClip,
  pullQuoteClip,
  comparisonTableClip,
  // T-131d (revised) — bridge-eligible portion of the lottie/three/shader
  // tier. shader-bg / lottie-player / animated-map deferred to follow-ups
  // (see plan row).
  scene3dClip,
  particlesClip,
  // T-131f.1 — bridge-eligible standalones not covered by b.1/b.2/b.3.
  // audio-visualizer ships only the simulated-bar path (no real audio
  // source); the reactive variant is a separate follow-up.
  codeBlockClip,
  imageGalleryClip,
  timelineMilestonesClip,
  audioVisualizerClip,
  // T-131e.1 — bake-tier clips rendered bridge-style for preview. Deterministic
  // export decodes the underlying media via the bake runtime (dispatcher
  // wiring tracked separately).
  videoBackgroundClip,
  gifPlayerClip,
  // T-131e.2 — audio tranche. voiceover-narration is text+SVG-only with an
  // optional <FrameAudio>; audio-visualizer-reactive reads live FFT data
  // via useAudioVisualizer (editor/preview determinism only; bake path
  // pre-decodes samples).
  voiceoverNarrationClip,
  audioVisualizerReactiveClip,
  // T-131f.2 — dashboard composites (Option B: flat-prop interfaces per clip;
  // no `@slidemotion/schema` domain types re-implemented). Split into
  // f.2a (hr+marketing), f.2b (product+okr), f.2c (sales).
  hrDashboardClip,
  marketingDashboardClip,
  productDashboardClip,
  okrDashboardClip,
  salesDashboardClip,
  // T-131f.3 — financial-statement composite. Largest single port in the
  // T-131 family (four sub-components inlined: KpiStrip / StatementTable /
  // CommentsRail + the clip frame itself).
  financialStatementClip,
  // T-131d.4 — animated-map (SVG fallback only; mapbox-gl path deliberately
  // not ported — see clip header). Closes reference-clip coverage at 32/32.
  animatedMapClip,
  // T-183a — StageFlip.Video profile clips: overlay tranche.
  lowerThirdClip,
  endslateLogoClip,
  testimonialCardClip,
  // T-183b — StageFlip.Video profile clips: motion tranche.
  hookMomentClip,
  productRevealClip,
  beatSyncedTextClip,
  // T-202a — StageFlip.Display profile clips: attention tranche.
  clickOverlayClip,
  countdownClip,
  ctaPulseClip,
  // T-202b — StageFlip.Display profile clips: data tranche.
  priceRevealClip,
  productCarouselClip,
  // T-406 — Chart clip family (unified ChartElement renderer over 7
  // chartKinds). Distinct from the standalone chart-build / pie-chart-
  // build / line-chart-draw clips above; Cluster E presets bind to
  // this `chart` clipKind. 42 → 43 clips.
  chartClip,
  // T-358a — outcome-row primitive (row of N color-coded chips with
  // staggered fade-in). Unblocks the T-358 cricket ball-by-ball preset
  // and other Cluster B/E scorebug-family presets. 43 → 44 clips.
  outcomeRowClip,
  // T-356a — news-ticker-bar primitive (horizontal scrolling chyron of
  // N (1..24) symbol+price+delta+▲/▼/▬ chips, continuous-loop via
  // doubled-row marquee). Unblocks T-356 (Bloomberg market chyron) and
  // Cluster A/B/E ticker presets (CNN/Fox breaking-news, ESPN
  // BottomLine, crypto dashboards). 44 → 45 clips.
  newsTickerBarClip,
  // T-324a — breaking-banner primitive. Single "BREAKING NEWS" register
  // serving CNN horizontal slide-in banners (mode: 'banner', default)
  // and Fox persistent narrow slivers (mode: 'sliver'). slideAxis swaps
  // entrance translate axis (X for CNN, Y for Fox). Sliver mode skips
  // entrance per D-T324a-6. Unblocks T-324 (cnn-breaking) and T-327
  // (fox-news-alert). 50 → 51 clips.
  breakingBannerClip,
  // T-357a — standings-table primitive (vertical ranked table of N
  // (1..16) rows × K (2..8) columns of mixed kind: rank / label /
  // numeric / delta / total; per-column color tinting; delta-arrow
  // glyphs ↑ / ↓ / ▬ from string enum or numeric sign; frame-derived
  // per-row entrance stagger). Unblocks T-357 (olympic-medal-tracker)
  // and Cluster A/B/E ranked-list presets (F1 / NBA / NCAA / golf
  // leaderboards, election results, crypto top-N dashboards). 45 → 46
  // clips.
  standingsTableClip,
  // T-316 — caption primitive (word-level timed text with six built-in
  // visual styles: hormozi / mrbeast / tiktok / ali-abdaal / netflix /
  // karaoke-wipe). Frame-deterministic word visibility, per-word
  // entrance stagger, SVG-stroke text (paint-order: stroke fill),
  // per-word pill / single rect backdrops, karaoke-wipe per-word
  // <clipPath> fill, casing transforms. Unblocks Cluster F captions
  // (T-362..T-367) and Cluster A/B/G word-emphasis use cases. 46 → 47
  // clips.
  captionClip,
  // T-355a — magic-wall-panel primitive (fullscreen layered hierarchical-
  // data panel of N (1..56) labeled, color-shaded region tiles at
  // absolute-positioned bounds with per-region color override; optional
  // title + subtitle; `valueFormat` dispatch (`'percent'` / `'count'` /
  // `'raw'`) with optional `valueLabel` override; three entrance modes
  // (`'stagger-rise'` / `'fade'` / `'none'`); `tabular-nums` on numeric
  // cells). Unblocks T-355 (magic-wall-drilldown, Cluster E) and the
  // broader Cluster A/B/C/E fullscreen-panel preset shape (msnbc-big-
  // board, uefa-starball-refraction, twc-* weather radar, future
  // scientific heatmaps). 47 → 48 clips.
  magicWallPanelClip,
  // T-322 — lyrics primitive (line-level music-synced lyric panel with
  // three style bundles: `'karaoke-wipe'` left-to-right color front
  // sweep across the active line driven by per-line ms-progress;
  // `'three-line-stack'` past dimmed / active highlighted / next
  // preview vertical register; `'highlight-current'` active-only
  // mono-line). Stable line-index-derived clipPath + filter IDs (no
  // `crypto.randomUUID()`); per-line entrance (`'none'` / `'fade'` /
  // `'rise'`); optional `glow?` halo on the active line. Unblocks
  // T-367 (karaoke-progressive-wipe, last Cluster F preset). 48 → 49
  // clips.
  lyricsClip,
  // T-332a — score-bug primitive. Single primitive serving six
  // broadcast-sports presets across four sealed style bundles
  // (`'football'` T-333 PL / T-334 Fox NFL / T-335 NBC SNF; `'racing'`
  // T-332 F1; `'cricket'` T-336; `'tennis'` T-337 Wimbledon).
  // Discriminated-union schema on `style`; per-style render functions
  // dispatched from a single `switch (style)` block. Static layouts in
  // v1 (animation carve-outs T-332b/c/d, T-334a, T-335a, T-336a/b,
  // T-337a/b deferred). 51 → 52 clips.
  scoreBugClip,
  // T-321 — title-sequence primitive (multi-shot prestige-TV title
  // compositor with four sealed style bundles: `'letterform-assemble'`
  // — ALL-CAPS letterforms scaled-to-viewport with per-letter staggered
  // entry; `'plate-and-credits'` — title plate + credits block two-card
  // register; `'palette-jump-cut'` — hard-cut color panels with optional
  // glyph foreground (cut-only enforced regardless of shot transition);
  // `'photographic-overlay'` — typography-only pass over a sister
  // photographic clip). Five shot kinds (`titlePlate` /
  // `letterAnimation` / `creditsBlock` / `colorPanel` / `holdFrame`);
  // three transition kinds (`'cut'` / `'fade'` / `'dissolve'`) with
  // single-active + 1-shot overlap during fade / dissolve. Stable
  // shot-id-derived clipPath / filter / per-letter IDs. Unblocks
  // Cluster D presets T-348..T-353. 49 → 50 clips.
  titleSequenceClip,
  // T-317 — subscribe-button primitive (Cluster G first entry; first
  // `'subscribe-button'` kind consumer). Sealed-platform creator
  // subscribe / follow CTA button with `platform: 'youtube' |
  // 'tiktok' | 'instagram' | 'generic'` discriminated-union dispatch
  // + three sealed animation phases (`'idle'` 0 → 1.10 → 1.00
  // entrance bounce; `'pressing'` 1.00 → 0.95 → 1.00 dip;
  // `'subscribed'` static post-press). Brand canon dominates theme
  // on branded platforms; theme-slot fallback only for `'generic'`.
  // Unblocks T-369 (youtube-subscribe-bounce, first Cluster G preset).
  // 52 → 53 clips.
  subscribeButtonClip,
  // T-318 — follow-prompt primitive (Cluster G second entry; first
  // 'follow-prompt' kind consumer). Sealed-platform vertical-video
  // right-thumb-zone follow CTA with `platform: 'tiktok' | 'instagram'
  // | 'youtube' | 'generic'` discriminated-union dispatch + three
  // sealed animation phases (`'idle'` static avatar circle + corner
  // "+" badge; `'pulsing'` bounded 1.00 → 1.05 → 1.00 scale-pulse over
  // 1500 ms with optional 30%-alpha expanding ring, `pulseRepeat`
  // 1..10; `'followed'` "+" → checkmark glyph swap with 1.00 → 1.20 →
  // 1.00 scale-pop on the badge over 300 ms; avatar surface stays at
  // scale 1.00). Brand canon dominates theme on branded platforms
  // (TikTok pink #FE2C55 / Instagram magenta #DD2A7B / YouTube red
  // #FF0000); theme-slot fallback only for `'generic'`. Unblocks T-370
  // (tiktok-follow-pulse, primary v1 consumer). 53 → 54 clips.
  followPromptClip,
  // T-319 — qr-code-bounce primitive (Cluster G third entry; first
  // 'qr-code-bounce' kind consumer). DVD-screensaver-bouncing QR code
  // rectangle with rainbow hue cycling on a pure-black backdrop.
  // Single Zod object schema (NO platform/register enum), NO font
  // surface, NO phase enum. Closed-form bounce physics
  // (`x_t = fold(x0 + vx*t, 2*(W-rectW))`); uniform HSL hue rotation
  // (`h(f) = (f % cycleFrames) / cycleFrames * 360`). Pre-rendered QR
  // matrix in v1 (live URL→matrix encoding T-319a; branded variant
  // T-319b; custom palettes T-319c). Always-moving / always-cycling
  // register; lightModuleColor NOT theme-bound to preserve dark-on-
  // light scannability. Unblocks T-372 (coinbase-dvd-qr, primary v1
  // consumer). 54 → 55 clips.
  qrCodeBounceClip,
  // T-371a — link-sticker primitive (Cluster G fourth entry; first
  // 'link-sticker' kind / 'socialMedia' clipKind consumer). Rounded-
  // pill Instagram-style link sticker (~200 × 44 px native) free-form-
  // positioned on a Story frame with closed-form linear shimmer /
  // highlight sweep across the label glyphs. Single Zod
  // `object().strict()` schema with sealed `variant` enum
  // (`'white-on-dark' | 'dark-on-white' | 'frosted-glass' |
  // 'brand-color'`) and sealed `phase` enum (`'idle' | 'shimmering'`).
  // NO `discriminatedUnion` — variant drives only color / contrast
  // defaults via a constant token table. Closed-form shimmer math
  // (`shimmerX(f) = round(((f % cycleFrames) / cycleFrames) *
  // (pillWidth + bandWidth) - bandWidth)`). Inter Medium (OFL, T-307)
  // registered as fallback font; Instagram proprietary system font is
  // `platform-byo`. v1 carve-outs: tap-depress + link-preview card
  // (T-371a-followup), `backdrop-filter: blur` for `'frosted-glass'`
  // (T-371a-blur), additional sticker kinds (T-371a-extend), branded
  // icon SVG (T-371a-glyph). Unblocks T-371 (instagram-link-sticker —
  // Cluster G's last unsigned preset). 55 → 56 clips. Cluster G's
  // fourth + final blocking primitive (T-317 + T-318 + T-319 + T-371a
  // close cluster G; T-371 ships next as the consumer preset).
  linkStickerClip,
  // T-321a — grain primitive (Cluster D first carve-out; first 'grain'
  // kind consumer). Deterministic per-pixel film-grain noise overlay
  // computed from `(x, y, frame, seed)` via a closed-form integer hash
  // (xxhash32-style mixer using `Math.imul` + `>>>` for bit-exact 32-
  // bit arithmetic across V8). Single Zod `object().strict()` schema
  // (NO `discriminatedUnion`, NO style/phase enum, NO theme slots, NO
  // font surface) with all-optional props (`intensity` default 0.15,
  // `cellSize` default 1, `seed` default 0, `position` defaults to
  // full canvas). Always-animated: each frame's noise field shifts via
  // `(x, y, frame, seed)`. Renders via a single `<canvas>` with
  // `useEffect`-driven `ImageData` write (per D-T321a-5 — SVG
  // `<feTurbulence>` rejected for cross-CDP determinism hazard; per-
  // pixel `<rect>` matrix rejected for DOM-size cost). Mandatory for
  // T-348 stranger-things-benguiat per compass canon. Reusable across
  // Cluster D presets (T-348, T-351, T-353) without coupling grain to
  // titleSequence. v1 carve-outs: tinted grain (T-321a-tint), blue-
  // noise / Perlin / simplex models (T-321a-noise-quality), multi-
  // octave (T-321a-octaves), ramped intensity (T-321a-ramp). First of
  // five T-321 carve-outs. 56 → 57 clips.
  grainClip,
  // T-321d — photographic-overlay primitive (Cluster D last new-
  // primitive carve-out from the T-321 roadmap; first 'photographic-
  // overlay' kind consumer). Static film-grade tonal overlay rendered
  // via SVG `<filter>` primitives (`<feColorMatrix>` /
  // `<feComponentTransfer>`). Sealed `mode: 'sepia' | 'cross-process'
  // | 'cinematic-lut' | 'fade'` flat enum with canonical pre-tuned
  // color matrices/curves embedded as static constants; NO theme
  // slots (per D-T321d-9 — tonal canon, not brand canvas). NO
  // `discriminatedUnion` — all 4 modes share identical prop surface;
  // only the underlying SVG filter primitives differ. Optional
  // `intensity` ∈ [0, 1] alpha-blends the filter onto the underlying
  // via `<feMerge>` chain (per D-T321d-10); optional `position` for
  // partial-frame application (defaults to full-canvas). Static (no
  // frame counter; no animation in v1) per D-T321d-8 — filter is a
  // constant per `(mode, intensity)`. Deterministic across CDP per
  // SVG 1.1 §15.3 (Filter Effects spec); pins
  // `color-interpolation-filters="sRGB"` on every filter element.
  // Primary consumer T-351 true-detective-double-exposure (compass
  // canon "photographic clip" register); secondary T-348 stranger-
  // things-benguiat. Last new-primitive carve-out from T-321 roadmap
  // (T-321a grain shipped; T-321b lightLeak superseded by T-131b.2;
  // T-321c particles superseded by T-131d.1; ThreeSceneClip
  // integration + video-shot kind defer to consumer-preset tasks).
  // 57 → 58 clips.
  photographicOverlayClip,
  // T-347a — weatherMap primitive (Cluster C first-of-two new primitives;
  // first 'weatherMap' kind consumer). Sealed three-style sealed-bundle
  // compositor: 'mark-allen-clouds' / 'doppler-radar' / 'heat-map'.
  // Single primitive, discriminatedUnion on style, canonical palettes
  // baked as static module-level constants (NOT theme-able per cluster
  // SKILL "Color palettes are standard, not brand"). Mirrors T-321
  // titleSequence's 4-style sealed-bundle architecture. v1 ships flat
  // 2D maps + single-frame static (`loopFrameIndex` pinned by caller);
  // 3D globe (BBC) deferred to T-347a-3d-globe (Track A frontier per
  // ADR-005), multi-frame radar loop deferred to T-347a-loop-cycle,
  // heat-map time-period cycling deferred to T-347a-time-lapse. Per-
  // style content shape via `discriminatedUnion('style', [...])`:
  //   - 'mark-allen-clouds' carries optional `symbols[]` (cloud / sun /
  //     raindrop / snow icon-set instances per Mark Allen 1975 BBC
  //     canon); region labels rendered in colored discs from
  //     MARK_ALLEN_TEMPERATURE_DISCS palette.
  //   - 'doppler-radar' carries `productMode: 'reflectivity' |
  //     'velocity'` + `loopFrameIndex: 0..31` + optional
  //     `sweepBeamPhase: 0..1`. NEXRAD universal palette
  //     (DOPPLER_DBZ_REFLECTIVITY) preserves mesocyclone signature in
  //     velocity mode (DOPPLER_VELOCITY: bright green inbound + bright
  //     red outbound).
  //   - 'heat-map' carries `units: 'F' | 'C'` + optional
  //     `oscillation` (Meriam light-dark across classes for color-blind
  //     differentiation). MERIAM_38_CLASS_HEAT 38-step gradient from
  //     deep purple sub-zero F to dark maroon extreme heat.
  // Common across styles: regions[] (positioned text overlays),
  // mapPaths[] (consumer-supplied SVG path data — primitive does NOT
  // bundle map geometry per D-T347a-7), legend, font, theme-slot
  // fallback. Frame-deterministic (no Date / Math.random / crypto /
  // setTimeout / fetch / requestAnimationFrame). Unblocks 3 of 6
  // Cluster C presets (bbc-mark-allen-clouds, doppler-dbz-standard,
  // heat-map-cool-to-warm). 58 → 59 clips. T-347b stormTracker is the
  // sibling Cluster C primitive shipping next.
  weatherMapClip,
  // T-347b — stormTracker primitive (Cluster C second-of-two new
  // primitives; first 'stormTracker' kind consumer). Single-style v1
  // (no `discriminatedUnion` — only consumer is nhc-cone-of-uncertainty).
  // NHC 5-day cone-of-uncertainty register: mandatory beyond-cone-
  // impact disclaimer (caller cannot suppress rendering per D-T347b-2 —
  // public-safety failure mode per cluster SKILL "non-negotiable"
  // rule); canonical NHC coastal-warning palette baked as static
  // module constants (NHC_HURRICANE_WARNING_RED #DC143C,
  // NHC_HURRICANE_WATCH_MAGENTA #FF00FF, NHC_TROPICAL_STORM_FIREBRICK
  // #B22222, NHC_STORM_SURGE_PURPLE #B524F7); NWS-mandated intensity-
  // letter shorthand NHC_INTENSITY_LETTERS = ['D', 'S', 'H', 'M'].
  // Cone polygon (consumer-supplied SVG path), base map (mapPaths[]),
  // coastal-warning regions (sealed warningType enum) all rendered
  // inside an SVG with z-stack: base map → coastal warnings → cone
  // polygon → track dots. Storm name renders as ALL-CAPS top banner
  // (28-32pt bold per stub line 35); optional advisory timestamp
  // small label below. Theme slots: background → palette.background,
  // foreground → palette.foreground. Palettes themselves NOT theme-
  // bound. Frame-deterministic. v1 ships single-frame static; multi-
  // advisory animated time-lapse deferred to T-347b-advisory-cycle;
  // LiveDataClip integration deferred to T-347b-live-data (Track A
  // frontier per ADR-005); 2026 NHC inland-warnings update deferred
  // to T-347b-2026-inland-warnings (would introduce style enum at
  // that point). Unblocks 1 of 6 Cluster C presets:
  // nhc-cone-of-uncertainty (only stormTracker consumer in v1).
  // 59 → 60 clips.
  stormTrackerClip,
];
