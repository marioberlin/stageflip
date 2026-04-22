// apps/stageflip-slide/src/components/properties/prop-field.tsx
// Shared labelled number input for the properties panel.

/**
 * Emits the parsed number on each blur + Enter, never on every keystroke —
 * a partially-typed value like `-` or `1.` passes through the intermediate
 * state as-is and only commits when the user finishes. This avoids document
 * churn during typing and plays well with the T-133 undo/redo interceptor
 * (one edit per commit rather than one per character).
 *
 * Non-numeric input snaps back to the prop's current value on blur. `min` /
 * `max` clamp at commit time so typing a larger intermediate is fine.
 */

'use client';

import { type ChangeEvent, type KeyboardEvent, useEffect, useRef, useState } from 'react';

export interface PropFieldProps {
  label: string;
  value: number;
  onCommit: (next: number) => void;
  suffix?: string;
  min?: number;
  max?: number;
  step?: number;
  /** Stable id so tests + a11y can target the input. */
  testId?: string;
  disabled?: boolean;
}

export function PropField({
  label,
  value,
  onCommit,
  suffix,
  min,
  max,
  step,
  testId,
  disabled,
}: PropFieldProps): React.ReactElement {
  const [draft, setDraft] = useState<string>(formatValue(value));
  const isFocused = useRef(false);

  // Only sync the draft from the prop when the field is not focused — a
  // re-render during typing would otherwise clobber the user's
  // in-progress entry.
  useEffect(() => {
    if (!isFocused.current) setDraft(formatValue(value));
  }, [value]);

  const handleChange = (event: ChangeEvent<HTMLInputElement>): void => {
    setDraft(event.target.value);
  };

  const commit = (): void => {
    const parsed = Number.parseFloat(draft);
    if (!Number.isFinite(parsed)) {
      setDraft(formatValue(value));
      return;
    }
    const clamped = clamp(parsed, min, max);
    if (clamped !== value) onCommit(clamped);
    setDraft(formatValue(clamped));
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === 'Enter') {
      event.currentTarget.blur();
    } else if (event.key === 'Escape') {
      setDraft(formatValue(value));
      event.currentTarget.blur();
    }
  };

  return (
    <label style={wrapStyle}>
      <span style={labelStyle}>{label}</span>
      <input
        type="text"
        inputMode="numeric"
        data-testid={testId}
        value={draft}
        onChange={handleChange}
        onFocus={() => {
          isFocused.current = true;
        }}
        onBlur={() => {
          isFocused.current = false;
          commit();
        }}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        {...(step !== undefined && { step })}
        style={inputStyle}
      />
      {suffix ? <span style={suffixStyle}>{suffix}</span> : null}
    </label>
  );
}

function formatValue(value: number): string {
  if (!Number.isFinite(value)) return '0';
  return Number.isInteger(value) ? value.toString() : value.toFixed(2);
}

function clamp(value: number, min: number | undefined, max: number | undefined): number {
  let next = value;
  if (min !== undefined && next < min) next = min;
  if (max !== undefined && next > max) next = max;
  return next;
}

const wrapStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  padding: '4px 8px',
  background: 'rgba(21, 28, 35, 0.6)',
  borderRadius: 6,
  fontSize: 12,
};

const labelStyle: React.CSSProperties = {
  color: '#a5acb4',
  fontSize: 10,
  fontWeight: 600,
  letterSpacing: 0.04,
  textTransform: 'uppercase',
  minWidth: 16,
};

const inputStyle: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
  background: 'transparent',
  border: 'none',
  color: '#ebf1fa',
  fontFamily: 'inherit',
  fontSize: 12,
  outline: 'none',
  textAlign: 'right',
};

const suffixStyle: React.CSSProperties = {
  color: '#5a6068',
  fontSize: 10,
  textTransform: 'uppercase',
};
