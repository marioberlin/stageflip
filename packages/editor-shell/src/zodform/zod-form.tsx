// packages/editor-shell/src/zodform/zod-form.tsx
// Reflective auto-inspector over a Zod schema (T-125b).

/**
 * Given a ZodObject `schema` and a current `value`, renders one input per
 * field according to its introspected kind, and fires `onChange` whenever a
 * field commits. No clip-specific code — every ClipDefinition carrying a
 * `propsSchema` gets a working inspector for free.
 *
 * Commit semantics (handover-phase6-mid-2.md §3.3)
 * -------------------------------------------------
 * Inputs that fire a change event on every keystroke or tick buffer locally
 * and commit on blur / Enter / pointerup. T-133's undo interceptor records
 * one entry per commit, so dragging a slider or typing a string produces one
 * micro-undo rather than one per tick/keystroke. Discrete controls (boolean,
 * enum, color picker click) commit immediately.
 *
 * Testability
 * -----------
 * Every field exposes a `data-testid="zodform-field-<dot-path>"` so tests
 * drill into nested objects without constructing brittle selectors. The
 * path is `parent.child.grandchild` — identical to the value path the
 * field writes into.
 *
 * Styling
 * -------
 * Inline styles only; matches the existing PropertiesPanel palette. The
 * editor-shell package ships no Tailwind runtime, so inline keeps the
 * rendering consistent whether the host app has Tailwind wired or not.
 */

'use client';

