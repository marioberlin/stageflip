// apps/stageflip-slide/src/components/properties/chart-element-properties.tsx
// Chart-element branch of the properties panel (T-125c).

/**
 * Editors:
 *   - `chartKind` — enum picker (bar / line / area / pie / donut / scatter / combo).
 *   - `legend` + `axes` — boolean toggles.
 *   - `data` — inline `ChartData` series editor when `data` is an object;
 *             read-only bound notice when `data` is a `ds:<id>` reference
 *             (data-source binding UI is T-167).
 *
 * Commit semantics mirror T-125a's `PropField` / T-125b's ZodForm (per
 * handover-phase6-mid-2 §3.3): the series `name` text and comma-separated
 * `values` input buffer locally and commit on blur / Enter only. Discrete
 * controls (kind select, boolean toggles, add / remove buttons) commit on
 * click. Everything routes through `updateDocument`, so T-133 captures one
 * undo entry per commit.
 *
 * Out of scope (deferred): data-source binding flow (T-167), per-series
 * color palette (the AC palette resolver isn't wired into the editor yet;
 * T-125c ships the structural editor only).
 */

'use client';

import { t, useDocument } from '@stageflip/editor-shell';
import type {
  ChartData,
  ChartElement,
  ChartKind,
  DataSourceRef,
  Document,
} from '@stageflip/schema';
import {
  type ChangeEvent,
  type KeyboardEvent,
  type ReactElement,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

const CHART_KINDS: readonly ChartKind[] = [
  'bar',
  'line',
  'area',
  'pie',
  'donut',
  'scatter',
  'combo',
] as const;

export interface ChartElementPropertiesProps {
  slideId: string;
  element: ChartElement;
}

export function ChartElementProperties({
  slideId,
  element,
}: ChartElementPropertiesProps): ReactElement {
  const { updateDocument } = useDocument();
  const locked = element.locked;

  const mutate = useCallback(
    (patch: (el: ChartElement) => ChartElement) => {
      if (locked) return;
      updateDocument((doc) => applyChartPatch(doc, slideId, element.id, patch));
    },
    [updateDocument, slideId, element.id, locked],
  );

  const inlineData = typeof element.data === 'string' ? null : element.data;
  const boundRef = typeof element.data === 'string' ? (element.data as DataSourceRef) : null;

  return (
    <div data-testid="chart-element-properties" style={rootStyle}>
      <Row label={t('properties.chart.kind')} htmlFor="chart-kind-select">
        <select
          id="chart-kind-select"
          data-testid="chart-kind"
          value={element.chartKind}
          disabled={locked}
          onChange={(e) => mutate((el) => ({ ...el, chartKind: e.target.value as ChartKind }))}
          style={selectStyle}
        >
          {CHART_KINDS.map((kind) => (
            <option key={kind} value={kind}>
              {kind}
            </option>
          ))}
        </select>
      </Row>

      <div style={flagRowStyle}>
        <FlagToggle
          label={t('properties.chart.legend')}
          testId="chart-legend"
          checked={element.legend}
          disabled={locked}
          onChange={(v) => mutate((el) => ({ ...el, legend: v }))}
        />
        <FlagToggle
          label={t('properties.chart.axes')}
          testId="chart-axes"
          checked={element.axes}
          disabled={locked}
          onChange={(v) => mutate((el) => ({ ...el, axes: v }))}
        />
      </div>

      {boundRef ? (
        <p data-testid="chart-bound-ref" style={noticeStyle}>
          {t('properties.chart.boundRef').replace('{ref}', boundRef)}
        </p>
      ) : inlineData ? (
        <SeriesEditor
          data={inlineData}
          disabled={locked}
          onCommit={(nextData) => mutate((el) => ({ ...el, data: nextData }))}
        />
      ) : null}
    </div>
  );
}

interface SeriesEditorProps {
  data: ChartData;
  disabled: boolean;
  onCommit: (next: ChartData) => void;
}

function SeriesEditor({ data, disabled, onCommit }: SeriesEditorProps): ReactElement {
  const addSeries = () => {
    const fallbackLen = data.labels.length > 0 ? data.labels.length : 1;
    const firstLen = data.series[0]?.values.length ?? fallbackLen;
    const nextName = `Series ${data.series.length + 1}`;
    const nextValues = Array.from({ length: firstLen }, () => 0);
    onCommit({ ...data, series: [...data.series, { name: nextName, values: nextValues }] });
  };
  const removeSeries = (idx: number) => {
    onCommit({ ...data, series: data.series.filter((_, i) => i !== idx) });
  };
  const commitSeries = (idx: number, next: { name?: string; values?: (number | null)[] }) => {
    onCommit({
      ...data,
      series: data.series.map((s, i) =>
        i === idx
          ? {
              name: next.name ?? s.name,
              values: next.values ?? s.values,
            }
          : s,
      ),
    });
  };

  return (
    <div style={seriesSectionStyle}>
      <div style={seriesHeaderStyle}>
        <span style={sectionLabelStyle}>{t('properties.chart.series')}</span>
        <button
          type="button"
          data-testid="chart-series-add"
          disabled={disabled}
          onClick={addSeries}
          style={addButtonStyle(disabled)}
        >
          {t('properties.chart.addSeries')}
        </button>
      </div>
      {data.series.map((series, idx) => (
        <SeriesRow
          key={`series-${idx}-${series.name}`}
          index={idx}
          series={series}
          disabled={disabled}
          onCommit={(next) => commitSeries(idx, next)}
          onRemove={() => removeSeries(idx)}
        />
      ))}
    </div>
  );
}

function SeriesRow({
  index,
  series,
  disabled,
  onCommit,
  onRemove,
}: {
  index: number;
  series: { name: string; values: (number | null)[] };
  disabled: boolean;
  onCommit: (next: { name?: string; values?: (number | null)[] }) => void;
  onRemove: () => void;
}): ReactElement {
  return (
    <div style={seriesRowStyle} data-testid={`chart-series-${index}`}>
      <div style={seriesFieldsStyle}>
        <BlurCommitText
          testId={`chart-series-${index}-name`}
          initial={series.name}
          disabled={disabled}
          placeholder={t('properties.chart.seriesNamePlaceholder')}
          onCommit={(name) => onCommit({ name })}
        />
        <BlurCommitText
          testId={`chart-series-${index}-values`}
          initial={series.values.map((v) => (v === null ? '' : String(v))).join(', ')}
          disabled={disabled}
          placeholder={t('properties.chart.seriesValuesPlaceholder')}
          onCommit={(raw) => onCommit({ values: parseValues(raw) })}
        />
      </div>
      <button
        type="button"
        data-testid={`chart-series-remove-${index}`}
        disabled={disabled}
        onClick={onRemove}
        style={removeButtonStyle(disabled)}
        aria-label={`Remove ${series.name}`}
      >
        ×
      </button>
    </div>
  );
}

/**
 * Labelled text input that keeps the draft local and only fires onCommit on
 * blur / Enter. Matches the PropField + ZodForm pattern so series edits
 * produce one undo entry per commit, not one per keystroke.
 */
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
  // React 19's batching means `setDraft(initial)` scheduled on Escape does NOT
  // update the closed-over `draft` before the synchronous `blur()` call fires
  // the `commit` handler. The ref flags the revert so commit short-circuits.
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
      style={textInputStyle}
    />
  );
}

