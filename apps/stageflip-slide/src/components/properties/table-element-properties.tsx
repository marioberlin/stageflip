// apps/stageflip-slide/src/components/properties/table-element-properties.tsx
// Table-element branch of the properties panel (T-125c).

/**
 * Editors:
 *   - rows + columns read-outs with paired add / remove buttons. Remove is
 *     disabled at 1 to enforce `rows`/`columns` min (Zod: `int().positive()`).
 *   - `headerRow` boolean toggle.
 *   - Cell grid: every `TableCell` gets a content text input (blur-commit) +
 *     an align dropdown (immediate commit on change).
 *
 * Out of scope (deferred): colspan / rowspan / per-cell color / per-cell
 * background / bold. Those are reasonable to add alongside T-163
 * (table-cm1 bundle). T-125c ships structural + content editing only.
 *
 * Commit semantics (handover-phase6-mid-2 §3.3): cell text buffers into a
 * local draft via `BlurCommitText` and fires `updateDocument` only on blur
 * or Enter. Discrete controls commit on click / change.
 */

'use client';

import { t, useDocument } from '@stageflip/editor-shell';
import type { Document, TableCell, TableElement } from '@stageflip/schema';
import {
  type ChangeEvent,
  type KeyboardEvent,
  type ReactElement,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

type Align = TableCell['align'];
const ALIGN_OPTIONS: readonly Align[] = ['left', 'center', 'right'] as const;

export interface TableElementPropertiesProps {
  slideId: string;
  element: TableElement;
}

export function TableElementProperties({
  slideId,
  element,
}: TableElementPropertiesProps): ReactElement {
  const { updateDocument } = useDocument();
  const locked = element.locked;

  const mutate = useCallback(
    (patch: (el: TableElement) => TableElement) => {
      if (locked) return;
      updateDocument((doc) => applyTablePatch(doc, slideId, element.id, patch));
    },
    [updateDocument, slideId, element.id, locked],
  );

  return (
    <div data-testid="table-element-properties" style={rootStyle}>
      <div style={statRowStyle}>
        <Stat label={t('properties.table.rows')} value={element.rows} valueTestId="table-rows" />
        <Stat
          label={t('properties.table.columns')}
          value={element.columns}
          valueTestId="table-columns"
        />
      </div>

      <div style={buttonRowStyle}>
        <ActionButton
          testId="table-add-row"
          disabled={locked}
          onClick={() => mutate(addRow)}
          label={t('properties.table.addRow')}
        />
        <ActionButton
          testId="table-remove-row"
          disabled={locked || element.rows <= 1}
          onClick={() => mutate(removeTrailingRow)}
          label={t('properties.table.removeRow')}
          variant="destructive"
        />
        <ActionButton
          testId="table-add-column"
          disabled={locked}
          onClick={() => mutate(addColumn)}
          label={t('properties.table.addColumn')}
        />
        <ActionButton
          testId="table-remove-column"
          disabled={locked || element.columns <= 1}
          onClick={() => mutate(removeTrailingColumn)}
          label={t('properties.table.removeColumn')}
          variant="destructive"
        />
      </div>

      <label style={flagLabelStyle}>
        <input
          type="checkbox"
          data-testid="table-header-row"
          checked={element.headerRow}
          disabled={locked}
          onChange={(e) => mutate((el) => ({ ...el, headerRow: e.target.checked }))}
          style={flagInputStyle}
        />
        <span>{t('properties.table.headerRow')}</span>
      </label>

      <div style={gridWrapperStyle}>
        <CellGrid
          element={element}
          disabled={locked}
          onCommit={(row, col, patch) =>
            mutate((el) => ({ ...el, cells: patchCell(el.cells, row, col, patch) }))
          }
        />
      </div>
    </div>
  );
}

function CellGrid({
  element,
  disabled,
  onCommit,
}: {
  element: TableElement;
  disabled: boolean;
  onCommit: (row: number, col: number, patch: Partial<TableCell>) => void;
}): ReactElement {
  const rows: ReactElement[] = [];
  for (let r = 0; r < element.rows; r++) {
    const cols: ReactElement[] = [];
    for (let c = 0; c < element.columns; c++) {
      const cell = findCell(element.cells, r, c);
      cols.push(
        <CellControl
          key={`cell-${r}-${c}`}
          row={r}
          col={c}
          cell={cell}
          disabled={disabled}
          onCommit={(patch) => onCommit(r, c, patch)}
        />,
      );
    }
    rows.push(
      <div key={`row-${r}`} style={cellRowStyle}>
        {cols}
      </div>,
    );
  }
  return <div>{rows}</div>;
}

function CellControl({
  row,
  col,
  cell,
  disabled,
  onCommit,
}: {
  row: number;
  col: number;
  cell: TableCell | undefined;
  disabled: boolean;
  onCommit: (patch: Partial<TableCell>) => void;
}): ReactElement {
  const current = cell ?? emptyCell(row, col);
  return (
    <div style={cellStyle}>
      <BlurCommitText
        testId={`table-cell-${row}-${col}-content`}
        initial={current.content}
        disabled={disabled}
        placeholder={t('properties.table.cellContentPlaceholder')}
        onCommit={(content) => onCommit({ content })}
      />
      <select
        data-testid={`table-cell-${row}-${col}-align`}
        value={current.align}
        disabled={disabled}
        onChange={(e) => onCommit({ align: e.target.value as Align })}
        style={alignSelectStyle}
        aria-label={t('properties.table.align')}
      >
        {ALIGN_OPTIONS.map((opt) => (
          <option key={opt} value={opt}>
            {t(`properties.table.align.${opt}`)}
          </option>
        ))}
      </select>
    </div>
  );
}

function BlurCommitText({
  testId,
  initial,
  disabled,
  placeholder,
  onCommit,
}: {
  testId: string;
  initial: string;
  disabled?: boolean;
  placeholder?: string;
  onCommit: (next: string) => void;
}): ReactElement {
  const [draft, setDraft] = useState(initial);
  // See chart-element-properties.tsx for the same Escape / blur race — the
  // ref short-circuits `commit` during a revert so pressing Escape does not
  // paradoxically commit the dirty draft.
  const isReverting = useRef(false);
  useEffect(() => {
    setDraft(initial);
  }, [initial]);
  const commit = () => {
    if (isReverting.current) {
      isReverting.current = false;
      return;
    }
    if (draft !== initial) onCommit(draft);
  };
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      commit();
      e.currentTarget.blur();
    } else if (e.key === 'Escape') {
      isReverting.current = true;
      setDraft(initial);
      e.currentTarget.blur();
    }
  };
  return (
    <input
      type="text"
      data-testid={testId}
      value={draft}
      disabled={disabled}
      placeholder={placeholder}
      aria-label={placeholder}
      onChange={(e: ChangeEvent<HTMLInputElement>) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={onKeyDown}
      style={cellInputStyle}
    />
  );
}

