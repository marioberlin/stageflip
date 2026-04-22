// apps/stageflip-slide/src/components/properties/selected-element-properties.tsx
// Element-selected branch of the properties panel.

/**
 * Scope (T-125a):
 *   - Position & Size (x, y, width, height) — PropField inputs.
 *   - Rotation — PropField.
 *   - Opacity — range slider + %-readout.
 *   - Visible + Locked — toggles.
 *   - Z-order — four buttons (Front / Forward / Back / Bottom).
 *   - Delete — removes the element from its slide.
 *
 * Deferred:
 *   - Typography, color, animation picker, chart/table editors, ZodForm for
 *     clip-element props. These render as inline "available in T-125b/c"
 *     placeholders so the surface communicates intent without shipping the
 *     actual editors.
 *
 * Every mutation goes through `updateDocument` from `useDocument`, which
 * T-133 now intercepts to emit undo patches. We do NOT push to
 * `pushUndoEntry` directly — the interceptor handles it.
 *
 * When the element is locked, every mutating control is disabled and the
 * delete button is gated too. The lock toggle itself is always enabled so
 * users can unlock.
 */

'use client';

import { t, useDocument } from '@stageflip/editor-shell';
import type { Document, Element } from '@stageflip/schema';
import { type ReactElement, useCallback, useEffect, useState } from 'react';
import { PropField } from './prop-field';

export interface SelectedElementPropertiesProps {
  slideId: string;
  element: Element;
}

export function SelectedElementProperties({
  slideId,
  element,
}: SelectedElementPropertiesProps): ReactElement {
  const { updateDocument, selectElements } = useDocument();
  const locked = element.locked;

  const mutateTransform = useCallback(
    (patch: Partial<Element['transform']>) => {
      if (locked) return;
      updateDocument((doc) =>
        applyElementPatch(doc, slideId, element.id, (el) => ({
          ...el,
          transform: { ...el.transform, ...patch },
        })),
      );
    },
    [updateDocument, slideId, element.id, locked],
  );

  const mutateFlag = useCallback(
    (patch: Partial<Pick<Element, 'visible' | 'locked'>>) => {
      updateDocument((doc) =>
        applyElementPatch(doc, slideId, element.id, (el) => ({
          ...el,
          ...patch,
        })),
      );
    },
    [updateDocument, slideId, element.id],
  );

  const handleDelete = useCallback(() => {
    if (locked) return;
    updateDocument((doc) => removeElement(doc, slideId, element.id));
    selectElements(new Set());
  }, [updateDocument, slideId, element.id, locked, selectElements]);

  const reorder = useCallback(
    (direction: 'front' | 'forward' | 'back' | 'bottom') => {
      if (locked) return;
      updateDocument((doc) => reorderElement(doc, slideId, element.id, direction));
    },
    [updateDocument, slideId, element.id, locked],
  );

  const { transform } = element;

  return (
    <div data-testid="selected-element-properties" style={rootStyle}>
      <Section label={t('properties.positionSize')}>
        <div style={gridTwoStyle}>
          <PropField
            label="X"
            value={Math.round(transform.x)}
            suffix="px"
            disabled={locked}
            testId="prop-x"
            onCommit={(v) => mutateTransform({ x: v })}
          />
          <PropField
            label="Y"
            value={Math.round(transform.y)}
            suffix="px"
            disabled={locked}
            testId="prop-y"
            onCommit={(v) => mutateTransform({ y: v })}
          />
          <PropField
            label="W"
            value={Math.round(transform.width)}
            suffix="px"
            min={1}
            disabled={locked}
            testId="prop-w"
            onCommit={(v) => mutateTransform({ width: v })}
          />
          <PropField
            label="H"
            value={Math.round(transform.height)}
            suffix="px"
            min={1}
            disabled={locked}
            testId="prop-h"
            onCommit={(v) => mutateTransform({ height: v })}
          />
        </div>
        <div style={{ marginTop: 8 }}>
          <PropField
            label="Rot"
            value={Math.round(transform.rotation)}
            suffix="deg"
            disabled={locked}
            testId="prop-rotation"
            onCommit={(v) => mutateTransform({ rotation: v })}
          />
        </div>
      </Section>

      <Section label={t('properties.opacity')}>
        <OpacitySlider
          value={transform.opacity}
          disabled={locked}
          onCommit={(opacity) => mutateTransform({ opacity })}
        />
      </Section>

      <Section label={t('properties.actions')}>
        <div style={gridTwoStyle}>
          <Toggle
            label={t('properties.visible')}
            checked={element.visible}
            testId="prop-visible"
            onChange={(checked) => mutateFlag({ visible: checked })}
          />
          <Toggle
            label={t('properties.locked')}
            checked={element.locked}
            testId="prop-locked"
            onChange={(checked) => mutateFlag({ locked: checked })}
          />
        </div>
      </Section>

      <Section label={t('properties.layerOrder')}>
        <div style={gridFourStyle}>
          <OrderButton testId="prop-order-front" onClick={() => reorder('front')} disabled={locked}>
            {t('properties.layer.front')}
          </OrderButton>
          <OrderButton
            testId="prop-order-forward"
            onClick={() => reorder('forward')}
            disabled={locked}
          >
            {t('properties.layer.fwd')}
          </OrderButton>
          <OrderButton testId="prop-order-back" onClick={() => reorder('back')} disabled={locked}>
            {t('properties.layer.back')}
          </OrderButton>
          <OrderButton
            testId="prop-order-bottom"
            onClick={() => reorder('bottom')}
            disabled={locked}
          >
            {t('properties.layer.bottom')}
          </OrderButton>
        </div>
      </Section>

      <Section label={t('properties.typeEditors')}>
        <p data-testid="prop-type-placeholder" style={placeholderStyle}>
          {t('properties.typeEditorsStub')}
        </p>
      </Section>

      <button
        type="button"
        data-testid="prop-delete"
        disabled={locked}
        onClick={handleDelete}
        style={deleteButtonStyle(locked)}
      >
        {t('properties.delete')}
      </button>
    </div>
  );
}