function FlagToggle({
  label,
  testId,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  testId: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (next: boolean) => void;
}): ReactElement {
  return (
    <label style={flagLabelStyle}>
      <input
        type="checkbox"
        data-testid={testId}
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        style={flagInputStyle}
      />
      <span>{label}</span>
    </label>
  );
}

function Row({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor?: string;
  children: React.ReactNode;
}): ReactElement {
  return (
    <div style={fieldRowStyle}>
      {htmlFor ? (
        <label htmlFor={htmlFor} style={sectionLabelStyle}>
          {label}
        </label>
      ) : (
        <span style={sectionLabelStyle}>{label}</span>
      )}
      {children}
    </div>
  );
}

// ---- pure helpers ---------------------------------------------------------

function parseValues(raw: string): (number | null)[] {
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .map((s) => {
      const n = Number(s);
      return Number.isFinite(n) ? n : null;
    });
}

function applyChartPatch(
  doc: Document,
  slideId: string,
  elementId: string,
  patch: (el: ChartElement) => ChartElement,
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
                el.id === elementId && el.type === 'chart' ? patch(el as ChartElement) : el,
              ),
            }
          : slide,
      ),
    },
  };
}

export const __test = { applyChartPatch, parseValues };

// ---- styles ---------------------------------------------------------------

const rootStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
};

const fieldRowStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
};

const flagRowStyle: React.CSSProperties = {
  display: 'flex',
  gap: 12,
};

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

const sectionLabelStyle: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 600,
  letterSpacing: 0.08,
  textTransform: 'uppercase',
  color: '#a5acb4',
};

const selectStyle: React.CSSProperties = {
  width: '100%',
  padding: '5px 8px',
  fontSize: 11,
  color: '#ebf1fa',
  background: 'rgba(21, 28, 35, 0.6)',
  border: '1px solid rgba(129, 174, 255, 0.12)',
  borderRadius: 6,
  outline: 'none',
};

const textInputStyle: React.CSSProperties = {
  width: '100%',
  padding: '5px 8px',
  fontSize: 11,
  color: '#ebf1fa',
  background: 'rgba(21, 28, 35, 0.6)',
  border: '1px solid rgba(129, 174, 255, 0.12)',
  borderRadius: 6,
  outline: 'none',
};

const seriesSectionStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  paddingTop: 4,
  borderTop: '1px solid rgba(165, 172, 180, 0.1)',
};

const seriesHeaderStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
};

const seriesRowStyle: React.CSSProperties = {
  display: 'flex',
  gap: 6,
  alignItems: 'center',
};

const seriesFieldsStyle: React.CSSProperties = {
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
};

function addButtonStyle(disabled?: boolean): React.CSSProperties {
  return {
    padding: '3px 8px',
    fontSize: 10,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: 0.04,
    background: 'rgba(129, 174, 255, 0.15)',
    color: disabled ? '#5a6068' : '#81aeff',
    border: '1px solid rgba(129, 174, 255, 0.2)',
    borderRadius: 6,
    cursor: disabled ? 'not-allowed' : 'pointer',
  };
}

function removeButtonStyle(disabled?: boolean): React.CSSProperties {
  return {
    padding: '0 8px',
    fontSize: 14,
    color: disabled ? '#5a6068' : 'rgba(255, 138, 138, 0.8)',
    background: 'transparent',
    border: '1px solid rgba(255, 138, 138, 0.2)',
    borderRadius: 4,
    cursor: disabled ? 'not-allowed' : 'pointer',
  };
}

const noticeStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 11,
  color: '#a5acb4',
  fontStyle: 'italic',
};
