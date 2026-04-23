// apps/stageflip-slide/src/components/dialogs/find-replace/find-replace.tsx
// Find/replace dialog — UI around editor-shell's findMatches + replaceAll (T-139c).

'use client';

import {
  EMPTY_FIND_HIGHLIGHTS,
  type FindMatch,
  findHighlightsAtom,
  findMatches,
  replaceAll,
  t,
  useDocument,
  useEditorShellAtomValue,
  useEditorShellSetAtom,
} from '@stageflip/editor-shell';
import type { CSSProperties, ReactElement } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

/**
 * Props for the `<FindReplace>` dialog.
 *
 * The dialog is rendered unconditionally by its parent; `open` controls
 * visibility so the keyboard bindings can flip it on/off without
 * remounting (which would drop query state).
 */
export interface FindReplaceProps {
  open: boolean;
  /** Invoked when the user closes the dialog via Esc or the close button. */
  onClose: () => void;
  /** When true, renders the replacement input + Replace buttons. */
  showReplace: boolean;
}

/**
 * Dialog that walks every text element in the document, reports ordered
 * matches via `findMatches`, and writes the active match set into
 * `findHighlightsAtom` so the canvas overlay layer can highlight them.
 *
 * Navigation (Next / Previous) updates the active index + re-centers the
 * canvas via selection; replace-all runs through `replaceAll` and wraps
 * the mutation in a T-133 transaction so the whole rewrite is one undo.
 */
