// apps/stageflip-slide/src/components/properties/animation-picker.tsx
// Animation preset gallery + active-animation list (T-125c).

/**
 * Purpose
 * -------
 * A uniform add / remove surface over any element's `animations: Animation[]`.
 * Preset buttons append a new `Animation` with sensible defaults for each of
 * the 7 `AnimationKind` discriminated-union branches (fade / slide / scale /
 * rotate / color / keyframed / runtime). Editing individual animation params
 * is out of scope for T-125c — the TimelinePanel (T-126) covers timing-edge
 * dragging, and fine-grained animation-kind params are a natural T-125d / ZodForm
 * follow-up once the scope balloons (per the plan row's "L-split" clause).
 *
 * Commit semantics: every action is a discrete click commit through
 * `updateDocument`. T-133 records one undo entry per add / remove. The
 * existing animation-row entries are read-only labels + a remove button.
 *
 * Scope boundary
 * --------------
 * Keyframed + runtime branches are declared but rendered as "advanced — edit
 * via JSON" rows. Exposing their params via a form would require ZodForm
 * (T-125b) to walk their schemas; intentional coupling avoidance here keeps
 * T-125c independent of T-125b's merge order.
 */

'use client';

import { t, useDocument } from '@stageflip/editor-shell';
import {
  type Animation,
  type AnimationKind,
  type Document,
  type Element,
  animationSchema,
} from '@stageflip/schema';
import { type ReactElement, useCallback } from 'react';

// The seven `kind` literals on AnimationKind. Duplicated here so the picker
// renders a deterministic order instead of relying on `animationKindSchema`
// walk order (which is Zod-internal).
export const EDITOR_KINDS = [
  'fade',
  'slide',
  'scale',
  'rotate',
  'color',
  'keyframed',
  'runtime',
] as const;
type EditorKind = (typeof EDITOR_KINDS)[number];

export interface AnimationPickerProps {
  slideId: string;
  element: Element;
}

export function AnimationPicker({ slideId, element }: AnimationPickerProps): ReactElement {
  const { updateDocument } = useDocument();
  const locked = element.locked;

  const mutate = useCallback(
    (patch: (animations: Animation[]) => Animation[]) => {
      if (locked) return;
      updateDocument((doc) => applyAnimationsPatch(doc, slideId, element.id, patch));
    },
    [updateDocument, slideId, element.id, locked],
  );

  const addKind = (kind: EditorKind) => {
    mutate((animations) => [...animations, buildPresetAnimation(kind)]);
  };
  const removeId = (id: string) => {
    mutate((animations) => animations.filter((a) => a.id !== id));
  };

  return (
    <div data-testid="animation-picker" style={rootStyle}>
      <div style={presetRowStyle}>
        {EDITOR_KINDS.map((kind) => (
          <button
            key={kind}
            type="button"
            data-testid={`animation-preset-${kind}`}
            disabled={locked}
            onClick={() => addKind(kind)}
            style={presetButtonStyle(locked)}
          >
            {t(`properties.animation.kind.${kind}`)}
          </button>
        ))}
      </div>

      {element.animations.length === 0 ? (
        <p data-testid="animation-empty" style={emptyStyle}>
          {t('properties.animation.none')}
        </p>
      ) : (
        <ul style={listStyle}>
          {element.animations.map((anim) => (
            <li key={anim.id} data-testid={`animation-row-${anim.id}`} style={rowStyle}>
              <span style={rowLabelStyle}>
                {t(`properties.animation.kind.${anim.animation.kind}`)}
              </span>
              <button
                type="button"
                data-testid={`animation-remove-${anim.id}`}
                disabled={locked}
                onClick={() => removeId(anim.id)}
                style={removeButtonStyle(locked)}
              >
                {t('properties.animation.remove')}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ---- pure helpers ---------------------------------------------------------

/**
 * Mint a URL-safe id for a newly-added animation. Uses `crypto.randomUUID()`
 * which is available in browsers + Node 19+. Editor code (not clip / runtime
 * code) is outside the determinism scope, so this is fine.
 */
function mintAnimationId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Node test fallback — the happy-dom env exposes crypto.randomUUID on
  // modern Node, but guard against environments that don't for safety.
  return `anim-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function buildPresetAnimation(kind: EditorKind): Animation {
  const base = {
    id: mintAnimationId(),
    timing: { kind: 'absolute' as const, startFrame: 0, durationFrames: 30 },
    autoplay: true,
  };
  return { ...base, animation: buildPresetKind(kind) } as Animation;
}

function buildPresetKind(kind: EditorKind): AnimationKind {
  switch (kind) {
    case 'fade':
      return { kind: 'fade', from: 0, to: 1, easing: 'ease-out' };
    case 'slide':
      return { kind: 'slide', direction: 'up', distance: 100, easing: 'ease-out' };
    case 'scale':
      // `from` is `z.number().positive()`, so 0 is rejected — start at a
      // small-but-visible value instead.
      return { kind: 'scale', from: 0.1, to: 1, easing: 'ease-out' };
    case 'rotate':
      return { kind: 'rotate', fromDegrees: 0, toDegrees: 360, easing: 'ease-in-out' };
    case 'color':
      return {
        kind: 'color',
        property: 'color',
        from: '#000000',
        to: '#ffffff',
        easing: 'linear',
      };
    case 'keyframed':
      return {
        kind: 'keyframed',
        property: 'opacity',
        keyframes: [
          { at: 0, value: 0 },
          { at: 1, value: 1 },
        ],
      };
    case 'runtime':
      return { kind: 'runtime', runtime: 'css', name: 'preset', params: {} };
  }
}

function applyAnimationsPatch(
  doc: Document,
  slideId: string,
  elementId: string,
  patch: (animations: Animation[]) => Animation[],
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
                el.id === elementId ? ({ ...el, animations: patch(el.animations) } as Element) : el,
              ),
            }
          : slide,
      ),
    },
  };
}

export const __test = {
  EDITOR_KINDS,
  buildPresetAnimation,
  buildPresetKind,
  applyAnimationsPatch,
  animationSchema,
};

// ---- styles ---------------------------------------------------------------

const rootStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
};

const presetRowStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(4, 1fr)',
  gap: 4,
};

function presetButtonStyle(disabled: boolean): React.CSSProperties {
  return {
    padding: '4px 6px',
    fontSize: 10,
    fontWeight: 600,
    color: disabled ? '#5a6068' : '#81aeff',
    background: 'rgba(129, 174, 255, 0.12)',
    border: '1px solid rgba(129, 174, 255, 0.2)',
    borderRadius: 6,
    cursor: disabled ? 'not-allowed' : 'pointer',
  };
}

const emptyStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 11,
  color: '#5a6068',
  fontStyle: 'italic',
};

const listStyle: React.CSSProperties = {
  listStyle: 'none',
  margin: 0,
  padding: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
};

const rowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '4px 6px',
  background: 'rgba(21, 28, 35, 0.5)',
  borderRadius: 4,
};

const rowLabelStyle: React.CSSProperties = {
  fontSize: 11,
  color: '#ebf1fa',
};

function removeButtonStyle(disabled: boolean): React.CSSProperties {
  return {
    padding: '2px 6px',
    fontSize: 10,
    color: disabled ? '#5a6068' : 'rgba(255, 138, 138, 0.8)',
    background: 'transparent',
    border: '1px solid rgba(255, 138, 138, 0.2)',
    borderRadius: 4,
    cursor: disabled ? 'not-allowed' : 'pointer',
  };
}