function Stat({
  label,
  value,
  valueTestId,
}: {
  label: string;
  value: number;
  valueTestId: string;
}): ReactElement {
  return (
    <div style={statBlockStyle}>
      <span style={statLabelStyle}>{label}</span>
      <span data-testid={valueTestId} style={statValueStyle}>
        {value}
      </span>
    </div>
  );
}

function ActionButton({
  testId,
  disabled,
  onClick,
  label,
  variant = 'default',
}: {
  testId: string;
  disabled: boolean;
  onClick: () => void;
  label: string;
  variant?: 'default' | 'destructive';
}): ReactElement {
  return (
    <button
      type="button"
      data-testid={testId}
      disabled={disabled}
      onClick={onClick}
      style={actionButtonStyle(disabled, variant)}
    >
      {label}
    </button>
  );
}

// ---- pure helpers ---------------------------------------------------------

function emptyCell(row: number, col: number): TableCell {
  return { row, col, content: '', align: 'left', colspan: 1, rowspan: 1 };
}

function findCell(cells: readonly TableCell[], row: number, col: number): TableCell | undefined {
  return cells.find((c) => c.row === row && c.col === col);
}

function patchCell(
  cells: readonly TableCell[],
  row: number,
  col: number,
  patch: Partial<TableCell>,
): TableCell[] {
  const existing = findCell(cells, row, col);
  if (existing) {
    return cells.map((c) => (c.row === row && c.col === col ? { ...c, ...patch } : c));
  }
  return [...cells, { ...emptyCell(row, col), ...patch }];
}

