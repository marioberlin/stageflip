// apps/stageflip-slide/src/components/shortcuts/shortcut-cheat-sheet.tsx
// Searchable modal over every registered keyboard shortcut (T-129).

/**
 * Reads the live shortcut set via `useAllShortcuts()` and renders a
 * searchable list grouped by `Shortcut.category`. The search filter
 * matches both the description and the formatted combo (case-insensitive
 * substring). Escape or the close button fires `onClose`.
 *
 * Ports the outer shell of SlideMotion's `ShortcutCheatSheet.tsx`. The
 * content is driven entirely by the registry — adding a new shortcut
 * anywhere in the app automatically shows up here without touching this
 * file.
 */

'use client';

import {
  type Shortcut,
  type ShortcutCategory,
  formatCombo,
  t,
  useAllShortcuts,
} from '@stageflip/editor-shell';
import {
  type ChangeEvent,
  type KeyboardEvent,
  type ReactElement,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

const CATEGORY_ORDER: ReadonlyArray<ShortcutCategory> = [
  'essential',
  'slide',
  'object',
  'selection',
  'text',
  'navigation',
  'presentation',
  'help',
];

export interface ShortcutCheatSheetProps {
  open: boolean;
  onClose: () => void;
}

export function ShortcutCheatSheet({
  open,
  onClose,
}: ShortcutCheatSheetProps): ReactElement | null {
  const shortcuts = useAllShortcuts();
  const [query, setQuery] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);

  // Reset + focus when the dialog reopens so a prior query doesn't leak.
  useEffect(() => {
    if (!open) return;
    setQuery('');
    searchRef.current?.focus();
  }, [open]);

  const grouped = useMemo(() => groupByCategory(shortcuts, query), [shortcuts, query]);

  if (!open) return null;

  const total = grouped.reduce((sum, g) => sum + g.items.length, 0);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
    }
  };

  return (
    // Biome flags role="dialog" on a div → use <dialog>. Manual open/close
    // is handled by the parent; we don't use the native `showModal()` API
    // because that's focus-trapping and we manage Escape ourselves.
    <dialog
      data-testid="shortcut-cheat-sheet"
      open
      aria-label={t('shortcut.cheatSheet.title')}
      style={backdropStyle}
      onKeyDown={onKeyDown}
    >
      <div style={panelStyle}>
        <div style={headerStyle}>
          <h2 style={titleStyle}>{t('shortcut.cheatSheet.title')}</h2>
          <button
            type="button"
            data-testid="shortcut-close"
            onClick={onClose}
            style={closeButtonStyle}
            aria-label={t('shortcut.cheatSheet.close')}
          >
            ×
          </button>
        </div>
        <input
          ref={searchRef}
          type="text"
          data-testid="shortcut-search"
          value={query}
          onChange={(event: ChangeEvent<HTMLInputElement>) => setQuery(event.target.value)}
          placeholder={t('shortcut.cheatSheet.search')}
          aria-label={t('shortcut.cheatSheet.search')}
          style={searchStyle}
        />
        <div style={listStyle}>
          {total === 0 ? (
            <p data-testid="shortcut-empty" style={emptyStyle}>
              {t('shortcut.cheatSheet.empty')}
            </p>
          ) : (
            grouped.map((group) => (
              <section key={group.category} data-testid={`shortcut-group-${group.category}`}>
                <h3 style={groupHeadingStyle}>{group.category}</h3>
                <ul style={groupListStyle}>
                  {group.items.map((shortcut) => (
                    <li
                      key={shortcut.id}
                      data-testid={`shortcut-row-${shortcut.id}`}
                      style={rowStyle}
                    >
                      <span style={descStyle}>{shortcut.description}</span>
                      <kbd style={kbdStyle}>{formatCombo(shortcut.combo)}</kbd>
                    </li>
                  ))}
                </ul>
              </section>
            ))
          )}
        </div>
        <footer style={footerStyle}>
          <span>
            {total} {t('shortcut.cheatSheet.shortcuts')}
          </span>
          <span>{t('shortcut.cheatSheet.close')}</span>
        </footer>
      </div>
    </dialog>
  );
}

