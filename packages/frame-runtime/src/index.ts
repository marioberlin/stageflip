// packages/frame-runtime/src/index.ts
// @stageflip/frame-runtime — our own frame-driven rendering layer.
// Invariant I-6: zero imports from remotion or @remotion/*. Implementation
// is clean-sheet from public API specs. See CLAUDE.md §3, §7.
// Determinism invariant (I-2) is enforced by check-determinism on this
// package's source tree.

export {
  FrameContext,
  FrameProvider,
  useCurrentFrame,
  useVideoConfig,
  readFrameContextValue,
  type FrameContextValue,
  type FrameProviderProps,
  type VideoConfig,
} from './frame-context.js';

export {
  EASINGS,
  NAMED_EASINGS,
  cubicBezier,
  linear,
  ease,
  easeIn,
  easeOut,
  easeInOut,
  quadIn,
  quadOut,
  quadInOut,
  cubicIn,
  cubicOut,
  cubicInOut,
  quartIn,
  quartOut,
  quartInOut,
  quintIn,
  quintOut,
  quintInOut,
  expoIn,
  expoOut,
  expoInOut,
  circIn,
  circOut,
  circInOut,
  backIn,
  backOut,
  type EasingFn,
  type NamedEasing,
} from './easings.js';

export { interpolate, type ExtrapolationMode, type InterpolateOptions } from './interpolate.js';

export {
  interpolateColors,
  type ColorSpace,
  type InterpolateColorsOptions,
} from './interpolate-colors.js';

export { spring, type SpringConfig } from './spring.js';