function addRow(el: TableElement): TableElement {
  const newRow = el.rows;
  const filler: TableCell[] = [];
  for (let col = 0; col < el.columns; col++) filler.push(emptyCell(newRow, col));
  return { ...el, rows: el.rows + 1, cells: [...el.cells, ...filler] };
}

function addColumn(el: TableElement): TableElement {
  const newCol = el.columns;
  const filler: TableCell[] = [];
  for (let row = 0; row < el.rows; row++) filler.push(emptyCell(row, newCol));
  return { ...el, columns: el.columns + 1, cells: [...el.cells, ...filler] };
}

function removeTrailingRow(el: TableElement): TableElement {
  if (el.rows <= 1) return el;
  const targetRow = el.rows - 1;
  return {
    ...el,
    rows: el.rows - 1,
    cells: el.cells.filter((c) => c.row !== targetRow),
  };
}

function removeTrailingColumn(el: TableElement): TableElement {
  if (el.columns <= 1) return el;
  const targetCol = el.columns - 1;
  return {
    ...el,
    columns: el.columns - 1,
    cells: el.cells.filter((c) => c.col !== targetCol),
  };
}

function applyTablePatch(
  doc: Document,
  slideId: string,
  elementId: string,
  patch: (el: TableElement) => TableElement,
): Document {
  if (doc.content.mode !== 'slide') return doc;
  return {
    ...doc,
    content: {
      ...doc.content,
      slides: doc.content.slides.map((slide) =>
        slide.id === slideId
          ? {
              ...slide,
              elements: slide.elements.map((el) =>
                el.id === elementId && el.type === 'table' ? patch(el as TableElement) : el,
              ),
            }
          : slide,
      ),
    },
  };
}

export const __test = {
  addRow,
  addColumn,
  removeTrailingRow,
  removeTrailingColumn,
  patchCell,
  applyTablePatch,
};

// ---- styles ---------------------------------------------------------------

const rootStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
};

const statRowStyle: React.CSSProperties = {
  display: 'flex',
  gap: 16,
};

const statBlockStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
};

const statLabelStyle: React.CSSProperties = {
  fontSize: 9,
  fontWeight: 600,
  letterSpacing: 0.06,
  textTransform: 'uppercase',
  color: '#a5acb4',
};

const statValueStyle: React.CSSProperties = {
  fontSize: 14,
  color: '#ebf1fa',
  fontVariantNumeric: 'tabular-nums',
};

const buttonRowStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 4,
};

function actionButtonStyle(
  disabled: boolean,
  variant: 'default' | 'destructive',
): React.CSSProperties {
  const destructive = variant === 'destructive';
  return {
    padding: '4px 8px',
    fontSize: 10,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: 0.04,
    background: destructive ? 'rgba(255, 138, 138, 0.08)' : 'rgba(129, 174, 255, 0.12)',
    color: disabled ? '#5a6068' : destructive ? '#ff8a8a' : '#81aeff',
    border: `1px solid ${destructive ? 'rgba(255, 138, 138, 0.2)' : 'rgba(129, 174, 255, 0.2)'}`,
    borderRadius: 6,
    cursor: disabled ? 'not-allowed' : 'pointer',
  };
}

const flagLabelStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  fontSize: 11,
  color: '#ebf1fa',
};

const flagInputStyle: React.CSSProperties = {
  accentColor: '#81aeff',
};

const gridWrapperStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  paddingTop: 4,
  borderTop: '1px solid rgba(165, 172, 180, 0.1)',
};

const cellRowStyle: React.CSSProperties = {
  display: 'grid',
  gap: 4,
  marginBottom: 4,
  gridAutoFlow: 'column',
  gridAutoColumns: 'minmax(0, 1fr)',
};

const cellStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
};

const cellInputStyle: React.CSSProperties = {
  width: '100%',
  padding: '4px 6px',
  fontSize: 10,
  color: '#ebf1fa',
  background: 'rgba(21, 28, 35, 0.6)',
  border: '1px solid rgba(129, 174, 255, 0.12)',
  borderRadius: 4,
  outline: 'none',
};

const alignSelectStyle: React.CSSProperties = {
  padding: '2px 4px',
  fontSize: 9,
  color: '#a5acb4',
  background: 'rgba(21, 28, 35, 0.6)',
  border: '1px solid rgba(129, 174, 255, 0.08)',
  borderRadius: 4,
};