import {
  type CSSProperties,
  type ChangeEvent,
  type KeyboardEvent,
  type ReactElement,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { ZodType } from 'zod';

import { t } from '../i18n/catalog';
import { type DiscriminatedBranch, type FieldSpec, introspectSchema } from './introspect';

export interface ZodFormProps {
  /** ZodObject to introspect. Non-object schemas render a fallback message. */
  schema: ZodType<unknown>;
  /** Current values keyed by field name. */
  value: Record<string, unknown>;
  /** Fires with the shallow-merged object on every commit. */
  onChange: (next: Record<string, unknown>) => void;
  /** Disables every input. */
  disabled?: boolean | undefined;
  /** Optional title rendered above the fields. */
  title?: string;
}

export function ZodForm({ schema, value, onChange, disabled, title }: ZodFormProps): ReactElement {
  const fields = useMemo(() => introspectSchema(schema), [schema]);

  const setField = useCallback(
    (name: string, next: unknown) => {
      onChange({ ...value, [name]: next });
    },
    [value, onChange],
  );

  if (fields.length === 0) {
    return (
      <div data-testid="zodform-empty" style={emptyStyle}>
        {t('zodform.empty')}
      </div>
    );
  }

  return (
    <div style={rootStyle} data-testid="zodform-root">
      {title ? <div style={titleStyle}>{title}</div> : null}
      {fields.map((field) => (
        <FieldControl
          key={field.name}
          field={field}
          path={field.name}
          value={value[field.name]}
          disabled={disabled}
          onCommit={(next) => setField(field.name, next)}
        />
      ))}
    </div>
  );
}

// ---- field dispatch --------------------------------------------------------

interface FieldControlProps {
  field: FieldSpec;
  path: string;
  value: unknown;
  disabled?: boolean | undefined;
  onCommit: (next: unknown) => void;
}

function FieldControl({ field, path, value, disabled, onCommit }: FieldControlProps): ReactElement {
  const labelNode = (
    <Label field={field}>
      <ValueBadge field={field} value={value} />
    </Label>
  );

  switch (field.kind) {
    case 'text':
      return (
        <Row label={labelNode}>
          <TextInput
            testId={`zodform-field-${path}`}
            value={asString(value)}
            disabled={disabled}
            placeholder={field.description}
            onCommit={onCommit}
          />
        </Row>
      );
    case 'color':
      return (
        <Row label={labelNode}>
          <ColorInput
            path={path}
            value={asString(value) || '#000000'}
            disabled={disabled}
            onCommit={onCommit}
          />
        </Row>
      );
    case 'number':
      return (
        <Row label={labelNode}>
          <NumberInput
            testId={`zodform-field-${path}`}
            value={asNumber(value)}
            disabled={disabled}
            min={field.min}
            max={field.max}
            step={field.step}
            onCommit={onCommit}
          />
        </Row>
      );
    case 'slider':
      return (
        <Row label={labelNode}>
          <SliderInput
            testId={`zodform-field-${path}`}
            value={asNumber(value)}
            disabled={disabled}
            min={field.min ?? 0}
            max={field.max ?? 1}
            step={field.step}
            onCommit={onCommit}
          />
        </Row>
      );
    case 'boolean':
      return (
        <Row label={labelNode}>
          <BooleanToggle
            testId={`zodform-field-${path}`}
            value={value === true}
            disabled={disabled}
            onCommit={onCommit}
          />
        </Row>
      );
    case 'enum':
      return (
        <Row label={labelNode}>
          <EnumSelect
            testId={`zodform-field-${path}`}
            value={asString(value)}
            options={field.enumValues ?? []}
            disabled={disabled}
            onCommit={onCommit}
          />
        </Row>
      );
    case 'tag-list':
      return (
        <Row label={labelNode}>
          <TagListInput
            path={path}
            value={asStringArray(value)}
            disabled={disabled}
            onCommit={onCommit}
          />
        </Row>
      );
    case 'number-list':
      return (
        <Row label={labelNode}>
          <NumberListInput
            testId={`zodform-field-${path}`}
            value={asNumberArray(value)}
            disabled={disabled}
            onCommit={onCommit}
          />
        </Row>
      );
    case 'object':
      return (
        <ObjectGroup
          field={field}
          path={path}
          value={value as Record<string, unknown> | undefined}
          disabled={disabled}
          onCommit={onCommit}
        />
      );
    case 'discriminated-union':
      return (
        <DiscriminatedUnionGroup
          field={field}
          path={path}
          value={value as Record<string, unknown> | undefined}
          disabled={disabled}
          onCommit={onCommit}
        />
      );
    default:
      return (
        <Row label={labelNode}>
          <TextInput
            testId={`zodform-field-${path}`}
            value={stringifyUnknown(value)}
            disabled={disabled}
            placeholder={t('zodform.unknownPlaceholder')}
            onCommit={onCommit}
          />
        </Row>
      );
  }
}

// ---- helpers --------------------------------------------------------------

function asString(v: unknown): string {
  return typeof v === 'string' ? v : '';
}
function asNumber(v: unknown): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
}
function asStringArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
}
function asNumberArray(v: unknown): number[] {
  return Array.isArray(v) ? v.filter((x): x is number => typeof x === 'number') : [];
}
function stringifyUnknown(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'string') return v;
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

// ---- object group ---------------------------------------------------------

function ObjectGroup({
  field,
  path,
  value,
  disabled,
  onCommit,
}: {
  field: FieldSpec;
  path: string;
  value: Record<string, unknown> | undefined;
  disabled?: boolean | undefined;
  onCommit: (next: unknown) => void;
}): ReactElement {
  const current = value ?? {};
  return (
    <fieldset style={fieldsetStyle}>
      <GroupLegend field={field} />
      <div style={nestedStyle}>
        {(field.children ?? []).map((child) => (
          <FieldControl
            key={child.name}
            field={child}
            path={`${path}.${child.name}`}
            value={current[child.name]}
            disabled={disabled}
            onCommit={(next) => onCommit({ ...current, [child.name]: next })}
          />
        ))}
      </div>
    </fieldset>
  );
}

// ---- discriminated union --------------------------------------------------

