// packages/runtimes/frame-runtime-bridge/src/clips/click-overlay.tsx
// T-202 — "click-overlay" display-profile clip. An invisible full-canvas
// anchor that routes the banner's click through the IAB clickTag variable.
// No visual rendering — the clip exists to make the entire banner surface
// a single hit target. Accessibility hint is surfaced via aria-label.
//
// Deterministic: the component is stateless; no frame-runtime timing is
// used (the anchor is always mounted for the duration of its clip window
// — no fades, no timing, nothing to drift). The clip still mounts inside
// a FrameProvider via the bridge, but this component doesn't read it.

import type { ClipDefinition } from '@stageflip/runtimes-contract';
import type { ReactElement } from 'react';
import { z } from 'zod';

import { defineFrameClip } from '../index.js';

export const clickOverlayPropsSchema = z
  .object({
    /**
     * Exit URL the click routes to. Ad networks replace this with their
     * own `clickTag` variable at serve time; at preview time we render it
     * as a plain anchor href. Default matches the IAB macro convention.
     */
    clickTag: z.string().min(1).optional(),
    /**
     * `target` attribute for the anchor. `_blank` is the IAB standard so
     * the ad does not navigate away from the publisher's page.
     */
    target: z.enum(['_blank', '_self', '_parent', '_top']).optional(),
    /**
     * Accessible label announced by screen readers. Should describe the
     * advertiser or offer ("Buy now from Acme"). Required by IAB / WCAG.
     */
    ariaLabel: z.string().min(1),
  })
  .strict();

export type ClickOverlayProps = z.infer<typeof clickOverlayPropsSchema>;

const DEFAULT_CLICK_TAG = '%%CLICK_URL_UNESC%%%%DEST_URL%%';

export function ClickOverlay({
  clickTag = DEFAULT_CLICK_TAG,
  target = '_blank',
  ariaLabel,
}: ClickOverlayProps): ReactElement {
  const relAttr = target === '_blank' ? 'noopener noreferrer' : undefined;
  return (
    <a
      data-testid="click-overlay-clip"
      data-click-tag={clickTag}
      href={clickTag}
      target={target}
      aria-label={ariaLabel}
      {...(relAttr !== undefined ? { rel: relAttr } : {})}
      style={{
        position: 'absolute',
        inset: 0,
        display: 'block',
        background: 'transparent',
        cursor: 'pointer',
        // Transparent but captures pointer events across the whole canvas.
        pointerEvents: 'auto',
      }}
    />
  );
}

export const clickOverlayClip: ClipDefinition<unknown> = defineFrameClip<ClickOverlayProps>({
  kind: 'click-overlay',
  component: ClickOverlay,
  propsSchema: clickOverlayPropsSchema,
});
