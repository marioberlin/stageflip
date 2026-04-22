// apps/stageflip-slide/src/components/command-palette/command-palette.tsx
// Modal command palette with search + keyboard navigation (T-127).

'use client';

import { t, useDocument } from '@stageflip/editor-shell';
import type { CSSProperties, ReactElement, KeyboardEvent as ReactKeyboardEvent } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { type PaletteCommand, defaultCommands, filterCommands } from './commands';

/**
 * Modal palette. Opens from `<EditorFrame>` on `Mod+K`, closes on
 * `Escape` or on successful command execution. Keyboard-first:
 * `ArrowDown` / `ArrowUp` move the highlight, `Enter` runs, `Escape`
 * aborts. Click on a row runs the command too.
 *
 * The palette itself is controlled — parent owns the `open` state and
 * the shortcut binding. This keeps the component reusable across
 * contexts (tests mount it directly; the app wires Mod+K).
 */

export interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  /** Optional override for tests + future tool-router integration. */
  commands?: PaletteCommand[];
}

export function CommandPalette({
  open,
  onClose,
  commands,
}: CommandPaletteProps): ReactElement | null {
  const ctx = usePaletteContext();
  const source = useMemo<PaletteCommand[]>(() => commands ?? defaultCommands(), [commands]);
  const [query, setQuery] = useState<string>('');
  const [cursor, setCursor] = useState<number>(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const filtered = useMemo(() => filterCommands(source, query), [source, query]);

  // Reset + auto-focus on open.
  useEffect(() => {
    if (!open) return;
    setQuery('');
    setCursor(0);
    // Deferring focus lets the dialog render first.
    const handle = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(handle);
  }, [open]);

  // Clamp the cursor when the filter shrinks.
  useEffect(() => {
    if (cursor >= filtered.length) setCursor(Math.max(0, filtered.length - 1));
  }, [cursor, filtered.length]);

  const runAt = useCallback(
    (index: number) => {
      const cmd = filtered[index];
      if (!cmd) return;
      const ok = cmd.run(ctx);
      if (ok !== false) onClose();
    },
    [ctx, filtered, onClose],
  );

  const handleKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLElement>) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setCursor((c) => Math.min(filtered.length - 1, c + 1));
        return;
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setCursor((c) => Math.max(0, c - 1));
        return;
      }
      if (event.key === 'Enter') {
        event.preventDefault();
        runAt(cursor);
      }
    },
    [cursor, filtered.length, onClose, runAt],
  );

  if (!open) return null;

  return (
    <dialog
      data-testid="command-palette"
      aria-label={t('commandPalette.placeholder')}
      open
      onKeyDown={handleKeyDown}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      style={backdropStyle}
    >
      <div data-testid="command-palette-panel" style={panelStyle}>
        <input
          ref={inputRef}
          data-testid="command-palette-input"
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setCursor(0);
          }}
          placeholder={t('commandPalette.placeholder')}
          aria-label={t('commandPalette.placeholder')}
          style={inputStyle}
        />
        <div data-testid="command-palette-list" style={listStyle}>
          {filtered.length === 0 ? (
            <div style={emptyStyle} data-testid="command-palette-empty">
              {t('commandPalette.empty')}
            </div>
          ) : (
            filtered.map((cmd, index) => {
              const active = index === cursor;
              return (
                <button
                  key={cmd.id}
                  type="button"
                  data-testid={`command-palette-item-${cmd.id}`}
                  data-active={active || undefined}
                  aria-pressed={active}
                  style={{ ...itemStyle, ...(active ? itemActiveStyle : null) }}
                  onMouseEnter={() => setCursor(index)}
                  onClick={() => runAt(index)}
                >
                  <span style={itemLabelStyle}>{cmd.label}</span>
                  <span style={itemMetaStyle}>
                    <span style={itemCategoryStyle}>{cmd.category}</span>
                    {cmd.shortcut ? <kbd style={kbdStyle}>{cmd.shortcut}</kbd> : null}
                  </span>
                </button>
              );
            })
          )}
        </div>
      </div>
    </dialog>
  );
}

// ---------------------------------------------------------------------------
// Context wiring
// ---------------------------------------------------------------------------

function usePaletteContext() {
  const doc = useDocument();
  return useMemo(
    () => ({
      document: doc.document,
      activeSlideId: doc.activeSlideId,
      setActiveSlide: doc.setActiveSlide,
      setDocument: doc.setDocument,
      updateDocument: doc.updateDocument,
      clearSelection: doc.clearSelection,
      canUndo: doc.canUndo,
      canRedo: doc.canRedo,
    }),
    [doc],
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const backdropStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(8, 15, 21, 0.6)',
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'center',
  paddingTop: '20vh',
  zIndex: 50,
  borderWidth: 0,
  maxHeight: '100%',
  maxWidth: '100%',
  color: '#ebf1fa',
};

const panelStyle: CSSProperties = {
  width: 'min(640px, calc(100% - 48px))',
  background: '#151c23',
  borderWidth: 1,
  borderStyle: 'solid',
  borderColor: 'rgba(129, 174, 255, 0.2)',
  borderRadius: 12,
  boxShadow: '0 20px 60px rgba(0, 114, 229, 0.18)',
  overflow: 'hidden',
};

const inputStyle: CSSProperties = {
  width: '100%',
  padding: '14px 16px',
  background: 'transparent',
  borderWidth: 0,
  borderBottomWidth: 1,
  borderBottomStyle: 'solid',
  borderBottomColor: 'rgba(129, 174, 255, 0.08)',
  color: '#ebf1fa',
  fontSize: 14,
  outline: 'none',
};

const listStyle: CSSProperties = {
  margin: 0,
  padding: 4,
  listStyle: 'none',
  maxHeight: 360,
  overflowY: 'auto',
};

const itemStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  width: '100%',
  padding: '10px 12px',
  background: 'transparent',
  borderWidth: 0,
  borderRadius: 6,
  color: '#a5acb4',
  cursor: 'pointer',
  textAlign: 'left',
};

const itemActiveStyle: CSSProperties = {
  background: 'rgba(129, 174, 255, 0.12)',
  color: '#ebf1fa',
};

const itemLabelStyle: CSSProperties = {
  fontSize: 14,
  fontWeight: 500,
};

const itemMetaStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  fontSize: 11,
};

const itemCategoryStyle: CSSProperties = {
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  color: '#81aeff',
};

const kbdStyle: CSSProperties = {
  padding: '2px 6px',
  borderRadius: 4,
  background: 'rgba(165, 172, 180, 0.1)',
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
  color: '#a5acb4',
};

const emptyStyle: CSSProperties = {
  padding: '14px 12px',
  color: '#a5acb4',
  fontSize: 13,
  textAlign: 'center',
};