export function FindReplace({ open, onClose, showReplace }: FindReplaceProps): ReactElement | null {
  const {
    document: doc,
    setDocument,
    beginTransaction,
    commitTransaction,
    setActiveSlide,
    selectElements,
  } = useDocument();
  const setHighlights = useEditorShellSetAtom(findHighlightsAtom);

  const [query, setQuery] = useState<string>('');
  const [replaceWith, setReplaceWith] = useState<string>('');
  const [caseSensitive, setCaseSensitive] = useState<boolean>(false);
  const [wholeWord, setWholeWord] = useState<boolean>(false);
  const [useRegex, setUseRegex] = useState<boolean>(false);
  const [activeIndex, setActiveIndex] = useState<number>(0);
  const [regexInvalid, setRegexInvalid] = useState<boolean>(false);

  const findInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const id = setTimeout(() => findInputRef.current?.focus(), 0);
    return () => clearTimeout(id);
  }, [open]);

  useEffect(() => {
    if (!useRegex || query === '') {
      setRegexInvalid(false);
      return;
    }
    try {
      // eslint-disable-next-line @typescript-eslint/no-unused-expressions
      new RegExp(query, caseSensitive ? 'g' : 'gi');
      setRegexInvalid(false);
    } catch {
      setRegexInvalid(true);
    }
  }, [useRegex, query, caseSensitive]);

  const matches: FindMatch[] = useMemo(
    () => findMatches(doc, query, { caseSensitive, wholeWord, regex: useRegex }),
    [doc, query, caseSensitive, wholeWord, useRegex],
  );

  useEffect(() => {
    if (matches.length === 0) setActiveIndex(0);
    else if (activeIndex >= matches.length) setActiveIndex(matches.length - 1);
  }, [matches, activeIndex]);

  useEffect(() => {
    if (!open) {
      setHighlights(EMPTY_FIND_HIGHLIGHTS);
      return;
    }
    setHighlights({ matches, activeIndex: matches.length > 0 ? activeIndex : -1 });
  }, [open, matches, activeIndex, setHighlights]);

  useEffect(() => () => setHighlights(EMPTY_FIND_HIGHLIGHTS), [setHighlights]);

  const focusMatch = useCallback(
    (idx: number): void => {
      const m = matches[idx];
      if (!m) return;
      setActiveSlide(m.slideId);
      selectElements(new Set([m.elementId]));
    },
    [matches, setActiveSlide, selectElements],
  );

  const nextMatch = useCallback((): void => {
    if (matches.length === 0) return;
    const nextIdx = (activeIndex + 1) % matches.length;
    setActiveIndex(nextIdx);
    focusMatch(nextIdx);
  }, [matches, activeIndex, focusMatch]);

  const prevMatch = useCallback((): void => {
    if (matches.length === 0) return;
    const nextIdx = (activeIndex - 1 + matches.length) % matches.length;
    setActiveIndex(nextIdx);
    focusMatch(nextIdx);
  }, [matches, activeIndex, focusMatch]);

  const handleReplaceCurrent = useCallback((): void => {
    const m = matches[activeIndex];
    if (!m || !doc) return;
    if (doc.content.mode !== 'slide') return;
    beginTransaction('find-replace: single');
    try {
      const nextDoc = {
        ...doc,
        content: {
          ...doc.content,
          slides: doc.content.slides.map((slide) => {
            if (slide.id !== m.slideId) return slide;
            return {
              ...slide,
              elements: slide.elements.map((el) => {
                if (el.id !== m.elementId || el.type !== 'text') return el;
                const text =
                  el.text.slice(0, m.start) + replaceWith + el.text.slice(m.start + m.length);
                return { ...el, text };
              }),
            };
          }),
        },
      };
      setDocument(nextDoc);
    } finally {
      commitTransaction();
    }
  }, [matches, activeIndex, doc, replaceWith, beginTransaction, commitTransaction, setDocument]);

  const handleReplaceAll = useCallback((): void => {
    if (!doc || query === '') return;
    beginTransaction('find-replace: all');
    try {
      const nextDoc = replaceAll(doc, query, replaceWith, {
        caseSensitive,
        wholeWord,
        regex: useRegex,
      });
      if (nextDoc !== doc) setDocument(nextDoc);
    } finally {
      commitTransaction();
    }
  }, [
    doc,
    query,
    replaceWith,
    caseSensitive,
    wholeWord,
    useRegex,
    beginTransaction,
    commitTransaction,
    setDocument,
  ]);

  const handleFindKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>): void => {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (e.shiftKey) prevMatch();
        else nextMatch();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    },
    [nextMatch, prevMatch, onClose],
  );

  if (!open) return null;

  const counter = regexInvalid
    ? t('findReplace.invalidRegex')
    : matches.length === 0
      ? query === ''
        ? ''
        : t('findReplace.noMatches')
      : `${activeIndex + 1} ${t('findReplace.of')} ${matches.length}`;

  return (
    <div
      data-testid="find-replace"
      // biome-ignore lint/a11y/useSemanticElements: Native <dialog> requires imperative showModal()/close() calls that do not compose with the declarative open/onClose prop contract. role="dialog" + aria-modal supply the same a11y surface. Matches modal-shell.tsx pattern.
      role="dialog"
      aria-modal="true"
      aria-label={showReplace ? t('findReplace.title.findReplace') : t('findReplace.title.find')}
      style={dialogStyle}
    >
      <header style={headerStyle}>
        <span style={titleStyle}>
          {showReplace ? t('findReplace.title.findReplace') : t('findReplace.title.find')}
        </span>
        <button
          type="button"
          data-testid="find-replace-close"
          aria-label={t('findReplace.close')}
          onClick={onClose}
          style={closeButtonStyle}
        >
          ✕
        </button>
      </header>
      <div style={bodyStyle}>
        <div style={rowStyle}>
          <input
            ref={findInputRef}
            type="text"
            data-testid="find-replace-query"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleFindKeyDown}
            placeholder={t('findReplace.findPlaceholder')}
            style={inputStyle}
          />
          <span data-testid="find-replace-counter" style={counterStyle}>
            {counter}
          </span>
        </div>
        {showReplace ? (
          <input
            type="text"
            data-testid="find-replace-replace-with"
            value={replaceWith}
            onChange={(e) => setReplaceWith(e.target.value)}
            placeholder={t('findReplace.replacePlaceholder')}
            style={inputStyle}
          />
        ) : null}
        <div style={optionsStyle}>
          <label style={optionLabelStyle}>
            <input
              type="checkbox"
              data-testid="find-replace-case-sensitive"
              checked={caseSensitive}
              onChange={(e) => setCaseSensitive(e.target.checked)}
            />
            {t('findReplace.caseSensitive')}
          </label>
          <label style={optionLabelStyle}>
            <input
              type="checkbox"
              data-testid="find-replace-whole-word"
              checked={wholeWord}
              onChange={(e) => setWholeWord(e.target.checked)}
              disabled={useRegex}
            />
            {t('findReplace.wholeWord')}
          </label>
          <label style={optionLabelStyle}>
            <input
              type="checkbox"
              data-testid="find-replace-regex"
              checked={useRegex}
              onChange={(e) => setUseRegex(e.target.checked)}
            />
            {t('findReplace.regex')}
          </label>
        </div>
      </div>
      <footer style={footerStyle}>
        <button
          type="button"
          data-testid="find-replace-previous"
          disabled={matches.length === 0}
          onClick={prevMatch}
          style={buttonStyle(false)}
        >
          {t('findReplace.previous')}
        </button>
        <button
          type="button"
          data-testid="find-replace-next"
          disabled={matches.length === 0}
          onClick={nextMatch}
          style={buttonStyle(false)}
        >
          {t('findReplace.next')}
        </button>
        {showReplace ? (
          <>
            <button
              type="button"
              data-testid="find-replace-replace"
              disabled={matches.length === 0}
              onClick={handleReplaceCurrent}
              style={buttonStyle(true)}
            >
              {t('findReplace.replace')}
            </button>
            <button
              type="button"
              data-testid="find-replace-replace-all"
              disabled={matches.length === 0}
              onClick={handleReplaceAll}
              style={buttonStyle(true)}
            >
              {t('findReplace.replaceAll')}
            </button>
          </>
        ) : null}
      </footer>
    </div>
  );
}