function DiscriminatedUnionGroup({
  field,
  path,
  value,
  disabled,
  onCommit,
}: {
  field: FieldSpec;
  path: string;
  value: Record<string, unknown> | undefined;
  disabled?: boolean | undefined;
  onCommit: (next: unknown) => void;
}): ReactElement {
  const discriminator = field.discriminator ?? 'type';
  const branches = field.branches ?? [];
  const current = value ?? {};
  const currentTag =
    typeof current[discriminator] === 'string'
      ? (current[discriminator] as string)
      : (branches[0]?.tag ?? '');
  const activeBranch: DiscriminatedBranch | undefined =
    branches.find((b) => b.tag === currentTag) ?? branches[0];

  const onTagChange = (next: string) => {
    // Build a minimal shell for the new branch: only the discriminator plus
    // every non-discriminator field with its default (if any). Leaking data
    // from the previous branch would violate the schema on the next parse.
    const shell: Record<string, unknown> = { [discriminator]: next };
    const target = branches.find((b) => b.tag === next);
    for (const f of target?.fields ?? []) {
      if (f.name === discriminator) continue;
      if (f.defaultValue !== undefined) shell[f.name] = f.defaultValue;
    }
    onCommit(shell);
  };

  return (
    <fieldset style={fieldsetStyle}>
      <GroupLegend field={field} />
      <div style={{ marginBottom: 6 }}>
        <select
          data-testid={`zodform-field-${path}-${discriminator}`}
          value={currentTag}
          disabled={disabled}
          onChange={(e) => onTagChange(e.target.value)}
          style={selectStyle}
        >
          {branches.map((b) => (
            <option key={b.tag} value={b.tag}>
              {b.tag}
            </option>
          ))}
        </select>
      </div>
      <div style={nestedStyle}>
        {(activeBranch?.fields ?? [])
          .filter((f) => f.name !== discriminator)
          .map((child) => (
            <FieldControl
              key={child.name}
              field={child}
              path={`${path}.${child.name}`}
              value={current[child.name]}
              disabled={disabled}
              onCommit={(next) => onCommit({ ...current, [child.name]: next })}
            />
          ))}
      </div>
    </fieldset>
  );
}

// ---- primitives -----------------------------------------------------------

function TextInput({
  testId,
  value,
  disabled,
  placeholder,
  onCommit,
}: {
  testId: string;
  value: string;
  disabled?: boolean | undefined;
  placeholder?: string | undefined;
  onCommit: (next: string) => void;
}): ReactElement {
  const [draft, setDraft] = useState(value);
  const reverting = useRef(false);
  useEffect(() => {
    setDraft(value);
  }, [value]);

  const commit = () => {
    if (reverting.current) {
      reverting.current = false;
      return;
    }
    if (draft !== value) onCommit(draft);
  };
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      commit();
      e.currentTarget.blur();
    } else if (e.key === 'Escape') {
      reverting.current = true;
      setDraft(value);
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
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={onKeyDown}
      style={textInputStyle}
    />
  );
}

function NumberInput({
  testId,
  value,
  disabled,
  min,
  max,
  step,
  onCommit,
}: {
  testId: string;
  value: number | undefined;
  disabled?: boolean | undefined;
  min?: number | undefined;
  max?: number | undefined;
  step?: number | undefined;
  onCommit: (next: number) => void;
}): ReactElement {
  const [draft, setDraft] = useState(value === undefined ? '' : String(value));
  const reverting = useRef(false);
  useEffect(() => {
    setDraft(value === undefined ? '' : String(value));
  }, [value]);

  const commit = () => {
    if (reverting.current) {
      reverting.current = false;
      return;
    }
    const parsed = Number(draft);
    if (!Number.isFinite(parsed)) {
      setDraft(value === undefined ? '' : String(value));
      return;
    }
    if (parsed !== value) onCommit(parsed);
  };
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      commit();
      e.currentTarget.blur();
    } else if (e.key === 'Escape') {
      reverting.current = true;
      setDraft(value === undefined ? '' : String(value));
      e.currentTarget.blur();
    }
  };
  return (
    <input
      type="number"
      data-testid={testId}
      value={draft}
      disabled={disabled}
      min={min}
      max={max}
      step={step ?? 'any'}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={onKeyDown}
      style={numberInputStyle}
    />
  );
}

