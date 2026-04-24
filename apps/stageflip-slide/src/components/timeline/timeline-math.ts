// apps/stageflip-slide/src/components/timeline/timeline-math.ts
// Re-export of the shared timeline math now owned by @stageflip/editor-shell
// (T-181). Local path kept so slide-app callers don't churn on the import.
// New code should import directly from `@stageflip/editor-shell`.

export {
  type TimelineScale,
  formatFrameLabel,
  frameToPx,
  pxToFrame,
  rulerTickFrames,
  snapFrame,
} from '@stageflip/editor-shell';
