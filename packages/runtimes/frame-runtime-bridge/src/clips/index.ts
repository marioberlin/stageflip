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
import { gifPlayerClip } from './gif-player.js';
import { hookMomentClip } from './hook-moment.js';
import { hrDashboardClip } from './hr-dashboard.js';
import { imageGalleryClip } from './image-gallery.js';
import { kineticTextClip } from './kinetic-text.js';
import { kpiGridClip } from './kpi-grid.js';
import { lightLeakClip } from './light-leak.js';
import { lineChartDrawClip } from './line-chart-draw.js';
import { logoIntroClip } from './logo-intro.js';
import { lowerThirdClip } from './lower-third.js';
import { lyricsClip } from './lyrics.js';
import { magicWallPanelClip } from './magic-wall-panel.js';
import { marketingDashboardClip } from './marketing-dashboard.js';
import { newsTickerBarClip } from './news-ticker-bar.js';
import { okrDashboardClip } from './okr-dashboard.js';
import { outcomeRowClip } from './outcome-row.js';
import { particlesClip } from './particles.js';
import { pieChartBuildClip } from './pie-chart-build.js';
import { priceRevealClip } from './price-reveal.js';
import { productCarouselClip } from './product-carousel.js';
import { productDashboardClip } from './product-dashboard.js';
import { productRevealClip } from './product-reveal.js';
import { pullQuoteClip } from './pull-quote.js';
import { salesDashboardClip } from './sales-dashboard.js';
import { scene3dClip } from './scene-3d.js';
import { scoreBugClip } from './score-bug.js';
import { standingsTableClip } from './standings-table.js';
import { stockTickerClip } from './stock-ticker.js';
import { subscribeButtonClip } from './subscribe-button.js';
import { subtitleOverlayClip } from './subtitle-overlay.js';
import { testimonialCardClip } from './testimonial-card.js';
import { timelineMilestonesClip } from './timeline-milestones.js';
import { titleSequenceClip } from './title-sequence.js';
import { typewriterClip } from './typewriter-clip.js';
import { videoBackgroundClip } from './video-background.js';
import { voiceoverNarrationClip } from './voiceover-narration.js';

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
];