// ---- pure helpers ---------------------------------------------------------

interface Group {
  category: ShortcutCategory;
  items: Shortcut[];
}

function groupByCategory(shortcuts: ReadonlyArray<Shortcut>, query: string): Group[] {
  const needle = query.trim().toLowerCase();
  const byCategory = new Map<ShortcutCategory, Shortcut[]>();
  for (const shortcut of shortcuts) {
    if (needle && !matches(shortcut, needle)) continue;
    const bucket = byCategory.get(shortcut.category) ?? [];
    bucket.push(shortcut);
    byCategory.set(shortcut.category, bucket);
  }
  const result: Group[] = [];
  for (const category of CATEGORY_ORDER) {
    const items = byCategory.get(category);
    if (items && items.length > 0) result.push({ category, items });
  }
  // Surface any category that wasn't in the canonical order (defensive —
  // the union is closed in editor-shell but keeps the helper robust if
  // new categories land without a code change here).
  for (const [category, items] of byCategory) {
    if (!CATEGORY_ORDER.includes(category) && items.length > 0) {
      result.push({ category, items });
    }
  }
  return result;
}

function matches(shortcut: Shortcut, needle: string): boolean {
  if (shortcut.description.toLowerCase().includes(needle)) return true;
  if (formatCombo(shortcut.combo).toLowerCase().includes(needle)) return true;
  if (shortcut.combo.toLowerCase().includes(needle)) return true;
  return false;
}

export const __test = { groupByCategory, matches };

// ---- styles ---------------------------------------------------------------

const backdropStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(8, 15, 21, 0.72)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 200,
  backdropFilter: 'blur(4px)',
};

const panelStyle: React.CSSProperties = {
  width: 'min(560px, 90vw)',
  maxHeight: '80vh',
  display: 'flex',
  flexDirection: 'column',
  background: '#151c23',
  border: '1px solid rgba(129, 174, 255, 0.18)',
  borderRadius: 12,
  color: '#ebf1fa',
  boxShadow: '0 16px 40px rgba(0, 0, 0, 0.5)',
};

const headerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '14px 18px 10px',
};

const titleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 16,
  fontWeight: 700,
};

const closeButtonStyle: React.CSSProperties = {
  background: 'transparent',
  border: 0,
  color: '#a5acb4',
  fontSize: 20,
  cursor: 'pointer',
  padding: 0,
  lineHeight: 1,
};

const searchStyle: React.CSSProperties = {
  margin: '0 18px 10px',
  padding: '8px 10px',
  fontSize: 12,
  color: '#ebf1fa',
  background: 'rgba(21, 28, 35, 0.6)',
  border: '1px solid rgba(129, 174, 255, 0.12)',
  borderRadius: 6,
  outline: 'none',
};

const listStyle: React.CSSProperties = {
  flex: 1,
  overflowY: 'auto',
  padding: '4px 18px 14px',
};

const groupHeadingStyle: React.CSSProperties = {
  margin: '12px 0 4px',
  fontSize: 10,
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: 0.14,
  color: '#5af8fb',
};

const groupListStyle: React.CSSProperties = {
  listStyle: 'none',
  margin: 0,
  padding: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
};

const rowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '6px 0',
  fontSize: 12,
};

const descStyle: React.CSSProperties = {
  color: '#ebf1fa',
};

const kbdStyle: React.CSSProperties = {
  padding: '2px 8px',
  background: 'rgba(129, 174, 255, 0.12)',
  border: '1px solid rgba(129, 174, 255, 0.2)',
  borderRadius: 4,
  color: '#81aeff',
  fontSize: 11,
  fontFamily: 'monospace',
  letterSpacing: 0.04,
};

const emptyStyle: React.CSSProperties = {
  margin: '24px 0',
  textAlign: 'center',
  color: '#5a6068',
  fontStyle: 'italic',
  fontSize: 12,
};

const footerStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  padding: '10px 18px 14px',
  fontSize: 10,
  color: '#5a6068',
  borderTop: '1px solid rgba(165, 172, 180, 0.08)',
};
