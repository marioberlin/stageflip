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

import { chartBuildClip } from './chart-build.js';
import { counterClip } from './counter.js';
import { kineticTextClip } from './kinetic-text.js';
import { lightLeakClip } from './light-leak.js';
import { lineChartDrawClip } from './line-chart-draw.js';
import { logoIntroClip } from './logo-intro.js';
import { pieChartBuildClip } from './pie-chart-build.js';
import { stockTickerClip } from './stock-ticker.js';
import { subtitleOverlayClip } from './subtitle-overlay.js';
import { typewriterClip } from './typewriter-clip.js';

import type { ClipDefinition } from '@stageflip/runtimes-contract';

/**
 * Convenience tuple of every demo clip the bridge ships. `cdp-host-bundle`
 * passes this directly to `createFrameRuntimeBridge` so adding a new tranche
 * just means appending here.
 */
export const ALL_BRIDGE_CLIPS: readonly ClipDefinition<unknown>[] = [
  counterClip,
  kineticTextClip,
  typewriterClip,
  logoIntroClip,
  chartBuildClip,
  subtitleOverlayClip,
  lightLeakClip,
  pieChartBuildClip,
  stockTickerClip,
  lineChartDrawClip,
];
