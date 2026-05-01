// packages/runtimes/frame-runtime-bridge/src/index.ts
// @stageflip/runtimes-frame-runtime-bridge — wraps @stageflip/frame-runtime
// as a ClipRuntime (T-061) so frame-runtime-based clips (React components
// using useCurrentFrame / useVideoConfig / Sequence / etc.) are addressable
// uniformly through the T-060 runtime contract alongside CSS, GSAP, Lottie,
// shader, three, and blender runtimes.
//
// Two entry points:
//
//   defineFrameClip({ kind, component, fontRequirements? })
//     Adapts a React component that expects FrameProvider context into a
//     ClipDefinition. The clip's render:
//       1. Gates on the clip window ([clipFrom, clipFrom + duration)) —
//          returns null outside, which the renderer-core dispatcher
//          interprets as "not mounted".
//       2. Mounts a FrameProvider with frame = ctx.frame - ctx.clipFrom
//          (clip-local time starting at 0) and config mirroring the
//          composition's width/height/fps with durationInFrames =
//          clipDurationInFrames (so useVideoConfig().durationInFrames
//          reports the clip's own length, not the composition's).
//       3. Renders the component with ctx.props.
//
//   createFrameRuntimeBridge(clips?)
//     Produces the ClipRuntime for the bridge. id = 'frame-runtime',
//     tier = 'live'. Pass the clips you want this bridge to expose at
//     construction time; duplicate kinds throw. Register with
//     registerRuntime() when the app boots.

import { type ComponentType, type ReactElement, createElement } from 'react';
import type { z } from 'zod';

import { FrameProvider, type VideoConfig } from '@stageflip/frame-runtime';
import type {
  ClipDefinition,
  ClipRenderContext,
  ClipRuntime,
  FontRequirement,
  ThemeSlot,
} from '@stageflip/runtimes-contract';

export interface DefineFrameClipInput<P> {
  /** Globally unique clip kind identifier. */
  kind: string;
  /** React component rendered every frame inside the bridge's FrameProvider. */
  component: ComponentType<P>;
  /** Optional: declare the fonts this clip needs (consumed by T-072 FontManager). */
  fontRequirements?(props: P): FontRequirement[];
  /**
   * Optional Zod schema describing the clip's props (T-125b). When declared,
   * the editor's `<ZodForm>` auto-inspects the clip's props.
   */
  propsSchema?: z.ZodType<P>;
  /**
   * Optional theme-slot map (T-131a). Keys are clip prop names; values
   * declare which theme slot fills the prop when `undefined`. Resolved
   * per-render via `resolveClipDefaultsForTheme` from
   * `@stageflip/runtimes-contract`.
   */
  themeSlots?: Readonly<Record<string, ThemeSlot>>;
}

/**
 * Adapt a frame-runtime React component into a ClipDefinition.
 *
 * The P generic is erased at the return site so the resulting definition
 * can be dropped into a `ClipRuntime.clips: ReadonlyMap<string,
 * ClipDefinition<unknown>>` without variance gymnastics.
 */
export function defineFrameClip<P>(input: DefineFrameClipInput<P>): ClipDefinition<unknown> {
  // Widen the component's prop generic at the createElement boundary so the
  // returned ClipDefinition can sit in a ClipDefinition<unknown>-typed map
  // without triggering covariance errors on GetDerivedStateFromProps.
  const Component = input.component as ComponentType<unknown>;
  const def: ClipDefinition<P> = {
    kind: input.kind,
    render(ctx: ClipRenderContext<P>): ReactElement | null {
      const localFrame = ctx.frame - ctx.clipFrom;
      if (localFrame < 0 || localFrame >= ctx.clipDurationInFrames) {
        return null;
      }
      const config: VideoConfig = {
        width: ctx.width,
        height: ctx.height,
        fps: ctx.fps,
        durationInFrames: ctx.clipDurationInFrames,
      };
      const children = createElement(Component, ctx.props as Record<string, unknown>);
      return createElement(FrameProvider, { frame: localFrame, config, children });
    },
  };
  if (input.fontRequirements !== undefined) {
    def.fontRequirements = input.fontRequirements;
  }
  if (input.propsSchema !== undefined) {
    (def as { propsSchema?: z.ZodType<P> }).propsSchema = input.propsSchema;
  }
  if (input.themeSlots !== undefined) {
    (def as { themeSlots?: Readonly<Record<string, ThemeSlot>> }).themeSlots = input.themeSlots;
  }
  return def as unknown as ClipDefinition<unknown>;
}

