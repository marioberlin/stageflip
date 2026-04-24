// packages/editor-shell/src/aspect-ratio/components.tsx
// Headless components for the multi-aspect preview bouncer (T-182).
// <AspectRatioPreview> renders a single box at a given aspect; host
// content goes inside as children. <AspectRatioGrid> runs the row-
// layout math and renders one preview per aspect.

'use client';

import type { CSSProperties, ReactNode } from 'react';

import {
  type AspectPreviewPlacement,
  type AspectRatio,
  type AspectRowLayoutOptions,
  type BoxSize,
  layoutAspectPreviews,
} from './math';

/* -------------------------------------------------------------------------- */
/* <AspectRatioPreview>                                                       */
/* -------------------------------------------------------------------------- */

export interface AspectRatioPreviewProps {
  readonly aspect: AspectRatio;
  readonly widthPx: number;
  readonly heightPx: number;
  readonly children?: ReactNode;
  readonly className?: string;
  readonly style?: CSSProperties;
}

/**
 * A fixed-size preview frame at a given aspect ratio. The outer element
 * has `overflow: hidden` so host content that overflows the frame gets
 * clipped (letterboxing / crop modes are a host concern — the preview
 * frame itself is content-agnostic).
 */
export function AspectRatioPreview(props: AspectRatioPreviewProps): ReactNode {
  const { aspect, widthPx, heightPx, children, className, style } = props;
  const label = aspect.label ?? `${aspect.w}:${aspect.h}`;
  return (
    <div
      className={className}
      data-testid={`sf-aspect-preview-${label}`}
      data-aspect-w={aspect.w}
      data-aspect-h={aspect.h}
      data-aspect-label={label}
      style={{
        position: 'relative',
        width: widthPx,
        height: heightPx,
        overflow: 'hidden',
        ['--sf-aspect-w' as string]: `${aspect.w}`,
        ['--sf-aspect-h' as string]: `${aspect.h}`,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* <AspectRatioGrid>                                                          */
/* -------------------------------------------------------------------------- */

export interface AspectRatioGridProps {
  readonly aspects: readonly AspectRatio[];
  readonly container: BoxSize;
  readonly layoutOptions?: AspectRowLayoutOptions;
  /**
   * Render prop for each preview. Receives the placement; return the
   * inner content. The grid wraps the return value in an
   * `<AspectRatioPreview>` with the computed dimensions.
   */
  readonly renderPreview?: (placement: AspectPreviewPlacement) => ReactNode;
  readonly className?: string;
  readonly style?: CSSProperties;
}

/**
 * Lays out N aspect-ratio previews in a single row using
 * `layoutAspectPreviews`. Host supplies `renderPreview` for per-cell
 * content; falls back to rendering the aspect label when omitted.
 */
export function AspectRatioGrid(props: AspectRatioGridProps): ReactNode {
  const { aspects, container, layoutOptions, renderPreview, className, style } = props;
  const placements = layoutAspectPreviews(aspects, container, layoutOptions);
  const gapPx = layoutOptions?.gapPx ?? 12;
  return (
    <div
      className={className}
      data-testid="sf-aspect-grid"
      style={{
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        gap: `${gapPx}px`,
        width: container.width,
        ...style,
      }}
    >
      {placements.map((p) => {
        const label = p.aspect.label ?? `${p.aspect.w}:${p.aspect.h}`;
        return (
          <AspectRatioPreview
            key={label}
            aspect={p.aspect}
            widthPx={p.widthPx}
            heightPx={p.heightPx}
          >
            {renderPreview ? renderPreview(p) : label}
          </AspectRatioPreview>
        );
      })}
    </div>
  );
}