function SliderInput({
  testId,
  value,
  disabled,
  min,
  max,
  step,
  onCommit,
}: {
  testId: string;
  value: number | undefined;
  disabled?: boolean | undefined;
  min: number;
  max: number;
  step?: number | undefined;
  onCommit: (next: number) => void;
}): ReactElement {
  const [draft, setDraft] = useState(value ?? min);
  useEffect(() => {
    setDraft(value ?? min);
  }, [value, min]);

  const commit = () => {
    if (draft !== value) onCommit(draft);
  };
  const defaultStep = step ?? (max - min > 100 ? 1 : 0.01);
  return (
    <input
      type="range"
      data-testid={testId}
      value={draft}
      disabled={disabled}
      min={min}
      max={max}
      step={defaultStep}
      onChange={(e) => setDraft(Number(e.target.value))}
      onPointerUp={commit}
      onMouseUp={commit}
      onTouchEnd={commit}
      onKeyUp={commit}
      style={sliderInputStyle}
    />
  );
}

function BooleanToggle({
  testId,
  value,
  disabled,
  onCommit,
}: {
  testId: string;
  value: boolean;
  disabled?: boolean | undefined;
  onCommit: (next: boolean) => void;
}): ReactElement {
  return (
    <button
      type="button"
      data-testid={testId}
      disabled={disabled}
      aria-pressed={value}
      onClick={() => onCommit(!value)}
      style={booleanToggleStyle(value, disabled)}
    >
      <span style={booleanThumbStyle(value)} />
    </button>
  );
}

function EnumSelect({
  testId,
  value,
  options,
  disabled,
  onCommit,
}: {
  testId: string;
  value: string;
  options: string[];
  disabled?: boolean | undefined;
  onCommit: (next: string) => void;
}): ReactElement {
  return (
    <select
      data-testid={testId}
      value={value || options[0] || ''}
      disabled={disabled}
      onChange={(e) => onCommit(e.target.value)}
      style={selectStyle}
    >
      {options.map((opt) => (
        <option key={opt} value={opt}>
          {opt}
        </option>
      ))}
    </select>
  );
}

function ColorInput({
  path,
  value,
  disabled,
  onCommit,
}: {
  path: string;
  value: string;
  disabled?: boolean | undefined;
  onCommit: (next: string) => void;
}): ReactElement {
  const [draft, setDraft] = useState(value);
  const reverting = useRef(false);
  useEffect(() => {
    setDraft(value);
  }, [value]);
  const commitDraft = () => {
    if (reverting.current) {
      reverting.current = false;
      return;
    }
    if (draft !== value) onCommit(draft);
  };
  const safePicker = /^#[0-9a-fA-F]{6}$/.test(draft) ? draft : '#000000';
  // The native `<input type="color">` fires `onChange` continuously as the
  // user drags inside the OS color picker (every browser does this). Commit
  // on every tick would flood T-133's undo stack — one entry per pixel. We
  // mirror the slider pattern: buffer into `draft` on every tick, commit
  // once on blur when the picker closes.
  return (
    <div style={colorRowStyle}>
      <input
        type="color"
        data-testid={`zodform-field-${path}-picker`}
        value={safePicker}
        disabled={disabled}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commitDraft}
        aria-label={t('zodform.colorPickerLabel')}
        style={colorPickerStyle}
      />
      <input
        type="text"
        data-testid={`zodform-field-${path}-hex`}
        value={draft}
        disabled={disabled}
        placeholder="#rrggbb"
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commitDraft}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            commitDraft();
            e.currentTarget.blur();
          } else if (e.key === 'Escape') {
            reverting.current = true;
            setDraft(value);
            e.currentTarget.blur();
          }
        }}
        style={colorTextStyle}
      />
    </div>
  );
}