/**
 * Build the frame-runtime bridge ClipRuntime with the given set of clips.
 * Pass the clips (via `defineFrameClip`) you want this bridge to expose.
 *
 * @throws If two clips share the same kind.
 */
export function createFrameRuntimeBridge(
  clips: Iterable<ClipDefinition<unknown>> = [],
): ClipRuntime {
  const clipMap = new Map<string, ClipDefinition<unknown>>();
  for (const clip of clips) {
    if (clipMap.has(clip.kind)) {
      throw new Error(
        `createFrameRuntimeBridge: duplicate clip kind '${clip.kind}' — each kind must be unique within the bridge`,
      );
    }
    clipMap.set(clip.kind, clip);
  }
  return {
    id: 'frame-runtime',
    tier: 'live',
    clips: clipMap,
  };
}

// Re-export demo clips. T-131b/d/e/f tranches (32 reference-clip ports)
// plus the T-406 unified `chart` family (1 ClipDefinition dispatching to
// 7 per-kind renderers). `ALL_BRIDGE_CLIPS` exposes all 43.
// shader-bg / lottie-player / animated-map mapbox-gl path are deferred —
// see plan-row T-131d. audio-visualizer's real-audio path is a follow-up.
export {
  ALL_BRIDGE_CLIPS,
  AnimatedProgressBar,
  type AnimatedProgressBarProps,
  AnimatedProgressRing,
  type AnimatedProgressRingProps,
  AnimatedValue,
  type AnimatedValueProps,
  animatedValueClip,
  animatedValuePropsSchema,
  AudioVisualizer,
  type AudioVisualizerProps,
  audioVisualizerClip,
  audioVisualizerPropsSchema,
  ChartBuild,
  type ChartBuildProps,
  chartBuildClip,
  chartBuildPropsSchema,
  ChartClip,
  type ChartProps,
  chartClip,
  chartPropsSchema,
  CodeBlock,
  type CodeBlockProps,
  type CodeLanguage,
  codeBlockClip,
  codeBlockPropsSchema,
  ComparisonTable,
  type ComparisonTableProps,
  comparisonTableClip,
  comparisonTablePropsSchema,
  Counter,
  type CounterProps,
  counterClip,
  counterPropsSchema,
  generateBars,
  ImageGallery,
  type ImageGalleryProps,
  imageGalleryClip,
  imageGalleryPropsSchema,
  KineticText,
  type KineticTextProps,
  kineticTextClip,
  kineticTextPropsSchema,
  KpiGrid,
  type KpiGridProps,
  kpiGridClip,
  kpiGridPropsSchema,
  LightLeak,
  type LightLeakProps,
  lightLeakClip,
  lightLeakPropsSchema,
  LineChartDraw,
  type LineChartDrawProps,
  lineChartDrawClip,
  lineChartDrawPropsSchema,
  LogoIntro,
  type LogoIntroProps,
  logoIntroClip,
  logoIntroPropsSchema,
  type ParticleStyle,
  Particles,
  type ParticlesProps,
  particlesClip,
  particlesPropsSchema,
  PieChartBuild,
  type PieChartBuildProps,
  pieChartBuildClip,
  pieChartBuildPropsSchema,
  PullQuote,
  type PullQuoteProps,
  pullQuoteClip,
  pullQuotePropsSchema,
  Scene3D,
  type Scene3DProps,
  scene3dClip,
  scene3dPropsSchema,
  StockTicker,
  type StockTickerProps,
  stockTickerClip,
  stockTickerPropsSchema,
  SubtitleOverlay,
  type SubtitleOverlayProps,
  subtitleOverlayClip,
  subtitleOverlayPropsSchema,
  TimelineMilestones,
  type TimelineMilestonesProps,
  timelineMilestonesClip,
  timelineMilestonesPropsSchema,
  tokenizeLine,
  TypewriterClip,
  type TypewriterClipProps,
  typewriterClip,
  typewriterClipPropsSchema,
  type VisualizerStyle,
} from './clips/index.js';