function Section({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}): ReactElement {
  return (
    <section style={sectionStyle}>
      <h4 style={sectionLabelStyle}>{label}</h4>
      {children}
    </section>
  );
}

/**
 * Range-input wrapper that commits the opacity only on pointer/mouse
 * release or final keyboard change. While the user drags, the slider
 * previews in local state but does not touch the document atom — so
 * T-133 records one undo entry per drag, not ~100.
 */
function OpacitySlider({
  value,
  disabled,
  onCommit,
}: {
  value: number;
  disabled: boolean;
  onCommit: (next: number) => void;
}): ReactElement {
  const [draft, setDraft] = useState(value);
  useEffect(() => {
    setDraft(value);
  }, [value]);
  const commit = useCallback(() => {
    if (draft !== value) onCommit(draft);
  }, [draft, value, onCommit]);
  return (
    <div style={opacityRowStyle}>
      <input
        type="range"
        min={0}
        max={100}
        value={Math.round(draft * 100)}
        disabled={disabled}
        data-testid="prop-opacity"
        aria-label={t('properties.opacity')}
        onChange={(e) => setDraft(Number(e.target.value) / 100)}
        onPointerUp={commit}
        onMouseUp={commit}
        onTouchEnd={commit}
        onKeyUp={commit}
        style={opacityInputStyle}
      />
      <span style={opacityReadoutStyle}>{Math.round(draft * 100)}%</span>
    </div>
  );
}

function Toggle({
  label,
  checked,
  onChange,
  testId,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  testId?: string;
}): ReactElement {
  return (
    <label style={toggleRowStyle}>
      <input
        type="checkbox"
        data-testid={testId}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        style={checkboxStyle}
      />
      <span style={toggleLabelStyle}>{label}</span>
    </label>
  );
}

function OrderButton({
  children,
  onClick,
  testId,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  testId: string;
  disabled?: boolean;
}): ReactElement {
  return (
    <button
      type="button"
      data-testid={testId}
      onClick={onClick}
      disabled={disabled}
      style={orderButtonStyle(disabled)}
    >
      {children}
    </button>
  );
}

