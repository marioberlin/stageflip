// packages/frame-runtime/src/frame-context.ts
// The React context that carries the current frame number and composition
// config through every component tree rendered by the frame-runtime. See
// skills/stageflip/concepts/determinism/SKILL.md — every clip/runtime reads
// the current frame from here, never from wall-clock APIs.
//
// Public API:
//   FrameContext  — React.Context (non-null default ensures tests throw if
//                   a component forgets to wrap in a Provider)
//   FrameProvider — convenience provider component
//   useCurrentFrame() — returns the current frame integer
//   useVideoConfig()  — returns { width, height, fps, durationInFrames }

import { type ReactNode, createContext, createElement, useContext } from 'react';

/** Composition-level configuration. Pure data; no callbacks. */
export interface VideoConfig {
  /** Composition width in CSS pixels. */
  width: number;
  /** Composition height in CSS pixels. */
  height: number;
  /** Frames per second. Integer. */
  fps: number;
  /** Total length of the composition in frames. */
  durationInFrames: number;
}

/** The frame-context value. Carried through every React tree the runtime renders. */
export interface FrameContextValue {
  /** Current frame number. Non-negative integer. */
  frame: number;
  config: VideoConfig;
}

const FRAME_CONTEXT_ERROR =
  'frame-runtime: FrameProvider missing. Every component rendered by the frame-runtime must be inside <FrameProvider> (or the dev harness).';

/**
 * The FrameContext React context. A deliberate `null` default means any
 * hook call outside a Provider throws — surfacing the misuse immediately
 * rather than silently rendering garbage.
 */
export const FrameContext = createContext<FrameContextValue | null>(null);
FrameContext.displayName = 'FrameContext';

/**
 * Wrap a React subtree so `useCurrentFrame()` + `useVideoConfig()` work inside
 * it. Not memoized internally — callers control when the value changes.
 */
export interface FrameProviderProps {
  frame: number;
  config: VideoConfig;
  children: ReactNode;
}

export function FrameProvider({ frame, config, children }: FrameProviderProps): ReactNode {
  const value: FrameContextValue = { frame, config };
  return createElement(FrameContext.Provider, { value }, children);
}

/** Read the current frame. Throws if called outside a FrameProvider. */
export function useCurrentFrame(): number {
  const ctx = useContext(FrameContext);
  if (ctx === null) throw new Error(FRAME_CONTEXT_ERROR);
  return ctx.frame;
}

/** Read the composition config. Throws if called outside a FrameProvider. */
export function useVideoConfig(): VideoConfig {
  const ctx = useContext(FrameContext);
  if (ctx === null) throw new Error(FRAME_CONTEXT_ERROR);
  return ctx.config;
}

/**
 * Low-level accessor used by non-React code paths (the CDP export pipeline
 * reads a frame value snapshot). Prefer the hooks in component code.
 */
export function readFrameContextValue(ctx: FrameContextValue): FrameContextValue {
  return ctx;
}
