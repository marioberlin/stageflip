// apps/stageflip-slide/src/components/toolbar/persistent-toolbar.tsx
// Top-of-canvas persistent toolbar — new slide / undo / redo / zoom /
// present (T-139a).

/**
 * Always-mounted toolbar above the SlideCanvas. Shows global actions that
 * stay valid regardless of selection:
 *
 *   - New slide (Mod+M) — appends a blank slide to the active document.
 *   - Undo / Redo (Mod+Z / Mod+Shift+Z) — disabled when the respective
 *     stack is empty; the inner shortcuts already live in EditorShell.
 *   - Zoom readout + in/out steppers — a visual hook for canvas scale.
 *     Canvas scale itself is derived in `<SlideCanvas>` via ResizeObserver,
 *     so this toolbar's zoom controls are reported via the `onZoomChange`
 *     prop for the parent to bind.
 *   - Present — flips the app's edit/preview mode.
 *   - Slide counter — "3 / 12" style N-of-N readout for the active slide.
 *
 * The toolbar is deliberately dumb (all actions come in as props) so
 * tests can drive it without standing up the full EditorShell.
 */

'use client';

import { t, useDocument } from '@stageflip/editor-shell';
import type { CSSProperties, ReactElement } from 'react';

export interface PersistentToolbarProps {
  /** Zoom level in the 0..1 range or >1 for overzoom. Rendered as %. */
  zoom: number;
  /** Step zoom by one preset. Ignored if the parent doesn't support zoom. */
  onZoomIn: () => void;
  onZoomOut: () => void;
  /** Flip mode to the preview/player surface. */
  onPresent: () => void;
  /** Append a blank slide and activate it. */
  onNewSlide: () => void;
}

export function PersistentToolbar({
  zoom,
  onZoomIn,
  onZoomOut,
  onPresent,
  onNewSlide,
}: PersistentToolbarProps): ReactElement {
  const { document: doc, activeSlideId, canUndo, canRedo, undo, redo } = useDocument();
  const slides = doc?.content.mode === 'slide' ? doc.content.slides : [];
  const slideIdx = slides.findIndex((s) => s.id === activeSlideId);
  const slideCounter =
    slideIdx >= 0 ? `${slideIdx + 1} / ${slides.length}` : `— / ${slides.length}`;

  return (
    <div
      data-testid="persistent-toolbar"
      role="toolbar"
      aria-label={t('toolbar.persistent.ariaLabel')}
      style={rootStyle}
    >
      <div style={groupStyle}>
        <ToolbarButton
          testId="persistent-toolbar-new-slide"
          label={t('toolbar.persistent.newSlide')}
          onClick={onNewSlide}
        />
      </div>
      <Divider />
      <div style={groupStyle}>
        <ToolbarButton
          testId="persistent-toolbar-undo"
          label={t('toolbar.persistent.undo')}
          disabled={!canUndo}
          onClick={undo}
        />
        <ToolbarButton
          testId="persistent-toolbar-redo"
          label={t('toolbar.persistent.redo')}
          disabled={!canRedo}
          onClick={redo}
        />
      </div>
      <Divider />
      <div style={groupStyle}>
        <ToolbarButton
          testId="persistent-toolbar-zoom-out"
          label={t('toolbar.persistent.zoomOut')}
          onClick={onZoomOut}
        >
          −
        </ToolbarButton>
        <span data-testid="persistent-toolbar-zoom-readout" style={zoomReadoutStyle}>
          {Math.round(zoom * 100)}%
        </span>
        <ToolbarButton
          testId="persistent-toolbar-zoom-in"
          label={t('toolbar.persistent.zoomIn')}
          onClick={onZoomIn}
        >
          +
        </ToolbarButton>
      </div>
      <div style={spacerStyle} />
      <span data-testid="persistent-toolbar-slide-counter" style={counterStyle}>
        {slideCounter}
      </span>
      <ToolbarButton
        testId="persistent-toolbar-present"
        label={t('toolbar.persistent.present')}
        onClick={onPresent}
        accent
      />
    </div>
  );
}

interface ToolbarButtonProps {
  testId: string;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  accent?: boolean;
  children?: ReactElement | string;
}

function ToolbarButton({
  testId,
  label,
  onClick,
  disabled,
  accent,
  children,
}: ToolbarButtonProps): ReactElement {
  return (
    <button
      type="button"
      data-testid={testId}
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      style={buttonStyle(disabled === true, accent === true)}
    >
      {children ?? label}
    </button>
  );
}

function Divider(): ReactElement {
  return <span aria-hidden="true" style={dividerStyle} />;
}

const rootStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  padding: '6px 12px',
  background: 'rgba(21, 28, 35, 0.6)',
  backdropFilter: 'blur(8px)',
  borderRadius: 8,
  border: '1px solid rgba(129, 174, 255, 0.08)',
  color: '#ebf1fa',
  fontSize: 12,
};

const groupStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 4,
};

const spacerStyle: CSSProperties = { flex: 1 };

const dividerStyle: CSSProperties = {
  width: 1,
  height: 16,
  background: 'rgba(165, 172, 180, 0.15)',
};

const zoomReadoutStyle: CSSProperties = {
  fontFamily: 'monospace',
  fontSize: 11,
  color: '#a5acb4',
  minWidth: 42,
  textAlign: 'center',
};

const counterStyle: CSSProperties = {
  fontFamily: 'monospace',
  fontSize: 11,
  color: '#a5acb4',
  marginRight: 12,
};

function buttonStyle(disabled: boolean, accent: boolean): CSSProperties {
  return {
    padding: '4px 10px',
    background: accent
      ? 'rgba(129, 174, 255, 0.15)'
      : disabled
        ? 'transparent'
        : 'rgba(21, 28, 35, 0.4)',
    color: disabled ? '#5a6068' : accent ? '#5af8fb' : '#ebf1fa',
    border: `1px solid ${accent ? 'rgba(90, 248, 251, 0.4)' : 'rgba(129, 174, 255, 0.15)'}`,
    borderRadius: 6,
    fontSize: 12,
    fontWeight: 500,
    cursor: disabled ? 'not-allowed' : 'pointer',
  };
}