function TagListInput({
  path,
  value,
  disabled,
  onCommit,
}: {
  path: string;
  value: string[];
  disabled?: boolean | undefined;
  onCommit: (next: string[]) => void;
}): ReactElement {
  const [draft, setDraft] = useState('');
  const commitDraft = () => {
    const trimmed = draft.trim();
    if (!trimmed) return;
    onCommit([...value, trimmed]);
    setDraft('');
  };
  return (
    <div>
      <div style={tagRowStyle}>
        {value.map((tag, i) => {
          // biome-ignore lint/suspicious/noArrayIndexKey: tag values may repeat, so index is required for a unique key. The chip is removal-only — no state mid-edit to confuse if positions shift.
          const key = `${tag}-${i}`;
          return (
            <span key={key} style={tagChipStyle}>
              {tag}
              <button
                type="button"
                data-testid={`zodform-field-${path}-remove-${i}`}
                disabled={disabled}
                onClick={() => onCommit(value.filter((_, idx) => idx !== i))}
                style={tagRemoveStyle}
                aria-label={`Remove ${tag}`}
              >
                ×
              </button>
            </span>
          );
        })}
      </div>
      <input
        type="text"
        data-testid={`zodform-field-${path}-input`}
        value={draft}
        disabled={disabled}
        placeholder={t('zodform.tagPlaceholder')}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commitDraft}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            commitDraft();
          }
        }}
        style={textInputStyle}
      />
    </div>
  );
}

function NumberListInput({
  testId,
  value,
  disabled,
  onCommit,
}: {
  testId: string;
  value: number[];
  disabled?: boolean | undefined;
  onCommit: (next: number[]) => void;
}): ReactElement {
  const [draft, setDraft] = useState(value.join(', '));
  useEffect(() => setDraft(value.join(', ')), [value]);
  const commit = () => {
    const parsed = draft
      .split(',')
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isFinite(n));
    // Avoid re-emitting when the blurred draft already matches `value`.
    if (parsed.length === value.length && parsed.every((n, i) => n === value[i])) return;
    onCommit(parsed);
  };
  return (
    <input
      type="text"
      data-testid={testId}
      value={draft}
      disabled={disabled}
      placeholder={t('zodform.numberListPlaceholder')}
      onChange={(e: ChangeEvent<HTMLInputElement>) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur();
      }}
      style={textInputStyle}
    />
  );
}

// ---- labels + shared chrome -----------------------------------------------

function Row({
  label,
  children,
}: {
  label: ReactNode;
  children: ReactNode;
}): ReactElement {
  return (
    <div style={rowStyle}>
      {label}
      {children}
    </div>
  );
}

function Label({ field, children }: { field: FieldSpec; children: ReactNode }): ReactElement {
  // A plain <div>, not <label>, because the control identity isn't knowable
  // at this level (some fields render multiple inputs — color, tag-list —
  // and the composite controls use aria-label/aria-pressed instead).
  return (
    <div style={labelRowStyle}>
      <span style={labelTextStyle}>
        {field.label}
        {field.optional ? <span style={optionalMarkStyle}> ({t('zodform.optional')})</span> : null}
      </span>
      {children}
    </div>
  );
}

/**
 * Structural `<legend>` for `<fieldset>`-wrapped groups (object + discriminated
 * union). HTML + WCAG 1.3.1 both require a `<fieldset>` to carry a `<legend>`;
 * a `<div>` inside a `<fieldset>` is invalid and screen readers won't announce
 * the group on focus.
 */
function GroupLegend({ field }: { field: FieldSpec }): ReactElement {
  return (
    <legend style={legendStyle}>
      <span style={labelTextStyle}>{field.label}</span>
      {field.optional ? <span style={optionalMarkStyle}> ({t('zodform.optional')})</span> : null}
    </legend>
  );
}

