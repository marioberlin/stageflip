// apps/stageflip-slide/src/components/presentation/presentation-mode.tsx
// Full-screen slide presentation player with keyboard nav + notes (T-139c).

'use client';

import { type Shortcut, t, useDocument, useRegisterShortcuts } from '@stageflip/editor-shell';
import type { Slide } from '@stageflip/schema';
import type { CSSProperties, ReactElement } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { SlidePlayer } from '../canvas/slide-player';

export interface PresentationModeProps {
  open: boolean;
  onClose: () => void;
  /** Slide id to start from. Defaults to the document's first slide. */
  startSlideId?: string;
  /** Override the default FPS — used in tests where rAF is deterministic. */
  fps?: number;
  /** Optional starting frame (paused). Defaults to 0. */
  initialFrame?: number;
}

const DEFAULT_FPS = 30;
const SLIDE_WIDTH = 1920;
const SLIDE_HEIGHT = 1080;
const DEFAULT_DURATION_IN_FRAMES = 120;

/**
 * Full-screen slide player. Mounts `<SlidePlayer>` at viewport scale,
 * registers keyboard navigation (arrows / space → next, shift-arrows /
 * Backspace → previous, Esc → close), and renders an optional speaker
 * notes side panel.
 *
 * Keyboard bindings flow through the T-121a shortcut registry
 * (CLAUDE.md §10) — one `useRegisterShortcuts` batch registered while
 * `open`, unregistered on close. Bare-key combos are suppressed
 * automatically when focus is inside an input / textarea /
 * contenteditable (registry's `isTypingTarget` guard). T-140 migrated
 * this from a raw `window.addEventListener('keydown', ...)`.
 */
export function PresentationMode({
  open,
  onClose,
  startSlideId,
  fps = DEFAULT_FPS,
  initialFrame = 0,
}: PresentationModeProps): ReactElement | null {
  const { document: doc } = useDocument();

  const slides: readonly Slide[] = useMemo(() => {
    if (!doc || doc.content.mode !== 'slide') return [];
    return doc.content.slides;
  }, [doc]);

  const startIdx = useMemo(() => {
    if (!startSlideId) return 0;
    const idx = slides.findIndex((s) => s.id === startSlideId);
    return idx >= 0 ? idx : 0;
  }, [slides, startSlideId]);

  const [currentIdx, setCurrentIdx] = useState<number>(startIdx);
  const [currentFrame, setCurrentFrame] = useState<number>(initialFrame);
  const [notesOpen, setNotesOpen] = useState<boolean>(true);

  useEffect(() => {
    if (!open) return;
    setCurrentIdx(startIdx);
    setCurrentFrame(initialFrame);
  }, [open, startIdx, initialFrame]);

  const goNext = useCallback((): void => {
    setCurrentIdx((i) => Math.min(i + 1, Math.max(slides.length - 1, 0)));
    setCurrentFrame(0);
  }, [slides.length]);

  const goPrev = useCallback((): void => {
    setCurrentIdx((i) => Math.max(i - 1, 0));
    setCurrentFrame(0);
  }, []);

  const toggleNotes = useCallback((): void => {
    setNotesOpen((v) => !v);
  }, []);

  const shortcuts = useMemo<Shortcut[]>(() => {
    if (!open) return [];
    const next: Shortcut['handler'] = () => {
      goNext();
      return undefined;
    };
    const prev: Shortcut['handler'] = () => {
      goPrev();
      return undefined;
    };
    return [
      {
        id: 'presentation.next.arrowRight',
        combo: 'ArrowRight',
        description: 'Next slide',
        category: 'presentation',
        handler: next,
      },
      {
        id: 'presentation.next.arrowDown',
        combo: 'ArrowDown',
        description: 'Next slide',
        category: 'presentation',
        handler: next,
      },
      {
        id: 'presentation.next.space',
        combo: 'Space',
        description: 'Next slide',
        category: 'presentation',
        handler: next,
      },
      {
        id: 'presentation.next.enter',
        combo: 'Enter',
        description: 'Next slide',
        category: 'presentation',
        handler: next,
      },
      {
        id: 'presentation.prev.arrowLeft',
        combo: 'ArrowLeft',
        description: 'Previous slide',
        category: 'presentation',
        handler: prev,
      },
      {
        id: 'presentation.prev.arrowUp',
        combo: 'ArrowUp',
        description: 'Previous slide',
        category: 'presentation',
        handler: prev,
      },
      {
        id: 'presentation.prev.backspace',
        combo: 'Backspace',
        description: 'Previous slide',
        category: 'presentation',
        handler: prev,
      },
      {
        id: 'presentation.exit',
        combo: 'Escape',
        description: 'Exit presentation',
        category: 'presentation',
        handler: () => {
          onClose();
          return undefined;
        },
      },
      {
        id: 'presentation.notes.toggle',
        combo: 's',
        description: 'Toggle speaker notes',
        category: 'presentation',
        handler: () => {
          toggleNotes();
          return undefined;
        },
      },
    ];
  }, [open, goNext, goPrev, onClose, toggleNotes]);
  useRegisterShortcuts(shortcuts);

  if (!open) return null;
  const slide = slides[currentIdx];
  if (!slide) {
    return (
      <div data-testid="presentation-empty" style={emptyStyle}>
        <button type="button" onClick={onClose} style={exitButtonStyle}>
          {t('presentation.exit')}
        </button>
      </div>
    );
  }

  return (
    <div
      data-testid="presentation"
      style={rootStyle}
      // biome-ignore lint/a11y/useSemanticElements: Native <dialog> requires imperative showModal()/close() that does not compose with the declarative open prop + keyboard-nav state. role="dialog" + aria-modal supply the same a11y surface. Matches modal-shell.tsx pattern.
      role="dialog"
      aria-modal="true"
      aria-label={t('nav.present')}
    >
      <div style={stageStyle} data-testid="presentation-stage">
        <SlidePlayer
          slide={slide}
          width={SLIDE_WIDTH}
          height={SLIDE_HEIGHT}
          fps={fps}
          durationInFrames={DEFAULT_DURATION_IN_FRAMES}
          currentFrame={currentFrame}
          onFrameChange={setCurrentFrame}
        />
      </div>
      <div style={overlayStyle}>
        <span data-testid="presentation-counter" style={counterStyle}>
          {t('presentation.counter')} {currentIdx + 1} / {slides.length}
        </span>
        <div style={controlsStyle}>
          <button
            type="button"
            data-testid="presentation-toggle-notes"
            onClick={() => setNotesOpen((v) => !v)}
            style={controlButtonStyle}
          >
            {t('presentation.notes.toggle')}
          </button>
          <button
            type="button"
            data-testid="presentation-exit"
            onClick={onClose}
            style={controlButtonStyle}
          >
            {t('presentation.exit')}
          </button>
        </div>
      </div>
      {notesOpen ? (
        <aside
          data-testid="presentation-notes"
          style={notesStyle}
          aria-label={t('presentation.notes.title')}
        >
          <h4 style={notesHeaderStyle}>{t('presentation.notes.title')}</h4>
          <p style={notesBodyStyle}>
            {slide.notes && slide.notes.length > 0 ? slide.notes : t('presentation.notes.empty')}
          </p>
        </aside>
      ) : null}
    </div>
  );
}

const rootStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 2100,
  background: '#000',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: '#ebf1fa',
};

const stageStyle: CSSProperties = {
  position: 'relative',
  width: '100vw',
  height: '100vh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  overflow: 'hidden',
};

const overlayStyle: CSSProperties = {
  position: 'absolute',
  top: 12,
  left: 12,
  right: 12,
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  pointerEvents: 'none',
};

const counterStyle: CSSProperties = {
  fontFamily: 'monospace',
  fontSize: 12,
  color: '#a5acb4',
  background: 'rgba(21, 28, 35, 0.6)',
  padding: '4px 10px',
  borderRadius: 4,
  pointerEvents: 'auto',
};

const controlsStyle: CSSProperties = {
  display: 'flex',
  gap: 6,
  pointerEvents: 'auto',
};

const controlButtonStyle: CSSProperties = {
  padding: '4px 12px',
  background: 'rgba(21, 28, 35, 0.7)',
  color: '#ebf1fa',
  border: '1px solid rgba(129, 174, 255, 0.2)',
  borderRadius: 4,
  fontSize: 11,
  cursor: 'pointer',
};

const notesStyle: CSSProperties = {
  position: 'absolute',
  right: 12,
  bottom: 12,
  width: 320,
  maxHeight: 260,
  overflow: 'auto',
  background: 'rgba(21, 28, 35, 0.9)',
  border: '1px solid rgba(129, 174, 255, 0.15)',
  borderRadius: 8,
  padding: 14,
};

const notesHeaderStyle: CSSProperties = {
  margin: 0,
  marginBottom: 6,
  fontSize: 12,
  textTransform: 'uppercase',
  color: '#5af8fb',
  letterSpacing: 0.05,
};

const notesBodyStyle: CSSProperties = {
  margin: 0,
  fontSize: 12,
  lineHeight: 1.6,
  color: '#ebf1fa',
  whiteSpace: 'pre-wrap',
};

const emptyStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: '#000',
  zIndex: 2100,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: '#ebf1fa',
};

const exitButtonStyle: CSSProperties = {
  padding: '8px 16px',
  background: 'transparent',
  color: '#ebf1fa',
  border: '1px solid rgba(129, 174, 255, 0.3)',
  borderRadius: 6,
  fontSize: 12,
  cursor: 'pointer',
};
