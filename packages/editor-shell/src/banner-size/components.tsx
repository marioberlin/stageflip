// packages/editor-shell/src/banner-size/components.tsx
// T-201 — headless components for the multi-size banner grid. Renders
// one preview per canonical banner size (e.g. 300×250, 728×90,
// 160×600) and threads a shared `currentFrame` to every cell so
// scrubbing updates all sizes in lockstep.
//
// Zero visual polish — host apps supply a `renderPreview` callback +
// CSS for chrome. The component owns only the geometry (positions +
// sizes) and the synced-scrub plumbing.

'use client';

import type { CSSProperties, ReactNode } from 'react';

import type { BoxSize } from '../aspect-ratio/math';
import {
  type BannerSize,
  type BannerSizeLayoutOptions,
  type BannerSizePlacement,
  layoutBannerSizes,
} from './math';

/* -------------------------------------------------------------------------- */
/* <BannerSizePreview>                                                        */
/* -------------------------------------------------------------------------- */

export interface BannerSizePreviewProps {
  readonly size: BannerSize;
  readonly widthPx: number;
  readonly heightPx: number;
  readonly scale: number;
  readonly children?: ReactNode;
  readonly className?: string;
  readonly style?: CSSProperties;
}

function defaultSizeId(size: BannerSize): string {
  return size.id ?? `${size.width}x${size.height}`;
}

/**
 * A fixed-size preview frame at the scaled banner dimensions. Content
 * that overflows is clipped — cropping / letterboxing is a host
 * concern.
 */
export function BannerSizePreview(props: BannerSizePreviewProps): ReactNode {
  const { size, widthPx, heightPx, scale, children, className, style } = props;
  const id = defaultSizeId(size);
  return (
    <div
      className={className}
      data-testid={`sf-banner-preview-${id}`}
      data-banner-id={id}
      data-banner-width={size.width}
      data-banner-height={size.height}
      data-banner-scale={scale.toFixed(4)}
      style={{
        position: 'relative',
        width: widthPx,
        height: heightPx,
        overflow: 'hidden',
        ['--sf-banner-scale' as string]: `${scale}`,
        ['--sf-banner-width' as string]: `${size.width}`,
        ['--sf-banner-height' as string]: `${size.height}`,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* <BannerSizeGrid>                                                           */
/* -------------------------------------------------------------------------- */

export interface BannerSizeGridProps {
  readonly sizes: readonly BannerSize[];
  readonly container: BoxSize;
  /**
   * Current composition frame. Passed to `renderPreview` so every cell
   * renders the same moment — scrubbing updates all sizes in lockstep.
   * Defaults to 0.
   */
  readonly currentFrame?: number;
  readonly layoutOptions?: BannerSizeLayoutOptions;
  /**
   * Render prop for each cell. Receives the placement + the shared
   * `currentFrame`; return the inner content. The grid wraps the
   * return value in `<BannerSizePreview>`. Defaults to rendering the
   * banner's label as static text.
   */
  readonly renderPreview?: (placement: BannerSizePlacement, currentFrame: number) => ReactNode;
  readonly className?: string;
  readonly style?: CSSProperties;
}

/**
 * Lay out N fixed-dimension banner previews in a single row. Every
 * cell scales by the same factor (see `layoutBannerSizes`) so inter-
 * cell proportions are faithful to reality. Threads `currentFrame` to
 * every render-preview callback for synced scrubbing.
 */
export function BannerSizeGrid(props: BannerSizeGridProps): ReactNode {
  const {
    sizes,
    container,
    currentFrame = 0,
    layoutOptions,
    renderPreview,
    className,
    style,
  } = props;
  const placements = layoutBannerSizes(sizes, container, layoutOptions);
  const gapPx = layoutOptions?.gapPx ?? 16;
  return (
    <div
      className={className}
      data-testid="sf-banner-grid"
      data-current-frame={currentFrame}
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
        const id = defaultSizeId(p.size);
        const label = p.size.name ?? id;
        return (
          <BannerSizePreview
            key={id}
            size={p.size}
            widthPx={p.widthPx}
            heightPx={p.heightPx}
            scale={p.scale}
          >
            {renderPreview ? renderPreview(p, currentFrame) : label}
          </BannerSizePreview>
        );
      })}
    </div>
  );
}
