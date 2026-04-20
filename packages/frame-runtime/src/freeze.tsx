// packages/frame-runtime/src/freeze.tsx
// <Freeze> — substitutes a fixed frame into useCurrentFrame() for the
// wrapped subtree. Children are always mounted; this is a remap-only
// component (no mount gate, no DOM wrapper). Disable the freeze with
// `active={false}` to pass the parent frame through unchanged.
//
// Design mirrors https://remotion.dev/docs/freeze (per CLAUDE.md §7).

import { type ReactElement, type ReactNode, createElement } from 'react';

import { FrameProvider, useCurrentFrame, useVideoConfig } from './frame-context.js';

export interface FreezeProps {
  children?: ReactNode;
  /** The frame value to serve to descendants. Integer. Required. */
  frame: number;
  /** When true (default) freeze is applied. When false the component is a pass-through. */
  active?: boolean;
}

/**
 * Freeze-frame remap. Inside this component `useCurrentFrame()` returns
 * `props.frame` (when `active`, default `true`). `VideoConfig` passes
 * through unchanged. No DOM wrapper is emitted.
 *
 * @throws If `frame` is non-integer or the component is rendered outside a
 *   `FrameProvider`.
 */
export function Freeze({ children, frame, active = true }: FreezeProps): ReactElement {
  if (!Number.isInteger(frame)) {
    throw new Error(`Freeze: frame must be an integer (got ${frame})`);
  }

  const parentFrame = useCurrentFrame();
  const config = useVideoConfig();

  const effective = active ? frame : parentFrame;
  return createElement(FrameProvider, { frame: effective, config, children }) as ReactElement;
}
