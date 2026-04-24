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

import { animatedMapClip } from './animated-map.js';
import { animatedValueClip } from './animated-value.js';
import { audioVisualizerReactiveClip } from './audio-visualizer-reactive.js';
import { audioVisualizerClip } from './audio-visualizer.js';
import { beatSyncedTextClip } from './beat-synced-text.js';
import { chartBuildClip } from './chart-build.js';
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
import { marketingDashboardClip } from './marketing-dashboard.js';
import { okrDashboardClip } from './okr-dashboard.js';
import { particlesClip } from './particles.js';
import { pieChartBuildClip } from './pie-chart-build.js';
import { priceRevealClip } from './price-reveal.js';
import { productCarouselClip } from './product-carousel.js';
import { productDashboardClip } from './product-dashboard.js';
import { productRevealClip } from './product-reveal.js';
import { pullQuoteClip } from './pull-quote.js';
import { salesDashboardClip } from './sales-dashboard.js';
import { scene3dClip } from './scene-3d.js';
import { stockTickerClip } from './stock-ticker.js';
import { subtitleOverlayClip } from './subtitle-overlay.js';
import { testimonialCardClip } from './testimonial-card.js';
import { timelineMilestonesClip } from './timeline-milestones.js';
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
];