function ValueBadge({ field, value }: { field: FieldSpec; value: unknown }): ReactNode {
  if ((field.kind === 'number' || field.kind === 'slider') && typeof value === 'number') {
    return <span style={valueBadgeStyle}>{roundBadge(value)}</span>;
  }
  return null;
}

function roundBadge(n: number): string {
  if (!Number.isFinite(n)) return '—';
  if (Math.abs(n) < 1 && n !== 0) return n.toFixed(2);
  return String(Math.round(n));
}

// ---- styles ---------------------------------------------------------------

const rootStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
};

const titleStyle: CSSProperties = {
  fontSize: 10,
  letterSpacing: 0.14,
  textTransform: 'uppercase',
  color: '#a5acb4',
  fontWeight: 700,
};

const emptyStyle: CSSProperties = {
  fontSize: 11,
  color: '#5a6068',
  fontStyle: 'italic',
};

const rowStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
};

const labelRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'baseline',
  justifyContent: 'space-between',
  gap: 8,
};

const labelTextStyle: CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: '#ebf1fa',
};

const optionalMarkStyle: CSSProperties = {
  fontWeight: 400,
  color: '#a5acb4',
};

const valueBadgeStyle: CSSProperties = {
  fontSize: 10,
  color: '#5af8fb',
  fontVariantNumeric: 'tabular-nums',
};

const textInputStyle: CSSProperties = {
  width: '100%',
  padding: '5px 8px',
  fontSize: 11,
  color: '#ebf1fa',
  background: 'rgba(21, 28, 35, 0.6)',
  border: '1px solid rgba(129, 174, 255, 0.12)',
  borderRadius: 6,
  outline: 'none',
};

const numberInputStyle: CSSProperties = {
  ...textInputStyle,
  fontVariantNumeric: 'tabular-nums',
};

const sliderInputStyle: CSSProperties = {
  width: '100%',
  accentColor: '#81aeff',
};

const selectStyle: CSSProperties = {
  ...textInputStyle,
};

const fieldsetStyle: CSSProperties = {
  border: 'none',
  margin: 0,
  padding: '6px 0 0 0',
  borderTop: '1px solid rgba(165, 172, 180, 0.1)',
};

const legendStyle: CSSProperties = {
  padding: 0,
  marginBottom: 6,
};

const nestedStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  paddingLeft: 6,
};

const colorRowStyle: CSSProperties = {
  display: 'flex',
  gap: 6,
  alignItems: 'center',
};

const colorPickerStyle: CSSProperties = {
  height: 28,
  width: 32,
  border: 0,
  background: 'transparent',
  cursor: 'pointer',
};

const colorTextStyle: CSSProperties = {
  ...textInputStyle,
  flex: 1,
  fontFamily: 'monospace',
};

const tagRowStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 4,
  marginBottom: 4,
};

const tagChipStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  padding: '2px 6px',
  fontSize: 10,
  color: '#5af8fb',
  background: 'rgba(90, 248, 251, 0.15)',
  borderRadius: 4,
};

const tagRemoveStyle: CSSProperties = {
  color: 'rgba(90, 248, 251, 0.7)',
  background: 'transparent',
  border: 0,
  cursor: 'pointer',
  fontSize: 12,
  padding: 0,
};

function booleanToggleStyle(on: boolean, disabled?: boolean): CSSProperties {
  return {
    position: 'relative',
    display: 'inline-flex',
    alignItems: 'center',
    height: 18,
    width: 32,
    borderRadius: 999,
    border: 0,
    background: on ? '#5af8fb' : 'rgba(21, 28, 35, 0.8)',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
  };
}

function booleanThumbStyle(on: boolean): CSSProperties {
  return {
    display: 'inline-block',
    height: 12,
    width: 12,
    borderRadius: 999,
    background: '#ebf1fa',
    transform: on ? 'translateX(16px)' : 'translateX(4px)',
    transition: 'transform 120ms',
  };
}