// ---- pure mutations -------------------------------------------------------
// Pulled out so tests can exercise the transform independently of React.

function applyElementPatch(
  doc: Document,
  slideId: string,
  elementId: string,
  patch: (el: Element) => Element,
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
              elements: slide.elements.map((el) => (el.id === elementId ? patch(el) : el)),
            }
          : slide,
      ),
    },
  };
}

function removeElement(doc: Document, slideId: string, elementId: string): Document {
  if (doc.content.mode !== 'slide') return doc;
  return {
    ...doc,
    content: {
      ...doc.content,
      slides: doc.content.slides.map((slide) =>
        slide.id === slideId
          ? { ...slide, elements: slide.elements.filter((el) => el.id !== elementId) }
          : slide,
      ),
    },
  };
}

function reorderElement(
  doc: Document,
  slideId: string,
  elementId: string,
  direction: 'front' | 'forward' | 'back' | 'bottom',
): Document {
  if (doc.content.mode !== 'slide') return doc;
  return {
    ...doc,
    content: {
      ...doc.content,
      slides: doc.content.slides.map((slide) => {
        if (slide.id !== slideId) return slide;
        const idx = slide.elements.findIndex((el) => el.id === elementId);
        if (idx < 0) return slide;
        const next = [...slide.elements];
        const [moved] = next.splice(idx, 1);
        if (!moved) return slide;
        const lastIndex = next.length;
        switch (direction) {
          case 'front':
            next.push(moved);
            break;
          case 'forward':
            next.splice(Math.min(idx + 1, lastIndex), 0, moved);
            break;
          case 'back':
            next.splice(Math.max(idx - 1, 0), 0, moved);
            break;
          case 'bottom':
            next.unshift(moved);
            break;
        }
        return { ...slide, elements: next };
      }),
    },
  };
}

export const __test = {
  applyElementPatch,
  removeElement,
  reorderElement,
};

// ---- styles ---------------------------------------------------------------

const rootStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 18,
  padding: '16px 14px',
  overflowY: 'auto',
};

const sectionStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
};

const sectionLabelStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 10,
  letterSpacing: 0.14,
  textTransform: 'uppercase',
  color: '#a5acb4',
  fontWeight: 700,
};

const gridTwoStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 6,
};

const gridFourStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(4, 1fr)',
  gap: 4,
};

const opacityRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
};

const opacityInputStyle: React.CSSProperties = {
  flex: 1,
  accentColor: '#81aeff',
};

const opacityReadoutStyle: React.CSSProperties = {
  width: 36,
  textAlign: 'right',
  fontSize: 11,
  color: '#ebf1fa',
  fontFamily: 'monospace',
};

const toggleRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  padding: '4px 8px',
  background: 'rgba(21, 28, 35, 0.6)',
  borderRadius: 6,
  cursor: 'pointer',
};

const checkboxStyle: React.CSSProperties = {
  accentColor: '#81aeff',
};

const toggleLabelStyle: React.CSSProperties = {
  fontSize: 11,
  color: '#ebf1fa',
};

function orderButtonStyle(disabled?: boolean): React.CSSProperties {
  return {
    padding: '6px 4px',
    fontSize: 10,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: 0.04,
    background: 'rgba(21, 28, 35, 0.6)',
    color: disabled ? '#5a6068' : '#a5acb4',
    border: '1px solid rgba(129, 174, 255, 0.12)',
    borderRadius: 6,
    cursor: disabled ? 'not-allowed' : 'pointer',
  };
}

const placeholderStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 11,
  color: '#5a6068',
  fontStyle: 'italic',
};

function deleteButtonStyle(disabled?: boolean): React.CSSProperties {
  return {
    padding: '8px 12px',
    fontSize: 12,
    fontWeight: 600,
    color: disabled ? '#5a6068' : '#ff8a8a',
    background: 'rgba(255, 138, 138, 0.08)',
    border: '1px solid rgba(255, 138, 138, 0.2)',
    borderRadius: 6,
    cursor: disabled ? 'not-allowed' : 'pointer',
    marginTop: 8,
  };
}