/**
 * Read-only hook that exposes the currently-rendered find-replace
 * highlights. Canvas overlays consume this to paint match rectangles.
 */
export function useFindHighlights(): readonly FindMatch[] {
  const state = useEditorShellAtomValue(findHighlightsAtom);
  return state.matches;
}

const dialogStyle: CSSProperties = {
  position: 'fixed',
  top: 80,
  right: 24,
  zIndex: 1001,
  width: 440,
  background: 'rgba(21, 28, 35, 0.95)',
  backdropFilter: 'blur(16px)',
  borderRadius: 12,
  border: '1px solid rgba(129, 174, 255, 0.1)',
  color: '#ebf1fa',
  fontSize: 13,
};

const headerStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '14px 16px 8px',
};

const titleStyle: CSSProperties = {
  fontWeight: 600,
  fontSize: 13,
  letterSpacing: 0.02,
};

const closeButtonStyle: CSSProperties = {
  background: 'transparent',
  border: 'none',
  color: '#a5acb4',
  cursor: 'pointer',
  fontSize: 12,
  padding: 4,
};

const bodyStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  padding: '0 16px 8px',
};

const rowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
};

const inputStyle: CSSProperties = {
  flex: 1,
  padding: '6px 10px',
  background: 'rgba(8, 15, 21, 0.6)',
  border: '1px solid rgba(129, 174, 255, 0.12)',
  borderRadius: 6,
  color: '#ebf1fa',
  fontSize: 13,
  outline: 'none',
};

const counterStyle: CSSProperties = {
  fontFamily: 'monospace',
  fontSize: 11,
  color: '#a5acb4',
  minWidth: 68,
  textAlign: 'right',
};

const optionsStyle: CSSProperties = {
  display: 'flex',
  gap: 12,
  alignItems: 'center',
};

const optionLabelStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  fontSize: 11,
  color: '#a5acb4',
  cursor: 'pointer',
};

const footerStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'flex-end',
  gap: 6,
  padding: '4px 16px 14px',
};

function buttonStyle(accent: boolean): CSSProperties {
  return {
    padding: '6px 12px',
    background: accent ? 'rgba(129, 174, 255, 0.15)' : 'transparent',
    color: accent ? '#5af8fb' : '#a5acb4',
    border: `1px solid ${accent ? 'rgba(90, 248, 251, 0.3)' : 'rgba(129, 174, 255, 0.2)'}`,
    borderRadius: 6,
    fontSize: 12,
    fontWeight: 500,
    cursor: 'pointer',
  };
}
